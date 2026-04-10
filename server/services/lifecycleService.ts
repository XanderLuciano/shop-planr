import type { PartRepository } from '../repositories/interfaces/partRepository'
import type { PathRepository } from '../repositories/interfaces/pathRepository'
import type { JobRepository } from '../repositories/interfaces/jobRepository'
import type { PartStepStatusRepository } from '../repositories/interfaces/partStepStatusRepository'
import type { PartStepOverrideRepository } from '../repositories/interfaces/partStepOverrideRepository'
import type { AuditService } from './auditService'
import type { PartStepStatus, PartStepOverride, Part, ProcessStep } from '../types/domain'
import type { ScrapPartInput, AdvanceToStepInput, ForceCompleteInput, WaiveStepInput } from '../types/api'
import type { AdvancementResult } from '../types/computed'
import { generateId } from '../utils/idGenerator'
import { NotFoundError, ValidationError } from '../utils/errors'

export function createLifecycleService(repos: {
  parts: PartRepository
  paths: PathRepository
  jobs: JobRepository
  partStepStatuses: PartStepStatusRepository
  partStepOverrides: PartStepOverrideRepository
}, auditService: AuditService) {
  /**
   * Creates part_step_statuses rows for all steps in the path.
   * First step gets 'in_progress' with sequenceNumber 1, rest get 'pending' with sequenceNumber 1.
   */
  function initializeStepStatuses(partId: string, pathId: string): void {
    const path = repos.paths.getById(pathId)
    if (!path) throw new NotFoundError('Path', pathId)

    const now = new Date().toISOString()
    const statuses: PartStepStatus[] = path.steps.map((step, index) => ({
      id: generateId('pss'),
      partId,
      stepId: step.id,
      sequenceNumber: 1,
      status: index === 0 ? 'in_progress' : 'pending',
      enteredAt: now,
      updatedAt: now,
    }))

    repos.partStepStatuses.createBatch(statuses)
  }

  /**
   * Returns all step statuses for a part, ordered by sequenceNumber.
   */
  function getStepStatuses(partId: string): PartStepStatus[] {
    return repos.partStepStatuses.listByPartId(partId)
  }

  /**
   * Checks if all required steps are completed or waived.
   * Uses getLatestByPartAndStep to get the most recent routing entry per step.
   */
  function canComplete(partId: string): { canComplete: boolean, blockers: string[] } {
    const part = repos.parts.getById(partId)
    if (!part) throw new NotFoundError('Part', partId)

    const path = repos.paths.getById(part.pathId)
    if (!path) throw new NotFoundError('Path', part.pathId)

    const activeOverrides = repos.partStepOverrides.listActiveByPartId(partId)
    const overriddenStepIds = new Set(activeOverrides.map(o => o.stepId))

    const blockers: string[] = []

    for (const step of path.steps) {
      // Skip optional steps — they never block completion
      if (step.optional) continue

      // Skip steps with an active override — treated as optional for this part
      if (overriddenStepIds.has(step.id)) continue

      // Find the latest status for this step
      const status = repos.partStepStatuses.getLatestByPartAndStep(partId, step.id)

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

    scrapPart(partId: string, input: ScrapPartInput): Part {
      const part = repos.parts.getById(partId)
      if (!part) throw new NotFoundError('Part', partId)

      if (part.status === 'scrapped') {
        throw new ValidationError('Part is already scrapped')
      }
      if (part.status === 'completed') {
        throw new ValidationError('Cannot scrap a completed part')
      }

      if (!input.reason) {
        throw new ValidationError('Scrap reason is required')
      }
      if (input.reason === 'other' && !input.explanation) {
        throw new ValidationError('Explanation is required when scrap reason is "other"')
      }

      // Determine the current step ID from the part
      const path = repos.paths.getById(part.pathId)
      if (!path) throw new NotFoundError('Path', part.pathId)

      const currentStep = path.steps.find(s => s.id === part.currentStepId)
      const scrapStepId = currentStep ? currentStep.id : undefined

      const now = new Date().toISOString()
      const updated = repos.parts.update(partId, {
        status: 'scrapped',
        scrapReason: input.reason,
        scrapExplanation: input.explanation,
        scrapStepId,
        scrappedAt: now,
        scrappedBy: input.userId,
      })

      auditService.recordScrap({
        userId: input.userId,
        partId,
        jobId: part.jobId,
        pathId: part.pathId,
        stepId: scrapStepId || '',
        metadata: {
          reason: input.reason,
          explanation: input.explanation,
        },
      })

      return updated
    },

    advanceToStep(partId: string, input: AdvanceToStepInput): AdvancementResult {
      const part = repos.parts.getById(partId)
      if (!part) throw new NotFoundError('Part', partId)

      // 1. Validate part is in_progress
      if (part.status === 'scrapped') {
        throw new ValidationError('Cannot advance a scrapped part')
      }
      if (part.status === 'completed') {
        throw new ValidationError('Cannot advance a completed part')
      }

      const path = repos.paths.getById(part.pathId)
      if (!path) throw new NotFoundError('Path', part.pathId)

      const { targetStepId, userId } = input

      // 2. Look up current step by part.currentStepId
      const currentStep = path.steps.find(s => s.id === part.currentStepId)
      if (!currentStep) {
        throw new ValidationError('Current step no longer exists in path')
      }

      // 3. Look up target step by ID
      const targetStep = path.steps.find(s => s.id === targetStepId)

      // Allow targetStepId to be a special "completion" signal if target not found
      // but only if it's explicitly past the last step
      const isCompletionTarget = !targetStep && targetStepId === '__complete__'

      if (!targetStep && !isCompletionTarget) {
        throw new NotFoundError('ProcessStep', targetStepId)
      }

      const targetOrder = targetStep ? targetStep.order : path.steps.length
      const currentOrder = currentStep.order

      // 4. Validate forward-only
      if (targetOrder <= currentOrder) {
        throw new ValidationError('Cannot advance to a step at or before the current position')
      }

      // 5. Check advancement mode
      const mode = path.advancementMode

      if (mode === 'strict') {
        // Strict: only next step allowed (or completion past last)
        if (targetOrder !== currentOrder + 1) {
          throw new ValidationError('Path is in strict mode — can only advance to the next sequential step')
        }
      }

      // Identify bypassed steps (between current+1 and target-1 inclusive by order)
      const bypassed: { step: ProcessStep }[] = []
      for (const step of path.steps) {
        if (step.order > currentOrder && step.order < targetOrder) {
          bypassed.push({ step })
        }
      }

      // Get active overrides for this part
      const activeOverrides = repos.partStepOverrides.listActiveByPartId(partId)
      const overriddenStepIds = new Set(activeOverrides.map(o => o.stepId))

      // 6. For per_step mode, check dependency types of intermediate steps
      for (const { step } of bypassed) {
        const isEffectivelyOptional = step.optional || overriddenStepIds.has(step.id)

        if (step.dependencyType === 'physical' && !isEffectivelyOptional) {
          const stepStatus = repos.partStepStatuses.getLatestByPartAndStep(partId, step.id)
          if (!stepStatus || stepStatus.status !== 'completed') {
            throw new ValidationError(`Cannot skip step with physical dependency`)
          }
        }
      }

      const now = new Date().toISOString()
      let nextSeq = repos.partStepStatuses.getNextSequenceNumber(partId)
      const bypassedResult: { stepId: string, stepName: string, classification: 'skipped' | 'deferred' }[] = []

      // 7. Classify and create routing entries for bypassed steps
      for (const { step } of bypassed) {
        const isEffectivelyOptional = step.optional || overriddenStepIds.has(step.id)
        const classification: 'skipped' | 'deferred' = isEffectivelyOptional ? 'skipped' : 'deferred'

        // Create a new routing entry for the bypassed step
        repos.partStepStatuses.create({
          id: generateId('pss'),
          partId,
          stepId: step.id,
          sequenceNumber: nextSeq++,
          status: classification,
          enteredAt: now,
          completedAt: now,
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
            partId,
            jobId: part.jobId,
            pathId: part.pathId,
            stepId: step.id,
          })
        } else {
          auditService.recordStepDeferred({
            userId,
            partId,
            jobId: part.jobId,
            pathId: part.pathId,
            stepId: step.id,
          })
        }
      }

      // 8. Update origin step status
      const isSkipping = input.skip === true
      const isOriginEffectivelyOptional = currentStep.optional || overriddenStepIds.has(currentStep.id)

      let originStatus: 'completed' | 'skipped' | 'deferred'
      if (isSkipping && isOriginEffectivelyOptional) {
        // Origin step was skipped (not completed)
        originStatus = 'skipped'
      } else if (isSkipping && !isOriginEffectivelyOptional) {
        // Skipping a required step → deferred (must be completed later)
        originStatus = 'deferred'
      } else {
        // Normal advancement — origin step was completed
        originStatus = 'completed'
      }

      const originEntry = repos.partStepStatuses.getLatestByPartAndStep(partId, currentStep.id)
      if (originEntry) {
        repos.partStepStatuses.updateLatestByPartAndStep(partId, currentStep.id, {
          status: originStatus,
          completedAt: originStatus === 'completed' ? now : undefined,
          updatedAt: now,
        })
      } else {
        // Legacy data: no routing entry exists — create one
        repos.partStepStatuses.create({
          id: generateId('pss'),
          partId,
          stepId: currentStep.id,
          sequenceNumber: nextSeq++,
          status: originStatus,
          enteredAt: now,
          completedAt: originStatus === 'completed' ? now : undefined,
          updatedAt: now,
        })
      }

      // Record audit for origin step when skipping
      if (isSkipping) {
        if (originStatus === 'skipped') {
          auditService.recordStepSkipped({
            userId,
            partId,
            jobId: part.jobId,
            pathId: part.pathId,
            stepId: currentStep.id,
          })
        } else if (originStatus === 'deferred') {
          auditService.recordStepDeferred({
            userId,
            partId,
            jobId: part.jobId,
            pathId: part.pathId,
            stepId: currentStep.id,
          })
        }
      }

      // Only increment completedCount for normal advancement (not skipping)
      if (!isSkipping) {
        repos.paths.updateStep(currentStep.id, {
          completedCount: currentStep.completedCount + 1,
        })
      }

      // 9. Check if this is completion (target past last step or no target step)
      if (!targetStep) {
        // Completion — set part status to 'completed', currentStepId to null
        const updatedPart = repos.parts.update(partId, {
          status: 'completed',
          currentStepId: null,
          updatedAt: now,
        })

        auditService.recordPartAdvancement({
          userId,
          partId,
          jobId: part.jobId,
          pathId: part.pathId,
          fromStepId: currentStep.id,
          toStepId: '',
        })

        return { serial: updatedPart, bypassed: bypassedResult }
      }

      // 10. Create routing entry for destination step
      repos.partStepStatuses.create({
        id: generateId('pss'),
        partId,
        stepId: targetStep.id,
        sequenceNumber: nextSeq++,
        status: 'in_progress',
        enteredAt: now,
        updatedAt: now,
      })

      // Update part currentStepId
      const updatedPart = repos.parts.update(partId, {
        currentStepId: targetStep.id,
        updatedAt: now,
      })

      // Record advancement audit
      auditService.recordPartAdvancement({
        userId,
        partId,
        jobId: part.jobId,
        pathId: part.pathId,
        fromStepId: currentStep.id,
        toStepId: targetStep.id,
      })

      return { serial: updatedPart, bypassed: bypassedResult }
    },

    forceComplete(partId: string, input: ForceCompleteInput): Part {
      const part = repos.parts.getById(partId)
      if (!part) throw new NotFoundError('Part', partId)

      if (part.status === 'scrapped') {
        throw new ValidationError('Cannot force-complete a scrapped part')
      }
      if (part.status === 'completed') {
        throw new ValidationError('Part is already completed')
      }

      const path = repos.paths.getById(part.pathId)
      if (!path) throw new NotFoundError('Path', part.pathId)

      // Collect incomplete required step IDs
      const activeOverrides = repos.partStepOverrides.listActiveByPartId(partId)
      const overriddenStepIds = new Set(activeOverrides.map(o => o.stepId))

      const incompleteStepIds: string[] = []
      for (const step of path.steps) {
        if (step.optional) continue
        if (overriddenStepIds.has(step.id)) continue

        const status = repos.partStepStatuses.getLatestByPartAndStep(partId, step.id)
        if (!status || (status.status !== 'completed' && status.status !== 'waived')) {
          incompleteStepIds.push(step.id)
        }
      }

      // If no incomplete required steps, reject — use normal completion
      if (incompleteStepIds.length === 0) {
        throw new ValidationError('Part has no incomplete required steps — use normal completion')
      }

      const now = new Date().toISOString()
      const updated = repos.parts.update(partId, {
        status: 'completed',
        currentStepId: null,
        forceCompleted: true,
        forceCompletedBy: input.userId,
        forceCompletedAt: now,
        forceCompletedReason: input.reason,
        updatedAt: now,
      })

      auditService.recordForceComplete({
        userId: input.userId,
        partId,
        jobId: part.jobId,
        pathId: part.pathId,
        metadata: {
          reason: input.reason,
          incompleteStepIds,
        },
      })

      return updated
    },

    completeDeferredStep(partId: string, stepId: string, userId: string): PartStepStatus {
      const part = repos.parts.getById(partId)
      if (!part) throw new NotFoundError('Part', partId)

      const stepStatus = repos.partStepStatuses.getLatestByPartAndStep(partId, stepId)
      if (!stepStatus) throw new NotFoundError('PartStepStatus', `${partId}/${stepId}`)

      if (stepStatus.status !== 'deferred') {
        throw new ValidationError('Can only complete deferred steps — step status is: ' + stepStatus.status)
      }

      const now = new Date().toISOString()
      const updated = repos.partStepStatuses.updateLatestByPartAndStep(partId, stepId, {
        status: 'completed',
        completedAt: now,
        updatedAt: now,
      })

      auditService.recordDeferredStepCompleted({
        userId,
        partId,
        jobId: part.jobId,
        pathId: part.pathId,
        stepId,
      })

      return updated
    },

    waiveStep(partId: string, stepId: string, input: WaiveStepInput): PartStepStatus {
      const part = repos.parts.getById(partId)
      if (!part) throw new NotFoundError('Part', partId)

      if (!input.reason || !input.approverId) {
        throw new ValidationError('Waiver requires a reason and approver identity')
      }

      const stepStatus = repos.partStepStatuses.getLatestByPartAndStep(partId, stepId)
      if (!stepStatus) throw new NotFoundError('PartStepStatus', `${partId}/${stepId}`)

      if (stepStatus.status !== 'deferred') {
        throw new ValidationError('Can only waive deferred required steps')
      }

      // Verify the step is required (not optional)
      const path = repos.paths.getById(part.pathId)
      if (!path) throw new NotFoundError('Path', part.pathId)
      const step = path.steps.find(s => s.id === stepId)
      if (!step) throw new NotFoundError('ProcessStep', stepId)
      if (step.optional) {
        throw new ValidationError('Can only waive required steps — this step is optional')
      }

      const now = new Date().toISOString()
      const updated = repos.partStepStatuses.updateLatestByPartAndStep(partId, stepId, {
        status: 'waived',
        updatedAt: now,
      })

      auditService.recordStepWaived({
        userId: input.approverId,
        partId,
        jobId: part.jobId,
        pathId: part.pathId,
        stepId,
        metadata: {
          reason: input.reason,
          approverId: input.approverId,
        },
      })

      return updated
    },

    createStepOverride(partIds: string[], stepId: string, reason: string, userId: string): PartStepOverride[] {
      const overrides: PartStepOverride[] = []
      const now = new Date().toISOString()

      for (const partId of partIds) {
        const part = repos.parts.getById(partId)
        if (!part) throw new NotFoundError('Part', partId)

        // Check if step is already completed for this part
        const stepStatus = repos.partStepStatuses.getLatestByPartAndStep(partId, stepId)
        if (stepStatus && stepStatus.status === 'completed') {
          throw new ValidationError('Cannot override a step that has already been completed')
        }

        // Check if override already exists
        const existing = repos.partStepOverrides.getByPartAndStep(partId, stepId)
        if (existing && existing.active) {
          continue // already overridden, skip
        }

        const override: PartStepOverride = {
          id: generateId('pso'),
          partId,
          stepId,
          active: true,
          reason,
          createdBy: userId,
          createdAt: now,
        }

        const created = repos.partStepOverrides.create(override)
        overrides.push(created)

        auditService.recordStepOverrideCreated({
          userId,
          partId,
          jobId: part.jobId,
          pathId: part.pathId,
          stepId,
          metadata: { reason },
        })
      }

      return overrides
    },

    reverseStepOverride(partId: string, stepId: string, userId: string): void {
      const part = repos.parts.getById(partId)
      if (!part) throw new NotFoundError('Part', partId)

      const override = repos.partStepOverrides.getByPartAndStep(partId, stepId)
      if (!override || !override.active) {
        throw new ValidationError('No active override found for this step')
      }

      // Check if step has already been skipped
      const stepStatus = repos.partStepStatuses.getLatestByPartAndStep(partId, stepId)
      if (stepStatus && stepStatus.status === 'skipped') {
        throw new ValidationError('Cannot reverse override — step has already been skipped')
      }
      if (stepStatus && stepStatus.status === 'completed') {
        throw new ValidationError('Cannot reverse override — step has already been completed')
      }

      repos.partStepOverrides.update(override.id, { active: false })

      auditService.recordStepOverrideReversed({
        userId,
        partId,
        jobId: part.jobId,
        pathId: part.pathId,
        stepId,
      })
    },

    // ---- Backward-compatible aliases (deprecated) ----

    /** @deprecated Use `scrapPart` instead. */
    get scrapSerial() { return this.scrapPart },
    /** @deprecated Use `advanceToStep` with partId instead. */
    // advanceToStep already uses partId param name
  }
}

export type LifecycleService = ReturnType<typeof createLifecycleService>
