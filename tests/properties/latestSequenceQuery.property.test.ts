/**
 * Feature: step-id-part-tracking
 * Property 11: Latest sequence number query returns most recent visit
 *
 * For any part with multiple routing entries for the same step,
 * `getLatestByPartAndStep(partId, stepId)` shall return the entry with the
 * highest sequenceNumber for that combination.
 *
 * **Validates: Requirements 6.3**
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fc from 'fast-check'
import { createReusableTestContext, savepoint, rollback, type TestContext } from './helpers'
import { generateId } from '../../server/utils/idGenerator'

describe('Feature: step-id-part-tracking, Property 11: Latest sequence number query returns most recent visit', () => {
  let ctx: TestContext

  beforeAll(() => { ctx = createReusableTestContext() })
  afterAll(() => { ctx?.cleanup() })

  it('getLatestByPartAndStep returns the entry with the highest sequenceNumber', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }),
        (extraEntries) => {
          savepoint(ctx.db)
          try {
            const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 10 })
            const path = ctx.pathService.createPath({
              jobId: job.id,
              name: 'Path',
              goalQuantity: 10,
              steps: [{ name: 'Step A' }, { name: 'Step B' }],
            })

            const [part] = ctx.partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: 1 },
              'user1',
            )

            const stepAId = path.steps[0]!.id

            // Create additional routing entries for step A (simulating recycling)
            let maxSeq = 0
            for (let i = 0; i < extraEntries; i++) {
              const nextSeq = ctx.repos.partStepStatuses.getNextSequenceNumber(part!.id)
              maxSeq = nextSeq
              const now = new Date().toISOString()
              ctx.repos.partStepStatuses.create({
                id: generateId('pss'),
                partId: part!.id,
                stepId: stepAId,
                sequenceNumber: nextSeq,
                status: i === extraEntries - 1 ? 'in_progress' : 'completed',
                enteredAt: now,
                completedAt: i === extraEntries - 1 ? undefined : now,
                updatedAt: now,
              })
            }

            // Query latest
            const latest = ctx.repos.partStepStatuses.getLatestByPartAndStep(part!.id, stepAId)

            expect(latest).not.toBeNull()
            expect(latest!.sequenceNumber).toBe(maxSeq)

            // Verify it's actually the highest
            const allEntries = ctx.lifecycleService.getStepStatuses(part!.id)
              .filter(h => h.stepId === stepAId)
            const maxActual = Math.max(...allEntries.map(e => e.sequenceNumber))
            expect(latest!.sequenceNumber).toBe(maxActual)
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
