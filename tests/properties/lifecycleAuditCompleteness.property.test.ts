/**
 * Property 10: Audit Trail Completeness for Lifecycle Actions
 *
 * For any lifecycle operation, verify exactly one audit entry with the
 * correct action type is created.
 *
 * **Validates: Requirements 1.8, 3.4, 5.6, 6.8, 8.5, 9.5, 10.6, 13.4, 15.1–15.7**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { createAuditService } from '../../server/services/auditService'
import type { AuditEntry, AuditAction } from '../../server/types/domain'

/**
 * In-memory audit repository for pure property testing.
 */
function createInMemoryAuditRepo() {
  const entries: AuditEntry[] = []
  return {
    create: (entry: AuditEntry) => { entries.push(entry); return entry },
    list: () => [...entries],
    listBySerialId: (serialId: string) => entries.filter(e => e.serialId === serialId),
    listByJobId: (jobId: string) => entries.filter(e => e.jobId === jobId),
    getEntries: () => entries,
  }
}

const arbUserId = fc.string({ minLength: 1, maxLength: 10 }).map(s => `user_${s}`)
const arbSerialId = fc.string({ minLength: 1, maxLength: 10 }).map(s => `sn_${s}`)
const arbJobId = fc.string({ minLength: 1, maxLength: 10 }).map(s => `job_${s}`)
const arbPathId = fc.string({ minLength: 1, maxLength: 10 }).map(s => `path_${s}`)
const arbStepId = fc.string({ minLength: 1, maxLength: 10 }).map(s => `step_${s}`)

describe('Property 10: Audit Trail Completeness for Lifecycle Actions', () => {
  it('scrap operation creates exactly one serial_scrapped audit entry', () => {
    fc.assert(
      fc.property(arbUserId, arbSerialId, arbJobId, arbPathId, arbStepId, (userId, serialId, jobId, pathId, stepId) => {
        const repo = createInMemoryAuditRepo()
        const auditService = createAuditService({ audit: repo })

        auditService.recordScrap({
          userId, serialId, jobId, pathId, stepId,
          metadata: { reason: 'damaged' },
        })

        const entries = repo.getEntries()
        const scrapEntries = entries.filter(e => e.action === 'serial_scrapped')
        expect(scrapEntries).toHaveLength(1)
        expect(scrapEntries[0]!.serialId).toBe(serialId)
        expect(scrapEntries[0]!.userId).toBe(userId)
      }),
      { numRuns: 100 },
    )
  })

  it('force-complete creates exactly one serial_force_completed audit entry', () => {
    fc.assert(
      fc.property(arbUserId, arbSerialId, arbJobId, arbPathId, (userId, serialId, jobId, pathId) => {
        const repo = createInMemoryAuditRepo()
        const auditService = createAuditService({ audit: repo })

        auditService.recordForceComplete({
          userId, serialId, jobId, pathId,
          metadata: { reason: 'urgent', incompleteStepIds: ['step_1'] },
        })

        const entries = repo.getEntries()
        const fcEntries = entries.filter(e => e.action === 'serial_force_completed')
        expect(fcEntries).toHaveLength(1)
        expect(fcEntries[0]!.serialId).toBe(serialId)
      }),
      { numRuns: 100 },
    )
  })

  it('each lifecycle action type produces exactly one audit entry of the correct type', () => {
    fc.assert(
      fc.property(arbUserId, arbSerialId, arbJobId, arbPathId, arbStepId, (userId, serialId, jobId, pathId, stepId) => {
        const repo = createInMemoryAuditRepo()
        const auditService = createAuditService({ audit: repo })

        // Perform each lifecycle operation
        const operations: { fn: () => void; expectedAction: AuditAction }[] = [
          {
            fn: () => auditService.recordScrap({ userId, serialId, jobId, pathId, stepId, metadata: { reason: 'damaged' } }),
            expectedAction: 'serial_scrapped',
          },
          {
            fn: () => auditService.recordForceComplete({ userId, serialId, jobId, pathId, metadata: { incompleteStepIds: [] } }),
            expectedAction: 'serial_force_completed',
          },
          {
            fn: () => auditService.recordStepOverrideCreated({ userId, serialId, jobId, pathId, stepId, metadata: { reason: 'fast-track' } }),
            expectedAction: 'step_override_created',
          },
          {
            fn: () => auditService.recordStepOverrideReversed({ userId, serialId, jobId, pathId, stepId }),
            expectedAction: 'step_override_reversed',
          },
          {
            fn: () => auditService.recordStepDeferred({ userId, serialId, jobId, pathId, stepId }),
            expectedAction: 'step_deferred',
          },
          {
            fn: () => auditService.recordStepSkipped({ userId, serialId, jobId, pathId, stepId }),
            expectedAction: 'step_skipped',
          },
          {
            fn: () => auditService.recordDeferredStepCompleted({ userId, serialId, jobId, pathId, stepId }),
            expectedAction: 'deferred_step_completed',
          },
          {
            fn: () => auditService.recordStepWaived({ userId, serialId, jobId, pathId, stepId, metadata: { reason: 'waiver', approverId: userId } }),
            expectedAction: 'step_waived',
          },
          {
            fn: () => auditService.recordBomEdited({ userId, metadata: { bomId: 'bom_1', changeDescription: 'edit', versionNumber: 1 } }),
            expectedAction: 'bom_edited',
          },
        ]

        for (const op of operations) {
          const countBefore = repo.getEntries().filter(e => e.action === op.expectedAction).length
          op.fn()
          const countAfter = repo.getEntries().filter(e => e.action === op.expectedAction).length
          expect(countAfter - countBefore).toBe(1)
        }
      }),
      { numRuns: 100 },
    )
  })
})
