import type { SerialRepository } from '../repositories/interfaces/serialRepository'
import type { PathRepository } from '../repositories/interfaces/pathRepository'
import type { JobRepository } from '../repositories/interfaces/jobRepository'
import type { SnStepStatusRepository } from '../repositories/interfaces/snStepStatusRepository'
import type { SnStepOverrideRepository } from '../repositories/interfaces/snStepOverrideRepository'
import type { AuditService } from './auditService'
import type { SnStepStatus, SnStepOverride, SerialNumber, ProcessStep } from '../types/domain'
import type { ScrapSerialInput, AdvanceToStepInput, ForceCompleteInput, WaiveStepInput } from '../types/api'
import type { AdvancementResult } from '../types/computed'
import { generateId } from '../utils/idGenerator'
import { NotFoundError, ValidationError } from '../utils/errors'

export function createLifecycleService(repos: {
  serials: SerialRepository
  paths: PathRepository
  jobs: JobRepository
  snStepStatuses: SnStepStatusRepository
  snStepOverrides: SnStepOverrideRepository
}, auditService: AuditService) {
  /**
   * Creates sn_step_statuses rows for all steps in the path.
   * First step gets 'in_progress', rest get 'pending'.
   */
  function initializeStepStatuses(serialId: string, pathId: string): void {
    const path = repos.paths.getById(pathId)
    if (!path) throw new NotFoundError('Path', pathId)

    const now = new Date().toISOString()
    const statuses: SnStepStatus[] = path.steps.map((step, index) => ({
      id: generateId('snss'),
      serialId,
      stepId: step.id,
      stepIndex: index,
      status: index === 0 ? 'in_progress' : 'pending',
      updatedAt: now,
    }))

    repos.snStepStatuses.createBatch(statuses)
  }

  /**
   * Returns all step statuses for a serial, ordered by step index.
   */
  function getStepStatuses(serialId: string): SnStepStatus[] {
    return repos.snStepStatuses.listBySerialId(serialId)
  }

  /**
   * Checks if all required steps are completed or waived.
   * A step blocks completion if it's required (not optional and no active override)
   * and its status is not 'completed' or 'waived'.
   */
  function canComplete(serialId: string): { canComplete: boolean; blockers: string[] } {
    const serial = repos.serials.getById(serialId)
    if (!serial) throw new NotFoundError('Serial', serialId)

    const path = repos.paths.getById(serial.pathId)
    if (!path) throw new NotFoundError('Path', serial.pathId)

    const stepStatuses = repos.snStepStatuses.listBySerialId(serialId)
    const activeOverrides = repos.snStepOverrides.listActiveBySerialId(serialId)
    const overriddenStepIds = new Set(activeOverrides.map(o => o.stepId))

    const blockers: string[] = []

    for (const step of path.steps) {
      // Skip optional steps — they never block completion
      if (step.optional) continue

      // Skip steps with an active override — treated as optional for this SN
      if (overriddenStepIds.has(step.id)) continue

      // Find the status for this step
      const status = stepStatuses.find(s => s.stepId === step.id)

      // If no status record or status is not completed/waived, it's a blocker
      if (!status || (status.status !== 'completed' && status.status !== 'waived')) {
        blockers.push(step.id)
      }
    }

    return {
      canComplete: blockers.length === 0,
      blockers,
    }
  }

  return {
    initializeStepStatuses,
    getStepStatuses,
    canComplete,

    scrapSerial(serialId: string, input: ScrapSerialInput): SerialNumber {
      const serial = repos.serials.getById(serialId)
      if (!serial) throw new NotFoundError('Serial', serialId)

      if (serial.status === 'scrapped') {
        throw new ValidationError('Serial is already scrapped')
      }
      if (serial.status === 'completed') {
        throw new ValidationError('Cannot scrap a completed serial')
      }

      if (!input.reason) {
        throw new ValidationError('Scrap reason is required')
      }
      if (input.reason === 'other' && !input.explanation) {
        throw new ValidationError('Explanation is required when scrap reason is "other"')
      }

      // Determine the current step ID from the path
      const path = repos.paths.getById(serial.pathId)
      if (!path) throw new NotFoundError('Path', serial.pathId)

      const currentStep = path.steps[serial.currentStepIndex]
      const scrapStepId = currentStep ? currentStep.id : undefined

      const now = new Date().toISOString()
      const updated = repos.serials.update(serialId, {
        status: 'scrapped',
        scrapReason: input.reason,
        scrapExplanation: input.explanation,
        scrapStepId,
        scrappedAt: now,
        scrappedBy: input.userId,
      })

      auditService.recordScrap({
        userId: input.userId,
        serialId,
        jobId: serial.jobId,
        pathId: serial.pathId,
        stepId: scrapStepId || '',
        metadata: {
          reason: input.reason,
          explanation: input.explanation,
        },
      })

      return updated
    },

    advanceToStep(serialId: string, input: AdvanceToStepInput): AdvancementResult {
      const serial = repos.serials.getById(serialId)
      if (!serial) throw new NotFoundError('Serial', serialId)

      // 1. Validate serial is in_progress
      if (serial.status === 'scrapped') {
        throw new ValidationError('Cannot advance a scrapped serial')
      }
      if (serial.status === 'completed') {
        throw new ValidationError('Cannot advance a completed serial')
      }

      const path = repos.paths.getById(serial.pathId)
      if (!path) throw new NotFoundError('Path', serial.pathId)

      const { targetStepIndex, userId } = input
      const currentStepIndex = serial.currentStepIndex
      const totalSteps = path.steps.length

      // 2. Validate forward-only
      if (targetStepIndex <= currentStepIndex) {
        throw new ValidationError('Cannot advance to a step at or before the current position')
      }

      // Allow targetStepIndex === totalSteps to mean "completion past last step"
      if (targetStepIndex > totalSteps) {
        throw new ValidationError('Target step index is out of range')
      }

      // 3. Check advancement mode
      const mode = path.advancementMode

      if (mode === 'strict') {
        // Strict: only N+1 allowed (or completion at totalSteps)
        if (targetStepIndex !== currentStepIndex + 1) {
          throw new ValidationError('Path is in strict mode — can only advance to the next sequential step')
        }
      }

      // Identify bypassed steps (between current+1 and target-1 inclusive)
      const bypassed: { step: ProcessStep; index: number }[] = []
      for (let i = currentStepIndex + 1; i < targetStepIndex; i++) {
        if (i < totalSteps) {
          bypassed.push({ step: path.steps[i], index: i })
        }
      }

      // Get active overrides for this serial
      const activeOverrides = repos.snStepOverrides.listActiveBySerialId(serialId)
      const overriddenStepIds = new Set(activeOverrides.map(o => o.stepId))

      // 4. For per_step mode, check dependency types of intermediate steps
      // For all modes (flexible and per_step), check physical dependencies
      for (const { step } of bypassed) {
        const isEffectivelyOptional = step.optional || overriddenStepIds.has(step.id)

        if (step.dependencyType === 'physical' && !isEffectivelyOptional) {
          // Check if the step has already been completed
          const stepStatus = repos.snStepStatuses.getBySerialAndStep(serialId, step.id)
          if (!stepStatus || stepStatus.status !== 'completed') {
            throw new ValidationError(`Cannot skip step with physical dependency`)
          }
        }
      }

      const now = new Date().toISOString()
      const bypassedResult: AdvancementResult['bypassed'] = []

      // 5. Classify and update bypassed steps
      for (const { step } of bypassed) {
        const isEffectivelyOptional = step.optional || overriddenStepIds.has(step.id)
        const classification: 'skipped' | 'deferred' = isEffectivelyOptional ? 'skipped' : 'deferred'

        // Update sn_step_statuses for bypassed step
        repos.snStepStatuses.updateBySerialAndStep(serialId, step.id, {
          status: classification,
          updatedAt: now,
        })

        bypassedResult.push({
          stepId: step.id,
          stepName: step.name,
          classification,
        })

        // Record audit for each bypassed step
        if (classification === 'skipped') {
          auditService.recordStepSkipped({
            userId,
            serialId,
            jobId: serial.jobId,
            pathId: serial.pathId,
            stepId: step.id,
          })
        } else {
          auditService.recordStepDeferred({
            userId,
            serialId,
            jobId: serial.jobId,
            pathId: serial.pathId,
            stepId: step.id,
          })
        }
      }

      // 6. Update origin step (current) → completed
      const originStep = path.steps[currentStepIndex]
      if (originStep) {
        repos.snStepStatuses.updateBySerialAndStep(serialId, originStep.id, {
          status: 'completed',
          updatedAt: now,
        })
      }

      // 7. Check if this is completion (target past last step)
      if (targetStepIndex === totalSteps) {
        // Completion — set serial status to 'completed', currentStepIndex to -1
        const updatedSerial = repos.serials.update(serialId, {
          status: 'completed',
          currentStepIndex: -1,
          updatedAt: now,
        })

        // Record advancement audit
        auditService.recordSerialAdvancement({
          userId,
          serialId,
          jobId: serial.jobId,
          pathId: serial.pathId,
          fromStepId: originStep?.id || '',
          toStepId: '',
        })

        return { serial: updatedSerial, bypassed: bypassedResult }
      }

      // 8. Update destination step → in_progress
      const destinationStep = path.steps[targetStepIndex]
      repos.snStepStatuses.updateBySerialAndStep(serialId, destinationStep.id, {
        status: 'in_progress',
        updatedAt: now,
      })

      // Update serial currentStepIndex
      const updatedSerial = repos.serials.update(serialId, {
        currentStepIndex: targetStepIndex,
        updatedAt: now,
      })

      // Record advancement audit
      auditService.recordSerialAdvancement({
        userId,
        serialId,
        jobId: serial.jobId,
        pathId: serial.pathId,
        fromStepId: originStep?.id || '',
        toStepId: destinationStep.id,
      })

      return { serial: updatedSerial, bypassed: bypassedResult }
    },

    forceComplete(serialId: string, input: ForceCompleteInput): SerialNumber {
      const serial = repos.serials.getById(serialId)
      if (!serial) throw new NotFoundError('Serial', serialId)

      if (serial.status === 'scrapped') {
        throw new ValidationError('Cannot force-complete a scrapped serial')
      }
      if (serial.status === 'completed') {
        throw new ValidationError('Serial is already completed')
      }

      const path = repos.paths.getById(serial.pathId)
      if (!path) throw new NotFoundError('Path', serial.pathId)

      // Collect incomplete required step IDs
      const stepStatuses = repos.snStepStatuses.listBySerialId(serialId)
      const activeOverrides = repos.snStepOverrides.listActiveBySerialId(serialId)
      const overriddenStepIds = new Set(activeOverrides.map(o => o.stepId))

      const incompleteStepIds: string[] = []
      for (const step of path.steps) {
        if (step.optional) continue
        if (overriddenStepIds.has(step.id)) continue

        const status = stepStatuses.find(s => s.stepId === step.id)
        if (!status || (status.status !== 'completed' && status.status !== 'waived')) {
          incompleteStepIds.push(step.id)
        }
      }

      // If no incomplete required steps, reject — use normal completion
      if (incompleteStepIds.length === 0) {
        throw new ValidationError('Serial has no incomplete required steps — use normal completion')
      }

      const now = new Date().toISOString()
      const updated = repos.serials.update(serialId, {
        status: 'completed',
        currentStepIndex: -1,
        forceCompleted: true,
        forceCompletedBy: input.userId,
        forceCompletedAt: now,
        forceCompletedReason: input.reason,
        updatedAt: now,
      })

      auditService.recordForceComplete({
        userId: input.userId,
        serialId,
        jobId: serial.jobId,
        pathId: serial.pathId,
        metadata: {
          reason: input.reason,
          incompleteStepIds,
        },
      })

      return updated
    },

    completeDeferredStep(serialId: string, stepId: string, userId: string): SnStepStatus {
      const serial = repos.serials.getById(serialId)
      if (!serial) throw new NotFoundError('Serial', serialId)

      const stepStatus = repos.snStepStatuses.getBySerialAndStep(serialId, stepId)
      if (!stepStatus) throw new NotFoundError('SnStepStatus', `${serialId}/${stepId}`)

      if (stepStatus.status !== 'deferred') {
        throw new ValidationError('Can only complete deferred steps — step status is: ' + stepStatus.status)
      }

      const now = new Date().toISOString()
      const updated = repos.snStepStatuses.updateBySerialAndStep(serialId, stepId, {
        status: 'completed',
        updatedAt: now,
      })

      auditService.recordDeferredStepCompleted({
        userId,
        serialId,
        jobId: serial.jobId,
        pathId: serial.pathId,
        stepId,
      })

      return updated
    },

    waiveStep(serialId: string, stepId: string, input: WaiveStepInput): SnStepStatus {
      const serial = repos.serials.getById(serialId)
      if (!serial) throw new NotFoundError('Serial', serialId)

      if (!input.reason || !input.approverId) {
        throw new ValidationError('Waiver requires a reason and approver identity')
      }

      const stepStatus = repos.snStepStatuses.getBySerialAndStep(serialId, stepId)
      if (!stepStatus) throw new NotFoundError('SnStepStatus', `${serialId}/${stepId}`)

      if (stepStatus.status !== 'deferred') {
        throw new ValidationError('Can only waive deferred required steps')
      }

      // Verify the step is required (not optional)
      const path = repos.paths.getById(serial.pathId)
      if (!path) throw new NotFoundError('Path', serial.pathId)
      const step = path.steps.find(s => s.id === stepId)
      if (!step) throw new NotFoundError('ProcessStep', stepId)
      if (step.optional) {
        throw new ValidationError('Can only waive required steps — this step is optional')
      }

      const now = new Date().toISOString()
      const updated = repos.snStepStatuses.updateBySerialAndStep(serialId, stepId, {
        status: 'waived',
        updatedAt: now,
      })

      auditService.recordStepWaived({
        userId: input.approverId,
        serialId,
        jobId: serial.jobId,
        pathId: serial.pathId,
        stepId,
        metadata: {
          reason: input.reason,
          approverId: input.approverId,
        },
      })

      return updated
    },

    createStepOverride(serialIds: string[], stepId: string, reason: string, userId: string): SnStepOverride[] {
      const overrides: SnStepOverride[] = []
      const now = new Date().toISOString()

      for (const serialId of serialIds) {
        const serial = repos.serials.getById(serialId)
        if (!serial) throw new NotFoundError('Serial', serialId)

        // Check if step is already completed for this serial
        const stepStatus = repos.snStepStatuses.getBySerialAndStep(serialId, stepId)
        if (stepStatus && stepStatus.status === 'completed') {
          throw new ValidationError('Cannot override a step that has already been completed')
        }

        // Check if override already exists
        const existing = repos.snStepOverrides.getBySerialAndStep(serialId, stepId)
        if (existing && existing.active) {
          continue // already overridden, skip
        }

        const override: SnStepOverride = {
          id: generateId('snso'),
          serialId,
          stepId,
          active: true,
          reason,
          createdBy: userId,
          createdAt: now,
        }

        const created = repos.snStepOverrides.create(override)
        overrides.push(created)

        auditService.recordStepOverrideCreated({
          userId,
          serialId,
          jobId: serial.jobId,
          pathId: serial.pathId,
          stepId,
          metadata: { reason },
        })
      }

      return overrides
    },

    reverseStepOverride(serialId: string, stepId: string, userId: string): void {
      const serial = repos.serials.getById(serialId)
      if (!serial) throw new NotFoundError('Serial', serialId)

      const override = repos.snStepOverrides.getBySerialAndStep(serialId, stepId)
      if (!override || !override.active) {
        throw new ValidationError('No active override found for this step')
      }

      // Check if step has already been skipped
      const stepStatus = repos.snStepStatuses.getBySerialAndStep(serialId, stepId)
      if (stepStatus && stepStatus.status === 'skipped') {
        throw new ValidationError('Cannot reverse override — step has already been skipped')
      }
      if (stepStatus && stepStatus.status === 'completed') {
        throw new ValidationError('Cannot reverse override — step has already been completed')
      }

      repos.snStepOverrides.update(override.id, { active: false })

      auditService.recordStepOverrideReversed({
        userId,
        serialId,
        jobId: serial.jobId,
        pathId: serial.pathId,
        stepId,
      })
    },
  }
}

export type LifecycleService = ReturnType<typeof createLifecycleService>
