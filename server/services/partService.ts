/**
 * Part service — orchestrates part lifecycle operations.
 * Backward compatibility: Both legacy `SN-` and new `part_` prefixed IDs are accepted.
 * The service passes IDs through to the repository without prefix validation.
 */
import type { PartRepository } from '../repositories/interfaces/partRepository'
import type { PathRepository } from '../repositories/interfaces/pathRepository'
import type { CertRepository } from '../repositories/interfaces/certRepository'
import type { JobRepository } from '../repositories/interfaces/jobRepository'
import type { PartStepStatusRepository } from '../repositories/interfaces/partStepStatusRepository'
import type { Part, PartStepStatus } from '../types/domain'
import type { BatchCreatePartsInput } from '../types/api'
import type { EnrichedPart } from '../types/computed'
import type { AuditService } from '../services/auditService'
import type { LifecycleService } from '../services/lifecycleService'
import { generateId } from '../utils/idGenerator'
import { assertPositive, assertNonEmptyArray } from '../utils/validation'
import { NotFoundError, ValidationError } from '../utils/errors'

export interface PartIdGenerator {
  next(): string
  nextBatch(count: number): string[]
}

export function createPartService(
  repos: {
    parts: PartRepository
    paths: PathRepository
    certs: CertRepository
    jobs?: JobRepository
    partStepStatuses?: PartStepStatusRepository
  },
  auditService: AuditService,
  partIdGenerator: PartIdGenerator,
  lifecycleService?: LifecycleService
) {
  return {
    batchCreateParts(input: BatchCreatePartsInput, userId: string): Part[] {
      assertPositive(input.quantity, 'quantity')

      const path = repos.paths.getById(input.pathId)
      if (!path) {
        throw new NotFoundError('Path', input.pathId)
      }
      assertNonEmptyArray(path.steps, 'path.steps')

      const identifiers = partIdGenerator.nextBatch(input.quantity)
      const now = new Date().toISOString()

      const parts: Part[] = identifiers.map(id => ({
        id,
        jobId: input.jobId,
        pathId: input.pathId,
        currentStepId: path.steps[0]!.id,
        status: 'in_progress' as const,
        forceCompleted: false,
        createdAt: now,
        updatedAt: now
      }))

      const created = repos.parts.createBatch(parts)

      // Initialize step statuses for each created part
      if (lifecycleService) {
        for (const part of created) {
          lifecycleService.initializeStepStatuses(part.id, part.pathId)
        }
      }

      // If certId provided, validate cert exists and attach to all parts at step 0
      if (input.certId) {
        const cert = repos.certs.getById(input.certId)
        if (!cert) {
          throw new NotFoundError('Certificate', input.certId)
        }

        const firstStep = path.steps[0]!
        for (const part of created) {
          repos.certs.attachToPart({
            partId: part.id,
            certId: input.certId,
            stepId: firstStep.id,
            attachedAt: now,
            attachedBy: userId
          })
        }
      }

      auditService.recordPartCreation({
        userId,
        jobId: input.jobId,
        pathId: input.pathId,
        batchQuantity: input.quantity
      })

      return created
    },

    advancePart(partId: string, userId: string): Part {
      const part = repos.parts.getById(partId)
      if (!part) {
        throw new NotFoundError('Part', partId)
      }

      const path = repos.paths.getById(part.pathId)
      if (!path) {
        throw new NotFoundError('Path', part.pathId)
      }

      if (part.status === 'scrapped') {
        throw new ValidationError('Cannot advance a scrapped part')
      }

      if (part.currentStepId === null || part.status === 'completed') {
        throw new ValidationError('Part is already completed')
      }

      // Find current step by ID
      const currentStep = path.steps.find(s => s.id === part.currentStepId)
      if (!currentStep) {
        throw new ValidationError('Current step no longer exists in path')
      }

      // Find next step by order + 1
      const nextStep = path.steps.find(s => s.order === currentStep.order + 1)
      const now = new Date().toISOString()

      // Increment origin step's completedCount
      repos.paths.updateStep(currentStep.id, {
        completedCount: currentStep.completedCount + 1,
      })

      // Update routing history: mark origin step as completed
      if (repos.partStepStatuses) {
        const existing = repos.partStepStatuses.getLatestByPartAndStep(partId, currentStep.id)
        if (existing) {
          repos.partStepStatuses.updateLatestByPartAndStep(partId, currentStep.id, {
            status: 'completed',
            completedAt: now,
            updatedAt: now,
          })
        } else {
          // Legacy data: no routing entry exists for this step — create one as completed
          const nextSeq = repos.partStepStatuses.getNextSequenceNumber(partId)
          repos.partStepStatuses.create({
            id: generateId('pss'),
            partId,
            stepId: currentStep.id,
            sequenceNumber: nextSeq,
            status: 'completed',
            enteredAt: now,
            completedAt: now,
            updatedAt: now,
          })
        }
      }

      if (!nextStep) {
        // Mark as completed — past final step
        const updated = repos.parts.update(partId, {
          currentStepId: null,
          status: 'completed',
          updatedAt: now
        })

        auditService.recordPartCompletion({
          userId,
          partId,
          jobId: part.jobId,
          pathId: part.pathId,
          fromStepId: currentStep.id
        })

        return updated
      }

      // Create routing history entry for destination step
      if (repos.partStepStatuses) {
        const nextSeq = repos.partStepStatuses.getNextSequenceNumber(partId)
        repos.partStepStatuses.create({
          id: generateId('pss'),
          partId,
          stepId: nextStep.id,
          sequenceNumber: nextSeq,
          status: 'in_progress',
          enteredAt: now,
          updatedAt: now,
        })
      }

      // Advance to next step
      const updated = repos.parts.update(partId, {
        currentStepId: nextStep.id,
        updatedAt: now
      })

      auditService.recordPartAdvancement({
        userId,
        partId,
        jobId: part.jobId,
        pathId: part.pathId,
        fromStepId: currentStep.id,
        toStepId: nextStep.id
      })

      return updated
    },

    getPart(id: string): Part {
      const part = repos.parts.getById(id)
      if (!part) {
        throw new NotFoundError('Part', id)
      }
      return part
    },

    lookupPart(identifier: string): Part | null {
      return repos.parts.getByIdentifier(identifier)
    },

    listPartsByPath(pathId: string): Part[] {
      return repos.parts.listByPathId(pathId)
    },

    listPartsByJob(jobId: string): Part[] {
      return repos.parts.listByJobId(jobId)
    },

    listPartsByCurrentStepId(stepId: string): Part[] {
      return repos.parts.listByCurrentStepId(stepId)
    },

    listAllPartsEnriched(): EnrichedPart[] {
      const parts = repos.parts.listAll()

      // Build lookup maps for jobs and paths
      const jobMap = new Map<string, string>()
      const pathMap = new Map<string, { name: string; steps: { id: string; name: string; order: number; assignedTo?: string }[] }>()

      for (const part of parts) {
        if (!jobMap.has(part.jobId) && repos.jobs) {
          const job = repos.jobs.getById(part.jobId)
          if (job) jobMap.set(part.jobId, job.name)
        }
        if (!pathMap.has(part.pathId)) {
          const path = repos.paths.getById(part.pathId)
          if (path) {
            pathMap.set(part.pathId, {
              name: path.name,
              steps: path.steps.map(s => ({ id: s.id, name: s.name, order: s.order, assignedTo: s.assignedTo })),
            })
          }
        }
      }

      return parts.map((part) => {
        const jobName = jobMap.get(part.jobId) ?? ''
        const pathData = pathMap.get(part.pathId)
        const pathName = pathData?.name ?? ''
        const steps = pathData?.steps ?? []

        let status: 'in-progress' | 'completed' | 'scrapped'
        if (part.status === 'scrapped') {
          status = 'scrapped'
        } else if (part.currentStepId === null || part.status === 'completed') {
          status = 'completed'
        } else {
          status = 'in-progress'
        }

        let currentStepName = 'Completed'
        let assignedTo: string | undefined
        if (part.currentStepId !== null) {
          const currentStep = steps.find(s => s.id === part.currentStepId)
          currentStepName = currentStep?.name ?? ''
          assignedTo = currentStep?.assignedTo
        }
        if (part.status === 'scrapped') {
          currentStepName = 'Scrapped'
        }

        return {
          id: part.id,
          jobId: part.jobId,
          jobName,
          pathId: part.pathId,
          pathName,
          currentStepId: part.currentStepId,
          currentStepName,
          assignedTo,
          status,
          scrapReason: part.scrapReason,
          forceCompleted: part.forceCompleted || undefined,
          createdAt: part.createdAt,
        }
      })
    }
  }
}

export type PartService = ReturnType<typeof createPartService>

/** @deprecated Use `createPartService` instead. Backward-compatible alias. */
export const createSerialService = createPartService
/** @deprecated Use `PartService` instead. Backward-compatible alias. */
export type SerialService = PartService
/** @deprecated Use `PartIdGenerator` instead. Backward-compatible alias. */
export type SnGenerator = PartIdGenerator
