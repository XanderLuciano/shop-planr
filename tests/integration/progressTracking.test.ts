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
    const { jobService, pathService, serialService } = ctx

    const job = jobService.createJob({ name: 'Progress Job', goalQuantity: 5 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 5,
      steps: [{ name: 'OP1' }] // single-step path: advance once → completed
    })

    const serials = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 5 },
      'op1'
    )

    // Complete 3 serials
    for (let i = 0; i < 3; i++) {
      serialService.advanceSerial(serials[i].id, 'op1')
    }

    let progress = jobService.computeJobProgress(job.id)
    expect(progress.completedSerials).toBe(3)
    expect(progress.progressPercent).toBe(60)

    // Complete remaining 2
    for (let i = 3; i < 5; i++) {
      serialService.advanceSerial(serials[i].id, 'op1')
    }

    progress = jobService.computeJobProgress(job.id)
    expect(progress.completedSerials).toBe(5)
    expect(progress.progressPercent).toBe(100)
  })

  it('over-production: create more SNs and complete → >100%', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService } = ctx

    const job = jobService.createJob({ name: 'Over-Prod Job', goalQuantity: 5 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 5,
      steps: [{ name: 'OP1' }]
    })

    // Create and complete 5
    const batch1 = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 5 },
      'op1'
    )
    for (const sn of batch1) {
      serialService.advanceSerial(sn.id, 'op1')
    }

    // Create 2 more and complete them
    const batch2 = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 2 },
      'op1'
    )
    for (const sn of batch2) {
      serialService.advanceSerial(sn.id, 'op1')
    }

    const progress = jobService.computeJobProgress(job.id)
    expect(progress.completedSerials).toBe(7)
    expect(progress.totalSerials).toBe(7)
    expect(progress.progressPercent).toBe(140) // 7/5 * 100
  })

  it('change goal → recalculates progress', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService } = ctx

    const job = jobService.createJob({ name: 'Goal Change Job', goalQuantity: 5 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 5,
      steps: [{ name: 'OP1' }]
    })

    const serials = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 5 },
      'op1'
    )

    // Complete 3
    for (let i = 0; i < 3; i++) {
      serialService.advanceSerial(serials[i].id, 'op1')
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
    const { jobService, pathService, serialService } = ctx

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
    const serialsA = serialService.batchCreateSerials(
      { jobId: job.id, pathId: pathA.id, quantity: 6 },
      'op1'
    )
    for (let i = 0; i < 4; i++) {
      serialService.advanceSerial(serialsA[i].id, 'op1')
    }

    // Create 4 on B, advance all to step 1, complete 2
    const serialsB = serialService.batchCreateSerials(
      { jobId: job.id, pathId: pathB.id, quantity: 4 },
      'op1'
    )
    for (const sn of serialsB) {
      serialService.advanceSerial(sn.id, 'op1')
    }
    for (let i = 0; i < 2; i++) {
      serialService.advanceSerial(serialsB[i].id, 'op1')
    }

    const progress = jobService.computeJobProgress(job.id)
    expect(progress.totalSerials).toBe(10)
    expect(progress.completedSerials).toBe(6) // 4 from A + 2 from B
    expect(progress.inProgressSerials).toBe(4)
    expect(progress.progressPercent).toBe(60) // 6/10 * 100
  })
})
