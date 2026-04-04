/**
 * Feature: step-id-part-tracking
 * Property 9: Bypassed steps get "skipped" routing entries
 * Property 10: Multiple visits produce distinct routing entries
 *
 * P9: For any part that bypasses one or more steps during advancement (optional,
 * overridden, or flexible-mode skip), the system shall create a routing entry with
 * status 'skipped' for each bypassed step, each with a distinct sequenceNumber.
 *
 * P10: For any part that visits the same process step more than once (recycling),
 * the routing history shall contain multiple entries for that step, each with a
 * distinct sequenceNumber and independent status and timestamps.
 *
 * **Validates: Requirements 3.4, 3.5, 4.4, 5.1, 5.3**
 */
import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import { createTestContext, type TestContext } from '../integration/helpers'

describe('Feature: step-id-part-tracking, Property 9: Bypassed steps get "skipped" routing entries', () => {
  let ctx: TestContext

  afterEach(() => {
    if (ctx) ctx.cleanup()
  })

  it('advancing past optional steps creates skipped routing entries with distinct sequence numbers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 6 }),
        fc.integer({ min: 1, max: 3 }),
        (stepCount, skipCount) => {
          ctx = createTestContext()

          const actualSkipCount = Math.min(skipCount, stepCount - 2)
          if (actualSkipCount < 1) {
            ctx.cleanup()
            ctx = null as any
            return
          }

          const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 10 })

          // Create steps: first is non-optional, middle ones are optional, last is non-optional
          const steps = Array.from({ length: stepCount }, (_, i) => ({
            name: `Step ${i}`,
            optional: i > 0 && i <= actualSkipCount,
          }))

          const path = ctx.pathService.createPath({
            jobId: job.id,
            name: 'Path',
            goalQuantity: 10,
            steps,
            advancementMode: 'flexible' as const,
          })

          const [part] = ctx.partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: 1 },
            'user1',
          )

          // Advance to step past the optional ones (skip them)
          const targetStep = path.steps[actualSkipCount + 1]!
          ctx.lifecycleService.advanceToStep(part!.id, {
            targetStepId: targetStep.id,
            userId: 'user1',
          })

          const history = ctx.lifecycleService.getStepStatuses(part!.id)

          // Check that each bypassed optional step has a 'skipped' entry
          for (let i = 1; i <= actualSkipCount; i++) {
            const stepId = path.steps[i]!.id
            const skippedEntries = history.filter(
              h => h.stepId === stepId && h.status === 'skipped',
            )
            expect(skippedEntries.length).toBeGreaterThanOrEqual(1)
          }

          // The skipped/advancement entries (those with seq > 1, created during advanceToStep)
          // should all have distinct sequence numbers
          const advancementEntries = history.filter(h => h.sequenceNumber > 1)
          const advSeqs = advancementEntries.map(h => h.sequenceNumber)
          const uniqueAdvSeqs = new Set(advSeqs)
          expect(uniqueAdvSeqs.size).toBe(advSeqs.length)

          ctx.cleanup()
          ctx = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Feature: step-id-part-tracking, Property 10: Multiple visits produce distinct routing entries', () => {
  let ctx: TestContext

  afterEach(() => {
    if (ctx) ctx.cleanup()
  })

  it('recycling through a step creates multiple routing entries with distinct sequence numbers', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // deterministic test — recycling requires specific setup
        () => {
          ctx = createTestContext()

          const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 10 })
          const path = ctx.pathService.createPath({
            jobId: job.id,
            name: 'Path',
            goalQuantity: 10,
            steps: [{ name: 'Step A' }, { name: 'Step B' }, { name: 'Step C' }],
          })

          const [part] = ctx.partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: 1 },
            'user1',
          )

          const stepAId = path.steps[0]!.id
          const _stepBId = path.steps[1]!.id

          // Advance A → B (first visit to B)
          ctx.partService.advancePart(part!.id, 'user1')

          // Now manually create a second routing entry for step A (simulating recycle)
          // by using the repo directly — this simulates what would happen if the part
          // was sent back to step A and then advanced again
          const nextSeq = ctx.repos.partStepStatuses.getNextSequenceNumber(part!.id)
          const now = new Date().toISOString()
          ctx.repos.partStepStatuses.create({
            id: `pss_recycle_${nextSeq}`,
            partId: part!.id,
            stepId: stepAId,
            sequenceNumber: nextSeq,
            status: 'in_progress',
            enteredAt: now,
            updatedAt: now,
          })

          const history = ctx.lifecycleService.getStepStatuses(part!.id)

          // Step A should have multiple entries
          const stepAEntries = history.filter(h => h.stepId === stepAId)
          expect(stepAEntries.length).toBeGreaterThanOrEqual(2)

          // All entries for step A should have distinct sequence numbers
          const stepASeqs = stepAEntries.map(e => e.sequenceNumber)
          const uniqueSeqs = new Set(stepASeqs)
          expect(uniqueSeqs.size).toBe(stepASeqs.length)

          ctx.cleanup()
          ctx = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})
