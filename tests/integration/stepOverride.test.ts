/**
 * Integration: Step Override Workflow
 *
 * Create job → create overrides on subset → verify overridden parts can skip →
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
    const { jobService, pathService, partService, lifecycleService } = ctx

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

    // 2. Create 4 parts
    const parts = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 4 },
      'operator1'
    )

    // 3. Create override on first 2 parts for step 1 (QC Check)
    const overrides = lifecycleService.createStepOverride(
      [parts[0].id, parts[1].id],
      path.steps[1].id,
      'Prototype fast-track',
      'engineer1'
    )
    expect(overrides).toHaveLength(2)

    // 4. Overridden parts can skip QC Check (step 1) — it becomes effectively optional
    const result1 = lifecycleService.advanceToStep(parts[0].id, {
      targetStepId: path.steps[2].id,
      userId: 'operator1',
    })
    // QC Check should be classified as 'skipped' because override makes it effectively optional
    const qcBypass = result1.bypassed.find(b => b.stepName === 'QC Check')
    expect(qcBypass).toBeDefined()
    expect(qcBypass!.classification).toBe('skipped')

    // 5. Non-overridden part skipping QC Check → step is deferred (required)
    const result3 = lifecycleService.advanceToStep(parts[2].id, {
      targetStepId: path.steps[2].id,
      userId: 'operator1',
    })
    const qcBypass3 = result3.bypassed.find(b => b.stepName === 'QC Check')
    expect(qcBypass3).toBeDefined()
    expect(qcBypass3!.classification).toBe('deferred') // required → deferred

    // 6. Verify non-overridden part has deferred blocker
    const check = lifecycleService.canComplete(parts[2].id)
    expect(check.canComplete).toBe(false)
    expect(check.blockers).toContain(path.steps[1].id)

    // 7. Reverse override on parts[1] (which hasn't been advanced yet)
    lifecycleService.reverseStepOverride(parts[1].id, path.steps[1].id, 'engineer1')

    // 8. After reversal, parts[1] skipping QC Check → deferred (required again)
    const result2 = lifecycleService.advanceToStep(parts[1].id, {
      targetStepId: path.steps[2].id,
      userId: 'operator1',
    })
    const qcBypass2 = result2.bypassed.find(b => b.stepName === 'QC Check')
    expect(qcBypass2).toBeDefined()
    expect(qcBypass2!.classification).toBe('deferred') // override reversed → required → deferred
  })

  it('override on already-completed step is rejected', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, lifecycleService } = ctx

    const job = jobService.createJob({ name: 'Completed Override Test', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 1,
      steps: [{ name: 'A' }, { name: 'B' }],
    })

    const [part] = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'user1'
    )

    // Advance past step 0 using lifecycleService (updates part_step_statuses)
    lifecycleService.advanceToStep(part.id, { targetStepId: path.steps[1].id, userId: 'user1' })

    // Try to override step 0 (already completed) → should fail
    expect(() =>
      lifecycleService.createStepOverride([part.id], path.steps[0].id, 'reason', 'user1')
    ).toThrow(/completed/)
  })

  it('audit entries are created for override and reversal', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, lifecycleService, auditService } = ctx

    const job = jobService.createJob({ name: 'Override Audit Test', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 1,
      steps: [{ name: 'A' }, { name: 'B' }],
    })

    const [part] = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'user1'
    )

    // Create override
    lifecycleService.createStepOverride([part.id], path.steps[1].id, 'Fast track', 'eng1')

    // Reverse override
    lifecycleService.reverseStepOverride(part.id, path.steps[1].id, 'eng1')

    // Check audit
    const trail = auditService.getPartAuditTrail(part.id)
    const createEntry = trail.find(e => e.action === 'step_override_created')
    const reverseEntry = trail.find(e => e.action === 'step_override_reversed')

    expect(createEntry).toBeDefined()
    expect(reverseEntry).toBeDefined()
  })
})
