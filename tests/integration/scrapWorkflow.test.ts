/**
 * Integration: Scrap Workflow
 *
 * Create job → create serials → scrap one → verify progress excludes scrapped
 * → verify advancement blocked on scrapped SN → verify audit entry.
 * Validates: Requirements 3.1, 3.4, 3.5, 3.6, 3.8
 */
import { describe, it, afterEach, expect } from 'vitest'
import { createTestContext, type TestContext } from './helpers'

describe('Scrap Workflow Integration', () => {
  let ctx: TestContext

  afterEach(() => ctx?.cleanup())

  it('full scrap flow: create → scrap → verify progress → verify blocked → verify audit', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService, lifecycleService, auditService } = ctx

    // 1. Create job with goal qty 5
    const job = jobService.createJob({ name: 'Scrap Test Job', goalQuantity: 5 })

    // 2. Create path with 3 steps
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Scrap Path',
      goalQuantity: 5,
      steps: [{ name: 'Cut' }, { name: 'Weld' }, { name: 'Inspect' }],
    })

    // 3. Create 5 serials
    const serials = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 5 },
      'operator1'
    )
    expect(serials).toHaveLength(5)

    // 4. Advance first 2 serials to completion
    for (let i = 0; i < 2; i++) {
      serialService.advanceSerial(serials[i].id, 'operator1') // step 0 → 1
      serialService.advanceSerial(serials[i].id, 'operator1') // step 1 → 2
      serialService.advanceSerial(serials[i].id, 'operator1') // step 2 → completed
    }

    // 5. Scrap the 3rd serial
    const scrapped = lifecycleService.scrapSerial(serials[2].id, {
      reason: 'damaged',
      userId: 'operator1',
    })
    expect(scrapped.status).toBe('scrapped')
    expect(scrapped.scrapReason).toBe('damaged')

    // 6. Verify progress excludes scrapped serial
    const progress = jobService.computeJobProgress(job.id)
    expect(progress.totalSerials).toBe(5)
    expect(progress.completedSerials).toBe(2)
    expect(progress.scrappedSerials).toBe(1)
    expect(progress.inProgressSerials).toBe(2)
    // progressPercent = 2 / (5 - 1) * 100 = 50
    expect(progress.progressPercent).toBe(50)

    // 7. Verify advancement blocked on scrapped SN
    expect(() => serialService.advanceSerial(serials[2].id, 'operator1'))
      .toThrow()

    // 8. Verify re-scrap blocked
    expect(() =>
      lifecycleService.scrapSerial(serials[2].id, {
        reason: 'operator_error',
        userId: 'operator1',
      })
    ).toThrow(/already scrapped/)

    // 9. Verify audit entry exists for scrap
    const auditTrail = auditService.getSerialAuditTrail(serials[2].id)
    const scrapEntry = auditTrail.find(e => e.action === 'serial_scrapped')
    expect(scrapEntry).toBeDefined()
    expect(scrapEntry!.serialId).toBe(serials[2].id)
    expect(scrapEntry!.metadata).toMatchObject({ reason: 'damaged' })
  })

  it('scrap with "other" reason requires explanation', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService, lifecycleService } = ctx

    const job = jobService.createJob({ name: 'Other Reason Test', goalQuantity: 2 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 2,
      steps: [{ name: 'Step1' }],
    })
    const serials = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 2 },
      'user1'
    )

    // Without explanation → should throw
    expect(() =>
      lifecycleService.scrapSerial(serials[0].id, {
        reason: 'other',
        userId: 'user1',
      })
    ).toThrow(/explanation/i)

    // With explanation → should succeed
    const scrapped = lifecycleService.scrapSerial(serials[1].id, {
      reason: 'other',
      explanation: 'Custom defect found',
      userId: 'user1',
    })
    expect(scrapped.status).toBe('scrapped')
  })

  it('cannot scrap a completed serial', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService, lifecycleService } = ctx

    const job = jobService.createJob({ name: 'Completed Scrap Test', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 1,
      steps: [{ name: 'Only Step' }],
    })
    const [serial] = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'user1'
    )

    // Complete the serial
    serialService.advanceSerial(serial.id, 'user1')

    // Scrap should fail
    expect(() =>
      lifecycleService.scrapSerial(serial.id, {
        reason: 'damaged',
        userId: 'user1',
      })
    ).toThrow(/completed/)
  })
})
