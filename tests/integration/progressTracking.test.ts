/**
 * Integration: Progress Tracking — Done Count Correctness
 *
 * Verifies that getStepDistribution() and getPathCompletedCount() return
 * correct, independent values after the path-done-total fix (Issue #24).
 *
 * The old bug: getStepDistribution() copied the path-level completed count
 * onto every StepDistribution entry, so the frontend sum (reduce) produced
 * N_steps × actual_completed.
 *
 * Validates: Requirements 1.2, 2.2, 3.2
 */
import { describe, it, afterEach, expect } from 'vitest'
import { createTestContext, type TestContext } from './helpers'

describe('Progress Tracking — Done Count Correctness', () => {
  let ctx: TestContext

  afterEach(() => ctx?.cleanup())

  it('completedCount matches actual completed parts and distribution entries are all 0', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService } = ctx

    // 1. Create a job with a 4-step path and 5 parts
    const job = jobService.createJob({ name: 'Progress Job', goalQuantity: 5 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Assembly Line',
      goalQuantity: 5,
      steps: [{ name: 'Cut' }, { name: 'Weld' }, { name: 'Paint' }, { name: 'Inspect' }],
    })

    const parts = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 5 },
      'operator1'
    )

    // 2. Advance 3 parts through ALL steps to completion (stepIndex -1)
    const numSteps = path.steps.length // 4
    for (let p = 0; p < 3; p++) {
      for (let s = 0; s < numSteps; s++) {
        partService.advancePart(parts[p].id, 'operator1')
      }
    }

    // Advance 1 part partially (to step 2 only)
    partService.advancePart(parts[3].id, 'operator1') // step 0 → 1
    partService.advancePart(parts[3].id, 'operator1') // step 1 → 2

    // Leave parts[4] at step 0

    // 3. Call getStepDistribution and getPathCompletedCount separately
    const distribution = pathService.getStepDistribution(path.id)
    const completedCount = pathService.getPathCompletedCount(path.id)

    // 4. Assert completedCount matches the 3 parts that finished all steps
    expect(completedCount).toBe(3)

    // 5. Assert ALL distribution entries have completedCount === 0
    for (const entry of distribution) {
      expect(entry.completedCount).toBe(0)
    }

    // 6. Assert the old bug (N × completedCount) no longer occurs
    const sumOfDistributionCompleted = distribution.reduce((sum, d) => sum + d.completedCount, 0)
    // Old bug would produce: 4 steps × 3 completed = 12
    // Fixed: sum is 0 (per-step completedCount is always 0)
    expect(sumOfDistributionCompleted).toBe(0)
    expect(sumOfDistributionCompleted).not.toBe(numSteps * completedCount)

    // 7. Verify distribution still tracks in-progress parts correctly
    expect(distribution).toHaveLength(4)
    // parts[4] is at step 0, parts[3] is at step 2
    const step0 = distribution.find((d) => d.stepOrder === 0)!
    const step2 = distribution.find((d) => d.stepOrder === 2)!
    expect(step0.partCount).toBe(1) // parts[4]
    expect(step2.partCount).toBe(1) // parts[3]
  })

  it('completedCount is 0 when no parts have finished all steps', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService } = ctx

    const job = jobService.createJob({ name: 'No Completions', goalQuantity: 2 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 2,
      steps: [{ name: 'Step A' }, { name: 'Step B' }, { name: 'Step C' }],
    })

    partService.batchCreateParts({ jobId: job.id, pathId: path.id, quantity: 2 }, 'op1')

    const completedCount = pathService.getPathCompletedCount(path.id)
    const distribution = pathService.getStepDistribution(path.id)

    expect(completedCount).toBe(0)
    expect(distribution.every((d) => d.completedCount === 0)).toBe(true)
    // All 2 parts should be at step 0
    expect(distribution[0].partCount).toBe(2)
  })
})
