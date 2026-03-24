import type { AuditRepository } from '../repositories/interfaces/auditRepository'
import type { AuditAction, AuditEntry } from '../types/domain'
import { generateId } from '../utils/idGenerator'

export function createAuditService(repos: { audit: AuditRepository }) {
  function createEntry(
    action: AuditAction,
    fields: Omit<AuditEntry, 'id' | 'action' | 'timestamp'>
  ): AuditEntry {
    return repos.audit.create({
      id: generateId('aud'),
      action,
      timestamp: new Date().toISOString(),
      ...fields
    })
  }

  return {
    recordCertAttachment(params: {
      userId: string
      serialId: string
      certId: string
      stepId: string
      jobId?: string
      pathId?: string
    }): AuditEntry {
      return createEntry('cert_attached', {
        userId: params.userId,
        serialId: params.serialId,
        certId: params.certId,
        stepId: params.stepId,
        jobId: params.jobId,
        pathId: params.pathId
      })
    },

    recordSerialCreation(params: {
      userId: string
      jobId: string
      pathId: string
      batchQuantity: number
    }): AuditEntry {
      return createEntry('serial_created', {
        userId: params.userId,
        jobId: params.jobId,
        pathId: params.pathId,
        batchQuantity: params.batchQuantity
      })
    },

    recordSerialAdvancement(params: {
      userId: string
      serialId: string
      jobId?: string
      pathId?: string
      fromStepId: string
      toStepId: string
    }): AuditEntry {
      return createEntry('serial_advanced', {
        userId: params.userId,
        serialId: params.serialId,
        jobId: params.jobId,
        pathId: params.pathId,
        fromStepId: params.fromStepId,
        toStepId: params.toStepId
      })
    },

    recordSerialCompletion(params: {
      userId: string
      serialId: string
      jobId?: string
      pathId?: string
      fromStepId: string
    }): AuditEntry {
      return createEntry('serial_completed', {
        userId: params.userId,
        serialId: params.serialId,
        jobId: params.jobId,
        pathId: params.pathId,
        fromStepId: params.fromStepId
      })
    },

    recordNoteCreation(params: {
      userId: string
      jobId: string
      pathId: string
      stepId: string
      serialId?: string
    }): AuditEntry {
      return createEntry('note_created', {
        userId: params.userId,
        jobId: params.jobId,
        pathId: params.pathId,
        stepId: params.stepId,
        serialId: params.serialId
      })
    },

    recordStepSkipped(params: {
      userId: string
      serialId: string
      jobId?: string
      pathId?: string
      stepId: string
    }): AuditEntry {
      return createEntry('step_skipped', {
        userId: params.userId,
        serialId: params.serialId,
        jobId: params.jobId,
        pathId: params.pathId,
        stepId: params.stepId,
      })
    },

    recordStepDeferred(params: {
      userId: string
      serialId: string
      jobId?: string
      pathId?: string
      stepId: string
    }): AuditEntry {
      return createEntry('step_deferred', {
        userId: params.userId,
        serialId: params.serialId,
        jobId: params.jobId,
        pathId: params.pathId,
        stepId: params.stepId,
      })
    },

    recordScrap(params: {
      userId: string
      serialId: string
      jobId: string
      pathId: string
      stepId: string
      metadata: { reason: string; explanation?: string }
    }): AuditEntry {
      return createEntry('serial_scrapped', {
        userId: params.userId,
        serialId: params.serialId,
        jobId: params.jobId,
        pathId: params.pathId,
        stepId: params.stepId,
        metadata: params.metadata
      })
    },

    recordForceComplete(params: {
      userId: string
      serialId: string
      jobId: string
      pathId: string
      metadata: { reason?: string; incompleteStepIds: string[] }
    }): AuditEntry {
      return createEntry('serial_force_completed', {
        userId: params.userId,
        serialId: params.serialId,
        jobId: params.jobId,
        pathId: params.pathId,
        metadata: params.metadata
      })
    },

    recordDeferredStepCompleted(params: {
      userId: string
      serialId: string
      jobId?: string
      pathId?: string
      stepId: string
    }): AuditEntry {
      return createEntry('deferred_step_completed', {
        userId: params.userId,
        serialId: params.serialId,
        jobId: params.jobId,
        pathId: params.pathId,
        stepId: params.stepId,
      })
    },

    recordStepWaived(params: {
      userId: string
      serialId: string
      jobId?: string
      pathId?: string
      stepId: string
      metadata: { reason: string; approverId: string }
    }): AuditEntry {
      return createEntry('step_waived', {
        userId: params.userId,
        serialId: params.serialId,
        jobId: params.jobId,
        pathId: params.pathId,
        stepId: params.stepId,
        metadata: params.metadata,
      })
    },

    recordStepOverrideCreated(params: {
      userId: string
      serialId: string
      jobId?: string
      pathId?: string
      stepId: string
      metadata?: { reason?: string }
    }): AuditEntry {
      return createEntry('step_override_created', {
        userId: params.userId,
        serialId: params.serialId,
        jobId: params.jobId,
        pathId: params.pathId,
        stepId: params.stepId,
        metadata: params.metadata,
      })
    },

    recordStepOverrideReversed(params: {
      userId: string
      serialId: string
      jobId?: string
      pathId?: string
      stepId: string
    }): AuditEntry {
      return createEntry('step_override_reversed', {
        userId: params.userId,
        serialId: params.serialId,
        jobId: params.jobId,
        pathId: params.pathId,
        stepId: params.stepId,
      })
    },

    recordBomEdited(params: {
      userId: string
      metadata: { bomId: string; changeDescription: string; versionNumber: number }
    }): AuditEntry {
      return createEntry('bom_edited', {
        userId: params.userId,
        metadata: params.metadata,
      })
    },

    getSerialAuditTrail(serialId: string): AuditEntry[] {
      return repos.audit.listBySerialId(serialId)
    },

    getJobAuditTrail(jobId: string): AuditEntry[] {
      return repos.audit.listByJobId(jobId)
    },

    listAuditEntries(options?: { limit?: number, offset?: number }): AuditEntry[] {
      return repos.audit.list(options)
    }
  }
}

export type AuditService = ReturnType<typeof createAuditService>
