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

  it('completedCount matches actual completed parts', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService } = ctx

    // 1. Create a job with a 4-step path and 5 parts
    const job = jobService.createJob({ name: 'Progress Job', goalQuantity: 5 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Assembly Line',
      goalQuantity: 5,
      steps: [
        { name: 'Cut' },
        { name: 'Weld' },
        { name: 'Paint' },
        { name: 'Inspect' },
      ],
    })

    const parts = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 5 },
      'operator1',
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

    // Part positions after setup:
    //   parts[0..2]: currentStepId = null (completed)
    //   parts[3]:    currentStepId = Paint step (at Paint)
    //   parts[4]:    currentStepId = Cut step (at Cut)

    // 3. Call getStepDistribution and getPathCompletedCount separately
    const distribution = pathService.getStepDistribution(path.id)
    const completedCount = pathService.getPathCompletedCount(path.id)

    // 4. Assert completedCount matches the 3 parts that finished all steps
    expect(completedCount).toBe(3)

    // 5. Assert per-step completedCount reflects parts that have passed each step
    //   Step 0 (Cut,     order=0): idx==-1 (3) + idx>0 → parts[3] at idx=2 (1) = 4
    //   Step 1 (Weld,    order=1): idx==-1 (3) + idx>1 → parts[3] at idx=2 (1) = 4
    //   Step 2 (Paint,   order=2): idx==-1 (3) + idx>2 → none                  = 3
    //   Step 3 (Inspect, order=3): idx==-1 (3) + idx>3 → none                  = 3
    expect(distribution).toHaveLength(4)
    const step0 = distribution.find(d => d.stepOrder === 0)!
    const step1 = distribution.find(d => d.stepOrder === 1)!
    const step2 = distribution.find(d => d.stepOrder === 2)!
    const step3 = distribution.find(d => d.stepOrder === 3)!

    expect(step0.completedCount).toBe(4)
    expect(step1.completedCount).toBe(4)
    expect(step2.completedCount).toBe(3)
    expect(step3.completedCount).toBe(3)

    // 6. Verify monotonicity: earlier steps have >= completedCount than later steps
    expect(step0.completedCount).toBeGreaterThanOrEqual(step1.completedCount)
    expect(step1.completedCount).toBeGreaterThanOrEqual(step2.completedCount)
    expect(step2.completedCount).toBeGreaterThanOrEqual(step3.completedCount)

    // 7. Last step's completedCount equals path-level completedCount
    expect(step3.completedCount).toBe(completedCount)

    // 8. Verify the old Issue #24 multiplication bug is still prevented:
    //    The sum of per-step completedCount is NOT N_steps × pathCompletedCount.
    //    Each step's completedCount is independently computed.
    const sumOfDistributionCompleted = distribution.reduce(
      (sum, d) => sum + d.completedCount,
      0,
    )
    // Old bug would produce: 4 steps × 3 completed = 12 (every step got the same value)
    // Fixed: sum is 4+4+3+3 = 14, which is NOT 4 × 3 = 12
    expect(sumOfDistributionCompleted).toBe(14)
    expect(sumOfDistributionCompleted).not.toBe(numSteps * completedCount)

    // 9. Verify distribution still tracks in-progress parts correctly
    // parts[4] is at step 0, parts[3] is at step 2
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

    partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 2 },
      'op1',
    )

    const completedCount = pathService.getPathCompletedCount(path.id)
    const distribution = pathService.getStepDistribution(path.id)

    expect(completedCount).toBe(0)
    expect(distribution.every(d => d.completedCount === 0)).toBe(true)
    // All 2 parts should be at step 0
    expect(distribution[0].partCount).toBe(2)
  })
})
