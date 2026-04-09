/**
 * Part service — orchestrates part lifecycle operations.
 * Backward compatibility: Both legacy `SN-` and new `part_` prefixed IDs are accepted.
 * The service passes IDs through to the repository without prefix validation.
 */
import type { Database } from 'better-sqlite3'
import type { PartRepository } from '../repositories/interfaces/partRepository'
import type { PathRepository } from '../repositories/interfaces/pathRepository'
import type { CertRepository } from '../repositories/interfaces/certRepository'
import type { JobRepository } from '../repositories/interfaces/jobRepository'
import type { UserRepository } from '../repositories/interfaces/userRepository'
import type { PartStepStatusRepository } from '../repositories/interfaces/partStepStatusRepository'
import type { PartStepOverrideRepository } from '../repositories/interfaces/partStepOverrideRepository'
import type { Part } from '../types/domain'
import type { BatchCreatePartsInput } from '../types/api'
import type { EnrichedPart } from '../types/computed'
import type { AuditService } from '../services/auditService'
import type { LifecycleService } from '../services/lifecycleService'
import { generateId } from '../utils/idGenerator'
import { assertPositive, assertNonEmptyArray } from '../utils/validation'
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors'

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
    users?: UserRepository
    partStepStatuses?: PartStepStatusRepository
    partStepOverrides?: PartStepOverrideRepository
    db?: Database
  },
  auditService: AuditService,
  partIdGenerator: PartIdGenerator,
  lifecycleService?: LifecycleService,
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
        updatedAt: now,
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
            attachedBy: userId,
          })
        }
      }

      auditService.recordPartCreation({
        userId,
        jobId: input.jobId,
        pathId: input.pathId,
        batchQuantity: input.quantity,
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
          updatedAt: now,
        })

        auditService.recordPartCompletion({
          userId,
          partId,
          jobId: part.jobId,
          pathId: part.pathId,
          fromStepId: currentStep.id,
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
        updatedAt: now,
      })

      auditService.recordPartAdvancement({
        userId,
        partId,
        jobId: part.jobId,
        pathId: part.pathId,
        fromStepId: currentStep.id,
        toStepId: nextStep.id,
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
      return repos.parts.listAllEnriched()
    },

    /**
     * Admin-only hard delete of a single part with cascade cleanup.
     *
     * Cascades (inside a transaction, FK-safe order):
     *   1. cert_attachments (by part_id)
     *   2. part_step_overrides (by part_id)
     *   3. part_step_statuses (by part_id)
     *   4. parts (the row itself)
     *
     * Notes are keyed by stepId and reference parts via a JSON `serial_ids` column
     * (no FK), so they are left intact — removing a single part does not remove the
     * note. Audit entries also have no FK on `part_id`, preserving the audit trail.
     */
    deletePart(id: string, userId: string): { deletedPartId: string } {
      if (!userId) {
        throw new ValidationError('userId is required')
      }
      if (!repos.users) {
        throw new ValidationError('User repository not available')
      }
      const user = repos.users.getById(userId)
      if (!user) {
        throw new ValidationError(`User not found: ${userId}`)
      }
      if (!user.isAdmin) {
        throw new ForbiddenError('Admin access required to delete parts')
      }

      const part = repos.parts.getById(id)
      if (!part) {
        throw new NotFoundError('Part', id)
      }

      if (!repos.partStepOverrides || !repos.partStepStatuses || !repos.db) {
        throw new ValidationError('Cannot delete part: required repositories not available')
      }

      // Cascade delete inside a transaction in FK-safe order
      repos.db.transaction(() => {
        repos.certs.deleteAttachmentsByPartIds([id])
        repos.partStepOverrides!.deleteByPartIds([id])
        repos.partStepStatuses!.deleteByPartIds([id])
        repos.parts.delete(id)
      })()

      auditService.recordPartDeletion({
        userId,
        partId: id,
        jobId: part.jobId,
        pathId: part.pathId,
        metadata: {
          status: part.status,
          currentStepId: part.currentStepId,
        },
      })

      return { deletedPartId: id }
    },
  }
}

export type PartService = ReturnType<typeof createPartService>

/** @deprecated Use `createPartService` instead. Backward-compatible alias. */
export const createSerialService = createPartService
/** @deprecated Use `PartService` instead. Backward-compatible alias. */
export type SerialService = PartService
/** @deprecated Use `PartIdGenerator` instead. Backward-compatible alias. */
export type SnGenerator = PartIdGenerator
