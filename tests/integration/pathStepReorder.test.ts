/**
 * Integration test: Path step reorder with active parts.
 *
 * Verifies that reordering, adding, and removing steps on a path
 * with in-progress parts works correctly when step IDs are preserved.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestContext, type TestContext } from './helpers'

describe('Path step reorder with active parts', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(() => {
    ctx.cleanup()
  })

  it('reordering steps succeeds when parts are in-progress', () => {
    const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 10 })
    const path = ctx.pathService.createPath({
      jobId: job.id,
      name: 'Path',
      goalQuantity: 10,
      steps: [
        { name: 'Step A' },
        { name: 'Step B' },
        { name: 'Step C' },
      ],
    })

    // Create parts and advance one to step B
    const parts = ctx.partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 2 },
      'user1',
    )
    ctx.partService.advancePart(parts[0]!.id, 'user1') // now at Step B

    // Reorder: swap B and C (all IDs preserved, just different order)
    const reorderedSteps = [
      { id: path.steps[0]!.id, name: 'Step A' },
      { id: path.steps[2]!.id, name: 'Step C' }, // was order 2, now order 1
      { id: path.steps[1]!.id, name: 'Step B' }, // was order 1, now order 2
    ]

    // This should NOT throw — we're reordering, not removing
    const updated = ctx.pathService.updatePath(path.id, { steps: reorderedSteps })

    expect(updated.steps).toHaveLength(3)
    expect(updated.steps[0]!.name).toBe('Step A')
    expect(updated.steps[1]!.name).toBe('Step C')
    expect(updated.steps[2]!.name).toBe('Step B')

    // Parts should still be at their original step IDs
    const part0 = ctx.partService.getPart(parts[0]!.id)
    const part1 = ctx.partService.getPart(parts[1]!.id)
    expect(part0.currentStepId).toBe(path.steps[1]!.id) // still at Step B's ID
    expect(part1.currentStepId).toBe(path.steps[0]!.id) // still at Step A's ID
  })

  it('adding a new step succeeds when parts are in-progress', () => {
    const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 10 })
    const path = ctx.pathService.createPath({
      jobId: job.id,
      name: 'Path',
      goalQuantity: 10,
      steps: [{ name: 'Step A' }, { name: 'Step B' }],
    })

    // Create a part at step A
    ctx.partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'user1',
    )

    // Add a new step between A and B (existing steps keep their IDs)
    const stepsWithNew = [
      { id: path.steps[0]!.id, name: 'Step A' },
      { name: 'Step A.5' }, // new step, no id
      { id: path.steps[1]!.id, name: 'Step B' },
    ]

    const updated = ctx.pathService.updatePath(path.id, { steps: stepsWithNew })

    expect(updated.steps).toHaveLength(3)
    expect(updated.steps[0]!.name).toBe('Step A')
    expect(updated.steps[1]!.name).toBe('Step A.5')
    expect(updated.steps[2]!.name).toBe('Step B')
  })

  it('removing a step that has no parts at it succeeds even when other steps have active parts', () => {
    const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 10 })
    const path = ctx.pathService.createPath({
      jobId: job.id,
      name: 'Path',
      goalQuantity: 10,
      steps: [{ name: 'Step A' }, { name: 'Step B' }, { name: 'Step C' }],
    })

    // Create a part at step A — step C has no parts
    ctx.partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'user1',
    )

    // Remove step C (no parts at that step, even though parts exist on the path)
    const stepsWithoutC = [
      { id: path.steps[0]!.id, name: 'Step A' },
      { id: path.steps[1]!.id, name: 'Step B' },
    ]

    const updated = ctx.pathService.updatePath(path.id, { steps: stepsWithoutC })
    expect(updated.steps).toHaveLength(2)
  })

  it('removing a step that has active parts at it throws ValidationError', () => {
    const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 10 })
    const path = ctx.pathService.createPath({
      jobId: job.id,
      name: 'Path',
      goalQuantity: 10,
      steps: [{ name: 'Step A' }, { name: 'Step B' }],
    })

    // Create a part at step A
    ctx.partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'user1',
    )

    // Try to remove step A (has active parts at it)
    const stepsWithoutA = [
      { id: path.steps[1]!.id, name: 'Step B' },
    ]

    expect(() => {
      ctx.pathService.updatePath(path.id, { steps: stepsWithoutA })
    }).toThrow('Cannot remove step')
  })

  it('omitting step IDs on a path with no parts soft-deletes old steps and creates new ones', () => {
    const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 10 })
    const path = ctx.pathService.createPath({
      jobId: job.id,
      name: 'Path',
      goalQuantity: 10,
      steps: [{ name: 'Step A' }, { name: 'Step B' }],
    })

    // No parts created — safe to replace all steps
    const stepsNoIds = [
      { name: 'Step A' },
      { name: 'Step B' },
    ]

    const updated = ctx.pathService.updatePath(path.id, { steps: stepsNoIds })
    expect(updated.steps).toHaveLength(2)
    // New IDs should be different from original (old steps were soft-deleted, new ones created)
    expect(updated.steps[0]!.id).not.toBe(path.steps[0]!.id)
    expect(updated.steps[1]!.id).not.toBe(path.steps[1]!.id)
  })
})
