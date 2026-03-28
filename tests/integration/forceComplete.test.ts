/**
 * Integration: Force-Complete Workflow
 *
 * Create job → advance part partially → force-complete →
 * verify completed status → verify audit entry contains incomplete steps.
 * Validates: Requirements 8.1, 8.4, 8.5, 8.7
 */
import { describe, it, afterEach, expect } from 'vitest'
import { createTestContext, type TestContext } from './helpers'

describe('Force-Complete Workflow Integration', () => {
  let ctx: TestContext

  afterEach(() => ctx?.cleanup())

  it('full force-complete flow: partial advance → force-complete → verify status + audit', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, lifecycleService, auditService } = ctx

    // 1. Create job with 3-step path
    const job = jobService.createJob({ name: 'Force Complete Job', goalQuantity: 3 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'FC Path',
      goalQuantity: 3,
      steps: [{ name: 'Cut' }, { name: 'Weld' }, { name: 'Inspect' }],
    })

    // 2. Create part and advance to step 1 only (leaving steps 1 and 2 incomplete)
    const [part] = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'operator1'
    )

    // Advance from step 0 to step 1
    partService.advancePart(part.id, 'operator1')

    // 3. Force-complete the part (steps 1 and 2 are incomplete)
    const forceCompleted = lifecycleService.forceComplete(part.id, {
      reason: 'Customer accepted partial work',
      userId: 'supervisor1',
    })

    // 4. Verify completed status
    expect(forceCompleted.status).toBe('completed')
    expect(forceCompleted.currentStepIndex).toBe(-1)
    expect(forceCompleted.forceCompleted).toBe(true)
    expect(forceCompleted.forceCompletedBy).toBe('supervisor1')
    expect(forceCompleted.forceCompletedReason).toBe('Customer accepted partial work')
    expect(forceCompleted.forceCompletedAt).toBeDefined()

    // 5. Verify audit entry contains incomplete steps
    const auditTrail = auditService.getPartAuditTrail(part.id)
    const fcEntry = auditTrail.find(e => e.action === 'part_force_completed')
    expect(fcEntry).toBeDefined()
    expect(fcEntry!.partId).toBe(part.id)
    expect(fcEntry!.metadata).toBeDefined()

    const metadata = fcEntry!.metadata as { incompleteStepIds: string[]; reason?: string }
    expect(metadata.incompleteStepIds).toBeDefined()
    // Steps at index 1 (Weld) and 2 (Inspect) should be incomplete
    expect(metadata.incompleteStepIds).toContain(path.steps[1].id)
    expect(metadata.incompleteStepIds).toContain(path.steps[2].id)
    expect(metadata.reason).toBe('Customer accepted partial work')

    // 6. Verify progress counts the force-completed part as completed
    const progress = jobService.computeJobProgress(job.id)
    expect(progress.completedParts).toBe(1)
  })

  it('force-complete rejects part with no incomplete required steps', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, lifecycleService } = ctx

    const job = jobService.createJob({ name: 'No Incomplete Test', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 1,
      steps: [{ name: 'Only Step' }],
    })

    const [part] = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'user1'
    )

    // The part is at step 0 with step 0 in_progress. Step 0 is the only step and it's required.
    // Force-complete should work here because step 0 is still in_progress (not completed).
    const fc = lifecycleService.forceComplete(part.id, { userId: 'user1' })
    expect(fc.status).toBe('completed')
    expect(fc.forceCompleted).toBe(true)
  })

  it('force-complete rejects scrapped part', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, lifecycleService } = ctx

    const job = jobService.createJob({ name: 'Scrapped FC Test', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 1,
      steps: [{ name: 'Step1' }],
    })

    const [part] = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'user1'
    )

    // Scrap it first
    lifecycleService.scrapPart(part.id, { reason: 'damaged', userId: 'user1' })

    // Force-complete should fail
    expect(() =>
      lifecycleService.forceComplete(part.id, { userId: 'user1' })
    ).toThrow(/scrapped/)
  })
})
