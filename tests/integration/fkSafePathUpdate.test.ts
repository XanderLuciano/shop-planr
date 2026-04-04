/**
 * Integration: FK-Safe Path Update
 *
 * Validates that path updates preserve step IDs, handle appends,
 * guard FK-dependent step removal, allow safe removal, support
 * idempotent saves, and work identically from both entry points.
 *
 * Validates: Requirements 1.1–1.3, 3.2, 3.3, 4.1, 4.2, 6.1, 6.2, 7.1–7.3, 8.1, 8.2
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestContext, type TestContext } from './helpers'
import { ValidationError } from '~/server/utils/errors'

describe('FK-Safe Path Update Integration', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestContext()
  })

  afterEach(() => {
    ctx.cleanup()
  })

  /** Helper: create a job + path with N steps */
  function createJobWithPath(stepCount: number) {
    const job = ctx.jobService.createJob({ name: 'Test Job', goalQuantity: 10 })
    const steps = Array.from({ length: stepCount }, (_, i) => ({
      name: `Step ${i}`,
      location: `Loc ${i}`,
    }))
    const path = ctx.pathService.createPath({
      jobId: job.id,
      name: 'Route A',
      goalQuantity: 10,
      steps,
    })
    return { job, path }
  }

  it('7.1 update path steps without FK violation — preserves step IDs and references', () => {
    const { job, path } = createJobWithPath(2)
    const originalStepIds = path.steps.map(s => s.id)

    // Create a part so we can attach a cert and a note to step 0
    const [part] = ctx.partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'operator1',
    )

    // Attach a cert to step 0
    const cert = ctx.certService.createCert({ type: 'material', name: 'Steel Cert' })
    ctx.certService.attachCertToPart({
      certId: cert.id,
      partId: part.id,
      stepId: path.steps[0].id,
      userId: 'qe1',
      jobId: job.id,
      pathId: path.id,
    })

    // Create a note on step 1 via direct DB insert (noteService requires partIds)
    ctx.noteService.createNote({
      jobId: job.id,
      pathId: path.id,
      stepId: path.steps[1].id,
      partIds: [part.id],
      text: 'Inspection note',
      userId: 'qe1',
    })

    // Now update the path: change goalQuantity and step 0 location (include IDs for matching)
    const updated = ctx.pathService.updatePath(path.id, {
      goalQuantity: 20,
      steps: [
        { id: originalStepIds[0], name: 'Step 0', location: 'New Loc' },
        { id: originalStepIds[1], name: 'Step 1', location: 'Loc 1' },
      ],
    })

    // Step IDs must be preserved
    expect(updated.steps.map(s => s.id)).toEqual(originalStepIds)
    expect(updated.goalQuantity).toBe(20)
    expect(updated.steps[0].location).toBe('New Loc')

    // FK references still valid — cert attachment still queryable
    const attachments = ctx.certService.getCertsForPart(part.id)
    expect(attachments).toHaveLength(1)
    expect(attachments[0].certId).toBe(cert.id)

    // Note still queryable by step
    const notes = ctx.noteService.getNotesForStep(path.steps[1].id)
    expect(notes).toHaveLength(1)
    expect(notes[0].text).toBe('Inspection note')
  })

  it('7.2 append new steps to existing path — preserves existing IDs, inserts fresh ID', () => {
    const { path } = createJobWithPath(2)
    const originalStepIds = path.steps.map(s => s.id)

    // Update with 3 steps (keep existing 2 by ID, append one new)
    const updated = ctx.pathService.updatePath(path.id, {
      steps: [
        { id: originalStepIds[0], name: 'Step 0', location: 'Loc 0' },
        { id: originalStepIds[1], name: 'Step 1', location: 'Loc 1' },
        { name: 'Step 2', location: 'Loc 2' },
      ],
    })

    expect(updated.steps).toHaveLength(3)
    // First two IDs preserved
    expect(updated.steps[0].id).toBe(originalStepIds[0])
    expect(updated.steps[1].id).toBe(originalStepIds[1])
    // Third step has a new ID, different from existing ones
    expect(updated.steps[2].id).not.toBe(originalStepIds[0])
    expect(updated.steps[2].id).not.toBe(originalStepIds[1])
    // Orders are sequential
    expect(updated.steps.map(s => s.order)).toEqual([0, 1, 2])
  })

  it('7.3 remove step blocked by active parts — throws ValidationError', () => {
    const { job, path } = createJobWithPath(3)

    // Create a part — it starts at step 0 (currentStepId = step 0's ID)
    const [_part] = ctx.partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'operator1',
    )

    // Try to remove step 0 (which has an active part) — should throw
    expect(() =>
      ctx.pathService.updatePath(path.id, {
        steps: [
          { id: path.steps[1].id, name: 'Step 1', location: 'Loc 1' },
          { id: path.steps[2].id, name: 'Step 2', location: 'Loc 2' },
        ],
      }),
    ).toThrow(ValidationError)

    // Verify the error message matches the requirement
    try {
      ctx.pathService.updatePath(path.id, {
        steps: [
          { id: path.steps[1].id, name: 'Step 1', location: 'Loc 1' },
          { id: path.steps[2].id, name: 'Step 2', location: 'Loc 2' },
        ],
      })
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError)
      expect((err as ValidationError).message).toContain('Cannot remove step')
    }
  })

  it('7.4 remove step with no dependents — succeeds', () => {
    const { path } = createJobWithPath(3)
    const originalStepIds = path.steps.map(s => s.id)

    // No certs/notes/statuses attached to any step — remove the last step (keep first two by ID)
    const updated = ctx.pathService.updatePath(path.id, {
      steps: [
        { id: originalStepIds[0], name: 'Step 0', location: 'Loc 0' },
        { id: originalStepIds[1], name: 'Step 1', location: 'Loc 1' },
      ],
    })

    expect(updated.steps).toHaveLength(2)
    expect(updated.steps[0].id).toBe(originalStepIds[0])
    expect(updated.steps[1].id).toBe(originalStepIds[1])

    // Verify the removed step is soft-deleted (active steps only show 2)
    const refetched = ctx.pathService.getPath(path.id)
    expect(refetched.steps).toHaveLength(2)
  })

  it('7.5 idempotent update — save without changes produces no errors', () => {
    const { path } = createJobWithPath(2)
    const originalStepIds = path.steps.map(s => s.id)

    // Update with identical data (include IDs for matching)
    const updated = ctx.pathService.updatePath(path.id, {
      name: path.name,
      goalQuantity: path.goalQuantity,
      steps: path.steps.map(s => ({
        id: s.id,
        name: s.name,
        location: s.location,
        optional: s.optional,
        dependencyType: s.dependencyType,
      })),
    })

    expect(updated.steps.map(s => s.id)).toEqual(originalStepIds)
    expect(updated.name).toBe(path.name)
    expect(updated.goalQuantity).toBe(path.goalQuantity)
    expect(updated.steps.map(s => s.name)).toEqual(path.steps.map(s => s.name))
    expect(updated.steps.map(s => s.location)).toEqual(path.steps.map(s => s.location))
  })

  it('7.6 both entry points produce same result — identical payloads yield identical outcomes', () => {
    const { path } = createJobWithPath(2)

    // Simulate PathEditor payload shape (inline edit on Job Detail page)
    const pathEditorPayload = {
      name: 'Route A',
      goalQuantity: 15,
      steps: [
        { name: 'Cutting', location: 'Bay 1' },
        { name: 'Inspection', location: 'Bay 2' },
      ],
    }

    const result1 = ctx.pathService.updatePath(path.id, pathEditorPayload)

    // Reset: create a fresh path to test the second entry point
    const job2 = ctx.jobService.createJob({ name: 'Test Job 2', goalQuantity: 10 })
    const path2 = ctx.pathService.createPath({
      jobId: job2.id,
      name: 'Route A',
      goalQuantity: 10,
      steps: [
        { name: 'Step 0', location: 'Loc 0' },
        { name: 'Step 1', location: 'Loc 1' },
      ],
    })

    // Simulate JobCreationForm/useJobForm payload shape (same shape goes through updatePath)
    const jobFormPayload = {
      name: 'Route A',
      goalQuantity: 15,
      steps: [
        { name: 'Cutting', location: 'Bay 1' },
        { name: 'Inspection', location: 'Bay 2' },
      ],
    }

    const result2 = ctx.pathService.updatePath(path2.id, jobFormPayload)

    // Both should produce the same reconciliation outcome
    expect(result1.steps.length).toBe(result2.steps.length)
    expect(result1.name).toBe(result2.name)
    expect(result1.goalQuantity).toBe(result2.goalQuantity)
    // Step field values match
    for (let i = 0; i < result1.steps.length; i++) {
      expect(result1.steps[i].name).toBe(result2.steps[i].name)
      expect(result1.steps[i].location).toBe(result2.steps[i].location)
      expect(result1.steps[i].order).toBe(result2.steps[i].order)
      expect(result1.steps[i].optional).toBe(result2.steps[i].optional)
      expect(result1.steps[i].dependencyType).toBe(result2.steps[i].dependencyType)
    }
  })
})
