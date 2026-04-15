import type { AuditRepository } from '../repositories/interfaces/auditRepository'
import type { AuditAction, AuditEntry } from '../types/domain'
import { generateId } from '../utils/idGenerator'

/** Helper: resolve partId from params that may use either partId or deprecated serialId */
function resolvePartId(params: { partId?: string, serialId?: string }): string | undefined {
  return params.partId ?? params.serialId
}

export function createAuditService(repos: { audit: AuditRepository }) {
  function createEntry(
    action: AuditAction,
    fields: Omit<AuditEntry, 'id' | 'action' | 'timestamp'>,
  ): AuditEntry {
    return repos.audit.create({
      id: generateId('aud'),
      action,
      timestamp: new Date().toISOString(),
      ...fields,
    })
  }

  return {
    recordCertAttachment(params: {
      userId: string
      partId?: string
      /** @deprecated Use `partId` instead. */
      serialId?: string
      certId: string
      stepId: string
      jobId?: string
      pathId?: string
    }): AuditEntry {
      return createEntry('cert_attached', {
        userId: params.userId,
        partId: resolvePartId(params),
        certId: params.certId,
        stepId: params.stepId,
        jobId: params.jobId,
        pathId: params.pathId,
      })
    },

    recordPartCreation(params: {
      userId: string
      jobId: string
      pathId: string
      batchQuantity: number
    }): AuditEntry {
      return createEntry('part_created', {
        userId: params.userId,
        jobId: params.jobId,
        pathId: params.pathId,
        batchQuantity: params.batchQuantity,
      })
    },

    recordPartAdvancement(params: {
      userId: string
      partId?: string
      /** @deprecated Use `partId` instead. */
      serialId?: string
      jobId?: string
      pathId?: string
      fromStepId: string
      toStepId: string
    }): AuditEntry {
      return createEntry('part_advanced', {
        userId: params.userId,
        partId: resolvePartId(params),
        jobId: params.jobId,
        pathId: params.pathId,
        fromStepId: params.fromStepId,
        toStepId: params.toStepId,
      })
    },

    recordPartCompletion(params: {
      userId: string
      partId?: string
      /** @deprecated Use `partId` instead. */
      serialId?: string
      jobId?: string
      pathId?: string
      fromStepId: string
    }): AuditEntry {
      return createEntry('part_completed', {
        userId: params.userId,
        partId: resolvePartId(params),
        jobId: params.jobId,
        pathId: params.pathId,
        fromStepId: params.fromStepId,
      })
    },

    recordNoteCreation(params: {
      userId: string
      jobId: string
      pathId: string
      stepId: string
      partId?: string
      /** @deprecated Use `partId` instead. */
      serialId?: string
    }): AuditEntry {
      return createEntry('note_created', {
        userId: params.userId,
        jobId: params.jobId,
        pathId: params.pathId,
        stepId: params.stepId,
        partId: resolvePartId(params),
      })
    },

    recordStepSkipped(params: {
      userId: string
      partId?: string
      /** @deprecated Use `partId` instead. */
      serialId?: string
      jobId?: string
      pathId?: string
      stepId: string
    }): AuditEntry {
      return createEntry('step_skipped', {
        userId: params.userId,
        partId: resolvePartId(params),
        jobId: params.jobId,
        pathId: params.pathId,
        stepId: params.stepId,
      })
    },

    recordStepDeferred(params: {
      userId: string
      partId?: string
      /** @deprecated Use `partId` instead. */
      serialId?: string
      jobId?: string
      pathId?: string
      stepId: string
    }): AuditEntry {
      return createEntry('step_deferred', {
        userId: params.userId,
        partId: resolvePartId(params),
        jobId: params.jobId,
        pathId: params.pathId,
        stepId: params.stepId,
      })
    },

    recordScrap(params: {
      userId: string
      partId?: string
      /** @deprecated Use `partId` instead. */
      serialId?: string
      jobId: string
      pathId: string
      stepId: string
      metadata: { reason: string, explanation?: string }
    }): AuditEntry {
      return createEntry('part_scrapped', {
        userId: params.userId,
        partId: resolvePartId(params),
        jobId: params.jobId,
        pathId: params.pathId,
        stepId: params.stepId,
        metadata: params.metadata,
      })
    },

    recordForceComplete(params: {
      userId: string
      partId?: string
      /** @deprecated Use `partId` instead. */
      serialId?: string
      jobId: string
      pathId: string
      metadata: { reason?: string, incompleteStepIds: string[] }
    }): AuditEntry {
      return createEntry('part_force_completed', {
        userId: params.userId,
        partId: resolvePartId(params),
        jobId: params.jobId,
        pathId: params.pathId,
        metadata: params.metadata,
      })
    },

    recordDeferredStepCompleted(params: {
      userId: string
      partId?: string
      /** @deprecated Use `partId` instead. */
      serialId?: string
      jobId?: string
      pathId?: string
      stepId: string
    }): AuditEntry {
      return createEntry('deferred_step_completed', {
        userId: params.userId,
        partId: resolvePartId(params),
        jobId: params.jobId,
        pathId: params.pathId,
        stepId: params.stepId,
      })
    },

    recordStepWaived(params: {
      userId: string
      partId?: string
      /** @deprecated Use `partId` instead. */
      serialId?: string
      jobId?: string
      pathId?: string
      stepId: string
      metadata: { reason: string, approverId: string }
    }): AuditEntry {
      return createEntry('step_waived', {
        userId: params.userId,
        partId: resolvePartId(params),
        jobId: params.jobId,
        pathId: params.pathId,
        stepId: params.stepId,
        metadata: params.metadata,
      })
    },

    recordStepOverrideCreated(params: {
      userId: string
      partId?: string
      /** @deprecated Use `partId` instead. */
      serialId?: string
      jobId?: string
      pathId?: string
      stepId: string
      metadata?: { reason?: string }
    }): AuditEntry {
      return createEntry('step_override_created', {
        userId: params.userId,
        partId: resolvePartId(params),
        jobId: params.jobId,
        pathId: params.pathId,
        stepId: params.stepId,
        metadata: params.metadata,
      })
    },

    recordStepOverrideReversed(params: {
      userId: string
      partId?: string
      /** @deprecated Use `partId` instead. */
      serialId?: string
      jobId?: string
      pathId?: string
      stepId: string
    }): AuditEntry {
      return createEntry('step_override_reversed', {
        userId: params.userId,
        partId: resolvePartId(params),
        jobId: params.jobId,
        pathId: params.pathId,
        stepId: params.stepId,
      })
    },

    recordPathDeletion(params: {
      userId: string
      pathId: string
      jobId: string
      metadata: { pathName: string, deletedPartIds: string[], deletedPartCount: number }
    }): AuditEntry {
      return createEntry('path_deleted', {
        userId: params.userId,
        pathId: params.pathId,
        jobId: params.jobId,
        metadata: params.metadata,
      })
    },

    recordPartDeletion(params: {
      userId: string
      partId: string
      jobId: string
      pathId: string
      metadata?: Record<string, unknown>
    }): AuditEntry {
      return createEntry('part_deleted', {
        userId: params.userId,
        partId: params.partId,
        jobId: params.jobId,
        pathId: params.pathId,
        metadata: params.metadata,
      })
    },

    recordTagDeletion(params: {
      userId: string
      tagId: string
      metadata: { tagName: string, affectedJobIds: string[], affectedJobCount: number }
    }): AuditEntry {
      return createEntry('tag_deleted', {
        userId: params.userId,
        metadata: { ...params.metadata, tagId: params.tagId },
      })
    },

    recordBomEdited(params: {
      userId: string
      metadata: { bomId: string, changeDescription: string, versionNumber: number }
    }): AuditEntry {
      return createEntry('bom_edited', {
        userId: params.userId,
        metadata: params.metadata,
      })
    },

    getPartAuditTrail(partId: string): AuditEntry[] {
      return repos.audit.listByPartId(partId)
    },

    getJobAuditTrail(jobId: string): AuditEntry[] {
      return repos.audit.listByJobId(jobId)
    },

    listAuditEntries(options?: { limit?: number, offset?: number }): AuditEntry[] {
      return repos.audit.list(options)
    },

    // ---- Backward-compatible aliases (deprecated) ----

    /** @deprecated Use `recordPartCreation` instead. */
    recordSerialCreation(params: {
      userId: string
      jobId: string
      pathId: string
      batchQuantity: number
    }): AuditEntry {
      return this.recordPartCreation(params)
    },

    /** @deprecated Use `recordPartAdvancement` instead. */
    recordSerialAdvancement(params: {
      userId: string
      serialId: string
      jobId?: string
      pathId?: string
      fromStepId: string
      toStepId: string
    }): AuditEntry {
      return this.recordPartAdvancement({ ...params, partId: params.serialId })
    },

    /** @deprecated Use `recordPartCompletion` instead. */
    recordSerialCompletion(params: {
      userId: string
      serialId: string
      jobId?: string
      pathId?: string
      fromStepId: string
    }): AuditEntry {
      return this.recordPartCompletion({ ...params, partId: params.serialId })
    },

    /** @deprecated Use `getPartAuditTrail` instead. */
    getSerialAuditTrail(serialId: string): AuditEntry[] {
      return this.getPartAuditTrail(serialId)
    },
  }
}

export type AuditService = ReturnType<typeof createAuditService>
