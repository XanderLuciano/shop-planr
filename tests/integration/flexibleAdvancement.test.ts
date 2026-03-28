/**
 * Integration: Flexible Advancement
 *
 * Create job with flexible path → advance part skipping steps →
 * verify skip/defer classification → verify deferred blocks normal completion →
 * complete deferred step → verify normal completion succeeds.
 * Validates: Requirements 5.1, 5.2, 5.3, 6.3, 11.2, 11.3, 11.5, 11.7
 */
import { describe, it, afterEach, expect } from 'vitest'
import { createTestContext, type TestContext } from './helpers'

describe('Flexible Advancement Integration', () => {
  let ctx: TestContext

  afterEach(() => ctx?.cleanup())

  it('full flexible flow: advance skipping → classify → deferred blocks → complete deferred → complete', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, lifecycleService } = ctx

    // 1. Create job
    const job = jobService.createJob({ name: 'Flexible Job', goalQuantity: 5 })

    // 2. Create path with flexible advancement and mixed optional/required steps
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Flexible Path',
      goalQuantity: 5,
      steps: [
        { name: 'Cut' },       // step 0 — required (default)
        { name: 'Deburr' },    // step 1 — will be made optional
        { name: 'Weld' },      // step 2 — required
        { name: 'Inspect' },   // step 3 — required
      ],
    })

    // Make step 1 optional and set path to flexible mode
    pathService.updateStep(path.steps[1].id, { optional: true })

    // Update path advancement mode to flexible
    const updatedPath = ctx.repos.paths.update(path.id, { advancementMode: 'flexible' })
    expect(updatedPath.advancementMode).toBe('flexible')

    // 3. Create part
    const [part] = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'operator1'
    )

    // 4. Advance from step 0 to step 3, skipping steps 1 and 2
    const result = lifecycleService.advanceToStep(part.id, {
      targetStepIndex: 3,
      userId: 'operator1',
    })

    // 5. Verify bypassed step classifications
    expect(result.bypassed).toHaveLength(2)

    const step1Bypass = result.bypassed.find(b => b.stepName === 'Deburr')
    const step2Bypass = result.bypassed.find(b => b.stepName === 'Weld')

    expect(step1Bypass).toBeDefined()
    expect(step1Bypass!.classification).toBe('skipped')  // optional → skipped

    expect(step2Bypass).toBeDefined()
    expect(step2Bypass!.classification).toBe('deferred')  // required → deferred

    // 6. Verify part is now at step 3
    expect(result.serial.currentStepIndex).toBe(3)

    // 7. Verify deferred step blocks normal completion via canComplete
    const completionCheck = lifecycleService.canComplete(part.id)
    expect(completionCheck.canComplete).toBe(false)
    expect(completionCheck.blockers).toContain(path.steps[2].id) // Weld is a blocker

    // 8. Complete the deferred step (Weld)
    const completedDeferred = lifecycleService.completeDeferredStep(
      part.id,
      path.steps[2].id,
      'operator1'
    )
    expect(completedDeferred.status).toBe('completed')

    // 9. Advance from step 3 (Inspect) to completion
    const finalResult = lifecycleService.advanceToStep(part.id, {
      targetStepIndex: 4, // past last step = completion
      userId: 'operator1',
    })
    expect(finalResult.serial.status).toBe('completed')
    expect(finalResult.serial.currentStepIndex).toBe(-1)
  })

  it('strict mode rejects non-sequential advancement', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, lifecycleService } = ctx

    const job = jobService.createJob({ name: 'Strict Job', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Strict Path',
      goalQuantity: 1,
      steps: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    })
    // Path defaults to strict mode

    const [part] = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'user1'
    )

    // Trying to skip from step 0 to step 2 in strict mode → should fail
    expect(() =>
      lifecycleService.advanceToStep(part.id, {
        targetStepIndex: 2,
        userId: 'user1',
      })
    ).toThrow(/strict/)

    // Sequential advance (0 → 1) should work
    const result = lifecycleService.advanceToStep(part.id, {
      targetStepIndex: 1,
      userId: 'user1',
    })
    expect(result.serial.currentStepIndex).toBe(1)
  })

  it('physical dependency blocks advancement even in flexible mode', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, lifecycleService } = ctx

    const job = jobService.createJob({ name: 'Physical Dep Job', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Physical Path',
      goalQuantity: 1,
      steps: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    })

    // Make step 1 (B) a physical dependency
    pathService.updateStep(path.steps[1].id, { dependencyType: 'physical' })

    // Set path to flexible mode
    ctx.repos.paths.update(path.id, { advancementMode: 'flexible' })

    const [part] = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'user1'
    )

    // Trying to skip past physical dependency → should fail
    expect(() =>
      lifecycleService.advanceToStep(part.id, {
        targetStepIndex: 2,
        userId: 'user1',
      })
    ).toThrow(/physical/)
  })

  it('backward advancement is rejected', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, lifecycleService } = ctx

    const job = jobService.createJob({ name: 'Backward Test', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 1,
      steps: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    })
    ctx.repos.paths.update(path.id, { advancementMode: 'flexible' })

    const [part] = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'user1'
    )

    // Advance to step 2
    lifecycleService.advanceToStep(part.id, { targetStepIndex: 2, userId: 'user1' })

    // Try to go back to step 1 → should fail
    expect(() =>
      lifecycleService.advanceToStep(part.id, { targetStepIndex: 1, userId: 'user1' })
    ).toThrow(/before/)
  })
})
