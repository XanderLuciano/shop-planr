/**
 * Integration: Progress Tracking
 *
 * Advance parts → verify percentages → test >100%.
 * Validates: Requirements 1.3, 1.5, 7.1, 7.5, 7.6
 */
import { describe, it, afterEach, expect } from 'vitest'
import { createTestContext, type TestContext } from './helpers'

describe('Progress Tracking Integration', () => {
  let ctx: TestContext

  afterEach(() => ctx?.cleanup())

  it('complete 3 of 5 → 60%, complete all 5 → 100%', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService } = ctx

    const job = jobService.createJob({ name: 'Progress Job', goalQuantity: 5 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 5,
      steps: [{ name: 'OP1' }] // single-step path: advance once → completed
    })

    const parts = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 5 },
      'op1'
    )

    // Complete 3 parts
    for (let i = 0; i < 3; i++) {
      partService.advancePart(parts[i].id, 'op1')
    }

    let progress = jobService.computeJobProgress(job.id)
    expect(progress.completedParts).toBe(3)
    expect(progress.progressPercent).toBe(60)

    // Complete remaining 2
    for (let i = 3; i < 5; i++) {
      partService.advancePart(parts[i].id, 'op1')
    }

    progress = jobService.computeJobProgress(job.id)
    expect(progress.completedParts).toBe(5)
    expect(progress.progressPercent).toBe(100)
  })

  it('over-production: create more parts and complete → >100%', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService } = ctx

    const job = jobService.createJob({ name: 'Over-Prod Job', goalQuantity: 5 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 5,
      steps: [{ name: 'OP1' }]
    })

    // Create and complete 5
    const batch1 = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 5 },
      'op1'
    )
    for (const part of batch1) {
      partService.advancePart(part.id, 'op1')
    }

    // Create 2 more and complete them
    const batch2 = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 2 },
      'op1'
    )
    for (const part of batch2) {
      partService.advancePart(part.id, 'op1')
    }

    const progress = jobService.computeJobProgress(job.id)
    expect(progress.completedParts).toBe(7)
    expect(progress.totalParts).toBe(7)
    expect(progress.progressPercent).toBe(140) // 7/5 * 100
  })

  it('change goal → recalculates progress', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService } = ctx

    const job = jobService.createJob({ name: 'Goal Change Job', goalQuantity: 5 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 5,
      steps: [{ name: 'OP1' }]
    })

    const parts = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 5 },
      'op1'
    )

    // Complete 3
    for (let i = 0; i < 3; i++) {
      partService.advancePart(parts[i].id, 'op1')
    }

    // Progress at goal=5: 60%
    let progress = jobService.computeJobProgress(job.id)
    expect(progress.progressPercent).toBe(60)

    // Change goal to 10
    jobService.updateJob(job.id, { goalQuantity: 10 })
    progress = jobService.computeJobProgress(job.id)
    expect(progress.goalQuantity).toBe(10)
    expect(progress.progressPercent).toBe(30) // 3/10 * 100

    // Change goal to 3 → over 100%
    jobService.updateJob(job.id, { goalQuantity: 3 })
    progress = jobService.computeJobProgress(job.id)
    expect(progress.progressPercent).toBe(100) // 3/3 * 100
  })

  it('multi-path progress rolls up to job level', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService } = ctx

    const job = jobService.createJob({ name: 'Multi-Path Job', goalQuantity: 10 })

    const pathA = pathService.createPath({
      jobId: job.id,
      name: 'Path A',
      goalQuantity: 6,
      steps: [{ name: 'OP1' }]
    })
    const pathB = pathService.createPath({
      jobId: job.id,
      name: 'Path B',
      goalQuantity: 4,
      steps: [{ name: 'OP1' }, { name: 'OP2' }]
    })

    // Create 6 on A, complete 4
    const partsA = partService.batchCreateParts(
      { jobId: job.id, pathId: pathA.id, quantity: 6 },
      'op1'
    )
    for (let i = 0; i < 4; i++) {
      partService.advancePart(partsA[i].id, 'op1')
    }

    // Create 4 on B, advance all to step 1, complete 2
    const partsB = partService.batchCreateParts(
      { jobId: job.id, pathId: pathB.id, quantity: 4 },
      'op1'
    )
    for (const part of partsB) {
      partService.advancePart(part.id, 'op1')
    }
    for (let i = 0; i < 2; i++) {
      partService.advancePart(partsB[i].id, 'op1')
    }

    const progress = jobService.computeJobProgress(job.id)
    expect(progress.totalParts).toBe(10)
    expect(progress.completedParts).toBe(6) // 4 from A + 2 from B
    expect(progress.inProgressParts).toBe(4)
    expect(progress.progressPercent).toBe(60) // 6/10 * 100
  })
})
