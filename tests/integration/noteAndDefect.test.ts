/**
 * Integration: Notes and Defect Reporting
 *
 * Create notes → verify per-step and per-part queries.
 * Validates: Requirements 17.1, 17.2, 17.4, 17.5, 17.6, 13.1–13.5
 */
import { describe, it, afterEach, expect } from 'vitest'
import { createTestContext, type TestContext } from './helpers'

describe('Note and Defect Integration', () => {
  let ctx: TestContext

  afterEach(() => ctx?.cleanup())

  it('create note on parts at a step → query by part, step, and job', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, noteService } = ctx

    const job = jobService.createJob({ name: 'Note Job', goalQuantity: 5 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 5,
      steps: [{ name: 'Cut' }, { name: 'Inspect' }],
    })

    const parts = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 3 },
      'op1',
    )

    // Create a note on first 2 parts at step 0
    const note = noteService.createNote({
      jobId: job.id,
      pathId: path.id,
      stepId: path.steps[0].id,
      partIds: [parts[0].id, parts[1].id],
      text: 'Burr detected on edge',
      userId: 'inspector1',
    })

    expect(note.text).toBe('Burr detected on edge')
    expect(note.createdBy).toBe('inspector1')

    // Query by part → found for part 0 and 1, not for part 2
    const notesForPart0 = noteService.getNotesForPart(parts[0].id)
    expect(notesForPart0).toHaveLength(1)
    expect(notesForPart0[0].text).toBe('Burr detected on edge')

    const notesForPart1 = noteService.getNotesForPart(parts[1].id)
    expect(notesForPart1).toHaveLength(1)

    const notesForPart2 = noteService.getNotesForPart(parts[2].id)
    expect(notesForPart2).toHaveLength(0)

    // Query by step → found
    const notesForStep = noteService.getNotesForStep(path.steps[0].id)
    expect(notesForStep).toHaveLength(1)

    // Query by job → found
    const notesForJob = noteService.getNotesForJob(job.id)
    expect(notesForJob).toHaveLength(1)
  })

  it('multiple notes on different steps are queryable independently', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, noteService } = ctx

    const job = jobService.createJob({ name: 'Multi-Note Job', goalQuantity: 3 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 3,
      steps: [{ name: 'Cut' }, { name: 'Weld' }, { name: 'QC' }],
    })

    const parts = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 3 },
      'op1',
    )

    // Note at step 0 (Cut)
    noteService.createNote({
      jobId: job.id,
      pathId: path.id,
      stepId: path.steps[0].id,
      partIds: [parts[0].id],
      text: 'Material defect',
      userId: 'op1',
    })

    // Advance part 0 and 1 to step 1
    partService.advancePart(parts[0].id, 'op1')
    partService.advancePart(parts[1].id, 'op1')

    // Note at step 1 (Weld)
    noteService.createNote({
      jobId: job.id,
      pathId: path.id,
      stepId: path.steps[1].id,
      partIds: [parts[0].id, parts[1].id],
      text: 'Weld porosity found',
      userId: 'welder1',
    })

    // Step 0 has 1 note, step 1 has 1 note, step 2 has 0 notes
    expect(noteService.getNotesForStep(path.steps[0].id)).toHaveLength(1)
    expect(noteService.getNotesForStep(path.steps[1].id)).toHaveLength(1)
    expect(noteService.getNotesForStep(path.steps[2].id)).toHaveLength(0)

    // Part 0 has 2 notes (one at each step)
    expect(noteService.getNotesForPart(parts[0].id)).toHaveLength(2)
    // Part 1 has 1 note (only at Weld)
    expect(noteService.getNotesForPart(parts[1].id)).toHaveLength(1)
    // Part 2 has 0 notes
    expect(noteService.getNotesForPart(parts[2].id)).toHaveLength(0)

    // Job has 2 notes total
    expect(noteService.getNotesForJob(job.id)).toHaveLength(2)
  })

  it('note creation is recorded in audit trail', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, noteService, auditService } = ctx

    const job = jobService.createJob({ name: 'Audit Note Job', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 1,
      steps: [{ name: 'OP1' }],
    })

    const [part] = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'op1',
    )

    noteService.createNote({
      jobId: job.id,
      pathId: path.id,
      stepId: path.steps[0].id,
      partIds: [part.id],
      text: 'Test note for audit',
      userId: 'inspector1',
    })

    const allAudits = auditService.listAuditEntries({ limit: 100 })
    const noteAudits = allAudits.filter(a => a.action === 'note_created')
    expect(noteAudits).toHaveLength(1)
    expect(noteAudits[0].userId).toBe('inspector1')
    expect(noteAudits[0].jobId).toBe(job.id)
    expect(noteAudits[0].stepId).toBe(path.steps[0].id)
  })

  it('notes are returned in chronological order', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, noteService } = ctx

    const job = jobService.createJob({ name: 'Chrono Note Job', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 1,
      steps: [{ name: 'OP1' }],
    })

    const [part] = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'op1',
    )

    // Create 3 notes in sequence
    noteService.createNote({
      jobId: job.id, pathId: path.id, stepId: path.steps[0].id,
      partIds: [part.id], text: 'First note', userId: 'user1',
    })
    noteService.createNote({
      jobId: job.id, pathId: path.id, stepId: path.steps[0].id,
      partIds: [part.id], text: 'Second note', userId: 'user2',
    })
    noteService.createNote({
      jobId: job.id, pathId: path.id, stepId: path.steps[0].id,
      partIds: [part.id], text: 'Third note', userId: 'user1',
    })

    const notes = noteService.getNotesForPart(part.id)
    expect(notes).toHaveLength(3)
    // Chronological order
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i].createdAt >= notes[i - 1].createdAt).toBe(true)
    }
  })
})


