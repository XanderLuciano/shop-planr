/**
 * Integration: Step Override Workflow
 *
 * Create job → create overrides on subset → verify overridden serials can skip →
 * verify non-overridden blocked → reverse override → verify restored.
 * Validates: Requirements 9.1, 9.3, 9.4, 9.9, 9.10
 */
import { describe, it, afterEach, expect } from 'vitest'
import { createTestContext, type TestContext } from './helpers'

describe('Step Override Workflow Integration', () => {
  let ctx: TestContext

  afterEach(() => ctx?.cleanup())

  it('full override flow: create → skip overridden → block non-overridden → reverse → verify restored', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService, lifecycleService } = ctx

    // 1. Create job with flexible path and a required step
    const job = jobService.createJob({ name: 'Override Job', goalQuantity: 4 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Override Path',
      goalQuantity: 4,
      steps: [{ name: 'Cut' }, { name: 'QC Check' }, { name: 'Ship' }],
    })

    // Set path to flexible mode
    ctx.repos.paths.update(path.id, { advancementMode: 'flexible' })

    // Step 1 (QC Check) is required by default

    // 2. Create 4 serials
    const serials = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 4 },
      'operator1'
    )

    // 3. Create override on first 2 serials for step 1 (QC Check)
    const overrides = lifecycleService.createStepOverride(
      [serials[0].id, serials[1].id],
      path.steps[1].id,
      'Prototype fast-track',
      'engineer1'
    )
    expect(overrides).toHaveLength(2)

    // 4. Overridden serials can skip QC Check (step 1) — it becomes effectively optional
    const result1 = lifecycleService.advanceToStep(serials[0].id, {
      targetStepIndex: 2,
      userId: 'operator1',
    })
    // QC Check should be classified as 'skipped' because override makes it effectively optional
    const qcBypass = result1.bypassed.find(b => b.stepName === 'QC Check')
    expect(qcBypass).toBeDefined()
    expect(qcBypass!.classification).toBe('skipped')

    // 5. Non-overridden serial skipping QC Check → step is deferred (required)
    const result3 = lifecycleService.advanceToStep(serials[2].id, {
      targetStepIndex: 2,
      userId: 'operator1',
    })
    const qcBypass3 = result3.bypassed.find(b => b.stepName === 'QC Check')
    expect(qcBypass3).toBeDefined()
    expect(qcBypass3!.classification).toBe('deferred') // required → deferred

    // 6. Verify non-overridden serial has deferred blocker
    const check = lifecycleService.canComplete(serials[2].id)
    expect(check.canComplete).toBe(false)
    expect(check.blockers).toContain(path.steps[1].id)

    // 7. Reverse override on serial[1] (which hasn't been advanced yet)
    lifecycleService.reverseStepOverride(serials[1].id, path.steps[1].id, 'engineer1')

    // 8. After reversal, serial[1] skipping QC Check → deferred (required again)
    const result2 = lifecycleService.advanceToStep(serials[1].id, {
      targetStepIndex: 2,
      userId: 'operator1',
    })
    const qcBypass2 = result2.bypassed.find(b => b.stepName === 'QC Check')
    expect(qcBypass2).toBeDefined()
    expect(qcBypass2!.classification).toBe('deferred') // override reversed → required → deferred
  })

  it('override on already-completed step is rejected', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService, lifecycleService } = ctx

    const job = jobService.createJob({ name: 'Completed Override Test', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 1,
      steps: [{ name: 'A' }, { name: 'B' }],
    })

    const [serial] = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'user1'
    )

    // Advance past step 0 using lifecycleService (updates sn_step_statuses)
    lifecycleService.advanceToStep(serial.id, { targetStepIndex: 1, userId: 'user1' })

    // Try to override step 0 (already completed) → should fail
    expect(() =>
      lifecycleService.createStepOverride([serial.id], path.steps[0].id, 'reason', 'user1')
    ).toThrow(/completed/)
  })

  it('audit entries are created for override and reversal', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService, lifecycleService, auditService } = ctx

    const job = jobService.createJob({ name: 'Override Audit Test', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 1,
      steps: [{ name: 'A' }, { name: 'B' }],
    })

    const [serial] = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'user1'
    )

    // Create override
    lifecycleService.createStepOverride([serial.id], path.steps[1].id, 'Fast track', 'eng1')

    // Reverse override
    lifecycleService.reverseStepOverride(serial.id, path.steps[1].id, 'eng1')

    // Check audit
    const trail = auditService.getSerialAuditTrail(serial.id)
    const createEntry = trail.find(e => e.action === 'step_override_created')
    const reverseEntry = trail.find(e => e.action === 'step_override_reversed')

    expect(createEntry).toBeDefined()
    expect(reverseEntry).toBeDefined()
  })
})
