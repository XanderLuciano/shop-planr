import type { SerialRepository } from '../repositories/interfaces/serialRepository'
import type { PathRepository } from '../repositories/interfaces/pathRepository'
import type { CertRepository } from '../repositories/interfaces/certRepository'
import type { JobRepository } from '../repositories/interfaces/jobRepository'
import type { SerialNumber } from '../types/domain'
import type { BatchCreateSerialsInput } from '../types/api'
import type { EnrichedSerial } from '../types/computed'
import type { AuditService } from '../services/auditService'
import type { LifecycleService } from '../services/lifecycleService'
import { assertPositive, assertNonEmptyArray } from '../utils/validation'
import { NotFoundError, ValidationError } from '../utils/errors'

export interface SnGenerator {
  next(): string
  nextBatch(count: number): string[]
}

export function createSerialService(
  repos: {
    serials: SerialRepository
    paths: PathRepository
    certs: CertRepository
    jobs?: JobRepository
  },
  auditService: AuditService,
  snGenerator: SnGenerator,
  lifecycleService?: LifecycleService
) {
  return {
    batchCreateSerials(input: BatchCreateSerialsInput, userId: string): SerialNumber[] {
      assertPositive(input.quantity, 'quantity')

      const path = repos.paths.getById(input.pathId)
      if (!path) {
        throw new NotFoundError('Path', input.pathId)
      }
      assertNonEmptyArray(path.steps, 'path.steps')

      const identifiers = snGenerator.nextBatch(input.quantity)
      const now = new Date().toISOString()

      const serials: SerialNumber[] = identifiers.map(id => ({
        id,
        jobId: input.jobId,
        pathId: input.pathId,
        currentStepIndex: 0,
        createdAt: now,
        updatedAt: now
      }))

      const created = repos.serials.createBatch(serials)

      // Initialize step statuses for each created serial
      if (lifecycleService) {
        for (const serial of created) {
          lifecycleService.initializeStepStatuses(serial.id, serial.pathId)
        }
      }

      // If certId provided, validate cert exists and attach to all serials at step 0
      if (input.certId) {
        const cert = repos.certs.getById(input.certId)
        if (!cert) {
          throw new NotFoundError('Certificate', input.certId)
        }

        const firstStep = path.steps[0]!
        for (const serial of created) {
          repos.certs.attachToSerial({
            serialId: serial.id,
            certId: input.certId,
            stepId: firstStep.id,
            attachedAt: now,
            attachedBy: userId
          })
        }
      }

      auditService.recordSerialCreation({
        userId,
        jobId: input.jobId,
        pathId: input.pathId,
        batchQuantity: input.quantity
      })

      return created
    },

    advanceSerial(serialId: string, userId: string): SerialNumber {
      const serial = repos.serials.getById(serialId)
      if (!serial) {
        throw new NotFoundError('SerialNumber', serialId)
      }

      const path = repos.paths.getById(serial.pathId)
      if (!path) {
        throw new NotFoundError('Path', serial.pathId)
      }

      if (serial.status === 'scrapped') {
        throw new ValidationError('Cannot advance a scrapped serial')
      }

      if (serial.currentStepIndex === -1 || serial.status === 'completed') {
        throw new ValidationError('Serial number is already completed')
      }

      const lastStepIndex = path.steps.length - 1
      const fromStep = path.steps[serial.currentStepIndex]!
      const now = new Date().toISOString()

      if (serial.currentStepIndex === lastStepIndex) {
        // Mark as completed
        const updated = repos.serials.update(serialId, {
          currentStepIndex: -1,
          status: 'completed',
          updatedAt: now
        })

        auditService.recordSerialCompletion({
          userId,
          serialId,
          jobId: serial.jobId,
          pathId: serial.pathId,
          fromStepId: fromStep.id
        })

        return updated
      }

      // Advance to next step
      const toStep = path.steps[serial.currentStepIndex + 1]!
      const updated = repos.serials.update(serialId, {
        currentStepIndex: serial.currentStepIndex + 1,
        updatedAt: now
      })

      auditService.recordSerialAdvancement({
        userId,
        serialId,
        jobId: serial.jobId,
        pathId: serial.pathId,
        fromStepId: fromStep.id,
        toStepId: toStep.id
      })

      return updated
    },

    getSerial(id: string): SerialNumber {
      const serial = repos.serials.getById(id)
      if (!serial) {
        throw new NotFoundError('SerialNumber', id)
      }
      return serial
    },

    lookupSerial(identifier: string): SerialNumber | null {
      return repos.serials.getByIdentifier(identifier)
    },

    listSerialsByPath(pathId: string): SerialNumber[] {
      return repos.serials.listByPathId(pathId)
    },

    listSerialsByJob(jobId: string): SerialNumber[] {
      return repos.serials.listByJobId(jobId)
    },

    listSerialsByStepIndex(pathId: string, stepIndex: number): SerialNumber[] {
      return repos.serials.listByStepIndex(pathId, stepIndex)
    },

    listAllSerialsEnriched(): EnrichedSerial[] {
      const serials = repos.serials.listAll()

      // Build lookup maps for jobs and paths
      const jobMap = new Map<string, string>()
      const pathMap = new Map<string, { name: string; steps: { name: string; order: number; assignedTo?: string }[] }>()

      for (const serial of serials) {
        if (!jobMap.has(serial.jobId) && repos.jobs) {
          const job = repos.jobs.getById(serial.jobId)
          if (job) jobMap.set(serial.jobId, job.name)
        }
        if (!pathMap.has(serial.pathId)) {
          const path = repos.paths.getById(serial.pathId)
          if (path) {
            pathMap.set(serial.pathId, {
              name: path.name,
              steps: path.steps.map(s => ({ name: s.name, order: s.order, assignedTo: s.assignedTo })),
            })
          }
        }
      }

      return serials.map((serial) => {
        const jobName = jobMap.get(serial.jobId) ?? ''
        const pathData = pathMap.get(serial.pathId)
        const pathName = pathData?.name ?? ''
        const steps = pathData?.steps ?? []

        let status: 'in-progress' | 'completed' | 'scrapped'
        if (serial.status === 'scrapped') {
          status = 'scrapped'
        } else if (serial.currentStepIndex === -1 || serial.status === 'completed') {
          status = 'completed'
        } else {
          status = 'in-progress'
        }

        let currentStepName = 'Completed'
        let assignedTo: string | undefined
        if (serial.currentStepIndex >= 0) {
          const currentStep = steps.find(s => s.order === serial.currentStepIndex)
          currentStepName = currentStep?.name ?? ''
          assignedTo = currentStep?.assignedTo
        }
        if (serial.status === 'scrapped') {
          currentStepName = 'Scrapped'
        }

        return {
          id: serial.id,
          jobId: serial.jobId,
          jobName,
          pathId: serial.pathId,
          pathName,
          currentStepIndex: serial.currentStepIndex,
          currentStepName,
          assignedTo,
          status,
          scrapReason: serial.scrapReason,
          forceCompleted: serial.forceCompleted || undefined,
          createdAt: serial.createdAt,
        }
      })
    }
  }
}

export type SerialService = ReturnType<typeof createSerialService>
