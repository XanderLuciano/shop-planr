/**
 * Feature: serial-to-part-id-rename
 * Property 2: Audit Actions Use Renamed Values
 *
 * For any lifecycle operation (create parts, advance part, complete part,
 * scrap part, force-complete part), the resulting audit entry's `action` field
 * should use the `part_`-prefixed string (e.g., `part_created`, `part_advanced`,
 * `part_completed`, `part_scrapped`, `part_force_completed`) rather than the old
 * `serial_`-prefixed string.
 *
 * **Validates: Requirements 2.7, 4.5**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { createAuditService } from '../../server/services/auditService'
import type { AuditEntry } from '../../server/types/domain'
import type { AuditRepository } from '../../server/repositories/interfaces/auditRepository'

/**
 * In-memory audit repository that captures created entries for inspection.
 */
function createInMemoryAuditRepo(): AuditRepository & { entries: AuditEntry[] } {
  const entries: AuditEntry[] = []
  return {
    entries,
    create(entry: AuditEntry): AuditEntry {
      entries.push(entry)
      return entry
    },
    listByPartId: () => [],
    listByJobId: () => [],
    list: () => [],
  }
}

// ---- Arbitraries ----

const arbUserId = () => fc.stringMatching(/^user_[a-z0-9]{3,10}$/)
const arbId = () => fc.stringMatching(/^[a-z0-9_]{3,15}$/)

const DEPRECATED_SERIAL_ACTIONS = [
  'serial_created',
  'serial_advanced',
  'serial_completed',
  'serial_scrapped',
  'serial_force_completed',
]

const _EXPECTED_PART_ACTIONS: Record<string, string> = {
  recordPartCreation: 'part_created',
  recordPartAdvancement: 'part_advanced',
  recordPartCompletion: 'part_completed',
  recordScrap: 'part_scrapped',
  recordForceComplete: 'part_force_completed',
}

describe('Property 2: Audit Actions Use Renamed Values', () => {
  it('recordPartCreation produces action "part_created" for any valid input', () => {
    fc.assert(
      fc.property(
        arbUserId(),
        arbId(),
        arbId(),
        fc.integer({ min: 1, max: 500 }),
        (userId, jobId, pathId, batchQuantity) => {
          const repo = createInMemoryAuditRepo()
          const service = createAuditService({ audit: repo })

          const entry = service.recordPartCreation({ userId, jobId, pathId, batchQuantity })

          expect(entry.action).toBe('part_created')
          expect(DEPRECATED_SERIAL_ACTIONS).not.toContain(entry.action)
          expect(repo.entries).toHaveLength(1)
          expect(repo.entries[0].action).toBe('part_created')
        },
      ),
      { numRuns: 100 },
    )
  })

  it('recordPartAdvancement produces action "part_advanced" for any valid input', () => {
    fc.assert(
      fc.property(
        arbUserId(),
        arbId(),
        arbId(),
        arbId(),
        arbId(),
        arbId(),
        (userId, partId, jobId, pathId, fromStepId, toStepId) => {
          const repo = createInMemoryAuditRepo()
          const service = createAuditService({ audit: repo })

          const entry = service.recordPartAdvancement({
            userId,
            partId,
            jobId,
            pathId,
            fromStepId,
            toStepId,
          })

          expect(entry.action).toBe('part_advanced')
          expect(DEPRECATED_SERIAL_ACTIONS).not.toContain(entry.action)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('recordPartCompletion produces action "part_completed" for any valid input', () => {
    fc.assert(
      fc.property(
        arbUserId(),
        arbId(),
        arbId(),
        arbId(),
        arbId(),
        (userId, partId, jobId, pathId, fromStepId) => {
          const repo = createInMemoryAuditRepo()
          const service = createAuditService({ audit: repo })

          const entry = service.recordPartCompletion({
            userId,
            partId,
            jobId,
            pathId,
            fromStepId,
          })

          expect(entry.action).toBe('part_completed')
          expect(DEPRECATED_SERIAL_ACTIONS).not.toContain(entry.action)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('recordScrap produces action "part_scrapped" for any valid input', () => {
    fc.assert(
      fc.property(
        arbUserId(),
        arbId(),
        arbId(),
        arbId(),
        arbId(),
        fc.constantFrom('out_of_tolerance', 'process_defect', 'damaged', 'operator_error', 'other'),
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
        (userId, partId, jobId, pathId, stepId, reason, explanation) => {
          const repo = createInMemoryAuditRepo()
          const service = createAuditService({ audit: repo })

          const entry = service.recordScrap({
            userId,
            partId,
            jobId,
            pathId,
            stepId,
            metadata: { reason, explanation },
          })

          expect(entry.action).toBe('part_scrapped')
          expect(DEPRECATED_SERIAL_ACTIONS).not.toContain(entry.action)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('recordForceComplete produces action "part_force_completed" for any valid input', () => {
    fc.assert(
      fc.property(
        arbUserId(),
        arbId(),
        arbId(),
        arbId(),
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
        fc.array(arbId(), { minLength: 1, maxLength: 10 }),
        (userId, partId, jobId, pathId, reason, incompleteStepIds) => {
          const repo = createInMemoryAuditRepo()
          const service = createAuditService({ audit: repo })

          const entry = service.recordForceComplete({
            userId,
            partId,
            jobId,
            pathId,
            metadata: { reason, incompleteStepIds },
          })

          expect(entry.action).toBe('part_force_completed')
          expect(DEPRECATED_SERIAL_ACTIONS).not.toContain(entry.action)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('no lifecycle operation produces a deprecated serial_-prefixed action', () => {
    fc.assert(
      fc.property(
        arbUserId(),
        arbId(),
        arbId(),
        arbId(),
        arbId(),
        arbId(),
        fc.integer({ min: 1, max: 100 }),
        (userId, partId, jobId, pathId, stepId1, stepId2, batchQty) => {
          const repo = createInMemoryAuditRepo()
          const service = createAuditService({ audit: repo })

          service.recordPartCreation({ userId, jobId, pathId, batchQuantity: batchQty })
          service.recordPartAdvancement({ userId, partId, jobId, pathId, fromStepId: stepId1, toStepId: stepId2 })
          service.recordPartCompletion({ userId, partId, jobId, pathId, fromStepId: stepId1 })
          service.recordScrap({ userId, partId, jobId, pathId, stepId: stepId1, metadata: { reason: 'damaged' } })
          service.recordForceComplete({ userId, partId, jobId, pathId, metadata: { incompleteStepIds: [stepId1] } })

          for (const entry of repo.entries) {
            expect(DEPRECATED_SERIAL_ACTIONS).not.toContain(entry.action)
            // All lifecycle actions should start with 'part_'
            if (['part_created', 'part_advanced', 'part_completed', 'part_scrapped', 'part_force_completed'].includes(entry.action)) {
              expect(entry.action).toMatch(/^part_/)
            }
          }

          expect(repo.entries).toHaveLength(5)
        },
      ),
      { numRuns: 100 },
    )
  })
})