/**
 * Integration: Standalone Note Creation Without Advancement
 *
 * Create notes via noteService.createNote without advancing parts,
 * verify parts remain at the same step, notes are queryable per-part
 * and per-step, and audit trail records note_created.
 *
 * Validates: Requirements 1.4, 2.4, 3.1, 3.3, 4.2
 */
describe('Standalone Note Creation Without Advancement', () => {
  let ctx: TestContext

  afterEach(() => ctx?.cleanup())

  it('creates a note on multiple parts without advancing — parts stay at same step, note queryable per-part and per-step', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, noteService } = ctx

    const job = jobService.createJob({ name: 'No-Advance Note Job', goalQuantity: 4 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route A',
      goalQuantity: 4,
      steps: [{ name: 'Mill' }, { name: 'Deburr' }, { name: 'Inspect' }],
    })

    const parts = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 4 },
      'op1',
    )

    // Snapshot each part's currentStepId before note creation
    const stepsBefore = parts.map(p => p.currentStepId)

    // All parts should start at step 0 (Mill)
    for (const p of parts) {
      expect(p.currentStepId).toBe(path.steps[0].id)
    }

    // Create a note on parts 0, 1, 2 at step 0 — no advancement
    const note = noteService.createNote({
      jobId: job.id,
      pathId: path.id,
      stepId: path.steps[0].id,
      partIds: [parts[0].id, parts[1].id, parts[2].id],
      text: 'Surface roughness borderline — monitor next batch',
      userId: 'inspector42',
    })

    // Verify note was created with correct attribution (Req 3.1)
    expect(note.id).toMatch(/^note_/)
    expect(note.text).toBe('Surface roughness borderline — monitor next batch')
    expect(note.createdBy).toBe('inspector42')
    expect(note.createdAt).toBeTruthy()
    expect(() => new Date(note.createdAt).toISOString()).not.toThrow()

    // Verify all parts remain at the same step — no advancement occurred (Req 1.4)
    for (let i = 0; i < parts.length; i++) {
      const refreshed = partService.getPart(parts[i].id)
      expect(refreshed.currentStepId).toBe(stepsBefore[i])
      expect(refreshed.status).toBe('in_progress')
    }

    // Verify note is queryable per-part for each referenced part (Req 2.4, 4.2)
    for (const pid of [parts[0].id, parts[1].id, parts[2].id]) {
      const notesForPart = noteService.getNotesForPart(pid)
      expect(notesForPart).toHaveLength(1)
      expect(notesForPart[0].id).toBe(note.id)
      expect(notesForPart[0].text).toBe(note.text)
    }

    // Part 3 was NOT included in the note — should have zero notes
    const notesForPart3 = noteService.getNotesForPart(parts[3].id)
    expect(notesForPart3).toHaveLength(0)

    // Verify note is queryable per-step (Req 2.4)
    const notesForStep = noteService.getNotesForStep(path.steps[0].id)
    expect(notesForStep).toHaveLength(1)
    expect(notesForStep[0].id).toBe(note.id)

    // Other steps should have no notes
    expect(noteService.getNotesForStep(path.steps[1].id)).toHaveLength(0)
    expect(noteService.getNotesForStep(path.steps[2].id)).toHaveLength(0)
  })

  it('audit trail contains note_created entry with correct fields', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, noteService, auditService } = ctx

    const job = jobService.createJob({ name: 'Audit Note Job 2', goalQuantity: 2 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route B',
      goalQuantity: 2,
      steps: [{ name: 'Weld' }, { name: 'QC' }],
    })

    const parts = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 2 },
      'welder1',
    )

    // Count audit entries before note creation
    const auditsBefore = auditService.listAuditEntries({ limit: 1000 })
    const noteAuditsBefore = auditsBefore.filter(a => a.action === 'note_created')

    noteService.createNote({
      jobId: job.id,
      pathId: path.id,
      stepId: path.steps[0].id,
      partIds: [parts[0].id, parts[1].id],
      text: 'Weld bead slightly uneven',
      userId: 'welder1',
    })

    // Verify exactly one new note_created audit entry (Req 3.3)
    const auditsAfter = auditService.listAuditEntries({ limit: 1000 })
    const noteAuditsAfter = auditsAfter.filter(a => a.action === 'note_created')
    expect(noteAuditsAfter).toHaveLength(noteAuditsBefore.length + 1)

    const newAudit = noteAuditsAfter[noteAuditsAfter.length - 1]
    expect(newAudit.userId).toBe('welder1')
    expect(newAudit.jobId).toBe(job.id)
    expect(newAudit.pathId).toBe(path.id)
    expect(newAudit.stepId).toBe(path.steps[0].id)
    expect(newAudit.action).toBe('note_created')
  })
})
