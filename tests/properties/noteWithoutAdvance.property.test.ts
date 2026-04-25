/**
 * Property 1: Note creation never modifies part position
 *
 * For any set of parts at a process step and any valid note text,
 * creating a note via `noteService.createNote` leaves `current_step_id`
 * unchanged for every referenced part.
 *
 * **Validates: Requirement 1.4**
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fc from 'fast-check'
import { createReusableTestContext, savepoint, rollback, type TestContext } from './helpers'

/**
 * Property 5: Whitespace-only text is rejected
 *
 * For any string composed entirely of whitespace characters,
 * `noteService.createNote` throws a ValidationError and no StepNote
 * is persisted.
 *
 * **Validates: Requirements 5.1, 5.5**
 */
import { ValidationError } from '../../server/utils/errors'

describe('Property 1: Note creation never modifies part position', () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = createReusableTestContext()
  })
  afterAll(() => {
    ctx?.cleanup()
  })

  it('creating a note on any subset of parts leaves currentStepId unchanged for every part', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }), // stepCount
        fc.integer({ min: 1, max: 8 }), // partCount
        fc.integer({ min: 0, max: 4 }), // advanceCount — how many times to advance part[0] before noting
        fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 .,!?-]{0,199}$/), // noteText — valid non-whitespace-only string
        fc.infiniteStream(fc.boolean()), // partSelection — which parts to include in the note
        (stepCount, partCount, advanceCount, noteText, partSelectionStream) => {
          savepoint(ctx.db)
          try {
            const { jobService, pathService, partService, noteService } = ctx

            // Set up job → path → steps → parts
            const job = jobService.createJob({ name: 'Note Test Job', goalQuantity: partCount })
            const steps = Array.from({ length: stepCount }, (_, i) => ({ name: `Step ${i}` }))
            const path = pathService.createPath({
              jobId: job.id,
              name: 'Route',
              goalQuantity: partCount,
              steps,
            })

            const parts = partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: partCount },
              'user_setup',
            )

            // Optionally advance the first part a few times to create variety in positions
            const maxAdvances = Math.min(advanceCount, stepCount - 1)
            for (let i = 0; i < maxAdvances; i++) {
              try {
                partService.advancePart(parts[0].id, 'user_setup')
              } catch {
                break
              }
            }

            // Select a non-empty subset of parts using the boolean stream
            const selectedPartIds: string[] = []
            const iter = partSelectionStream[Symbol.iterator]()
            for (const part of parts) {
              if (iter.next().value) {
                selectedPartIds.push(part.id)
              }
            }
            // Ensure at least one part is selected
            if (selectedPartIds.length === 0) {
              selectedPartIds.push(parts[0].id)
            }

            // Snapshot currentStepId for ALL parts before note creation
            const stepIdsBefore = parts.map((p) => {
              const fresh = partService.getPart(p.id)
              return { id: fresh.id, currentStepId: fresh.currentStepId }
            })

            // Create the note
            noteService.createNote({
              jobId: job.id,
              pathId: path.id,
              stepId: path.steps[0].id,
              partIds: selectedPartIds,
              text: noteText,
              userId: 'user_noter',
            })

            // Verify: currentStepId unchanged for EVERY part (not just selected ones)
            for (const before of stepIdsBefore) {
              const after = partService.getPart(before.id)
              expect(after.currentStepId).toBe(before.currentStepId)
            }
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 2: Note attribution and valid timestamp
 *
 * For any valid user ID and note text, the created StepNote has
 * `createdBy` equal to the input user ID and `createdAt` is a valid
 * ISO 8601 timestamp.
 *
 * **Validates: Requirement 3.1**
 */
describe('Property 2: Note attribution and valid timestamp', () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = createReusableTestContext()
  })
  afterAll(() => {
    ctx?.cleanup()
  })

  it('createdBy matches the input userId and createdAt is a valid ISO 8601 timestamp', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9_]{0,19}$/), // userId — simple identifier-like strings
        fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 .,!?-]{0,199}$/), // noteText — valid non-whitespace-only string
        (userId, noteText) => {
          savepoint(ctx.db)
          try {
            const { jobService, pathService, partService, noteService } = ctx

            // Set up minimal job → path → step → part
            const job = jobService.createJob({ name: 'Attribution Test', goalQuantity: 1 })
            const path = pathService.createPath({
              jobId: job.id,
              name: 'Route',
              goalQuantity: 1,
              steps: [{ name: 'Step 1' }],
            })
            const parts = partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: 1 },
              'user_setup',
            )

            // Create the note with the generated userId
            const note = noteService.createNote({
              jobId: job.id,
              pathId: path.id,
              stepId: path.steps[0].id,
              partIds: [parts[0].id],
              text: noteText,
              userId,
            })

            // Property: createdBy must equal the input userId
            expect(note.createdBy).toBe(userId)

            // Property: createdAt must be a valid ISO 8601 timestamp
            const parsed = Date.parse(note.createdAt)
            expect(Number.isNaN(parsed)).toBe(false)

            // Verify it round-trips: new Date(createdAt).toISOString() should produce a valid string
            const roundTripped = new Date(note.createdAt).toISOString()
            expect(roundTripped).toBe(note.createdAt)
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 3: Note visible from each referenced part
 *
 * For any non-empty subset of part IDs used to create a note,
 * calling `getNotesForPart` for each part ID in the subset SHALL
 * return a list containing that note.
 *
 * **Validates: Requirements 2.4, 4.2**
 */
describe('Property 3: Note visible from each referenced part', () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = createReusableTestContext()
  })
  afterAll(() => {
    ctx?.cleanup()
  })

  it('getNotesForPart returns the created note for every part in the subset', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }), // partCount
        fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 .,!?-]{0,199}$/), // noteText
        fc.infiniteStream(fc.boolean()), // partSelection — which parts to include in the note
        (partCount, noteText, partSelectionStream) => {
          savepoint(ctx.db)
          try {
            const { jobService, pathService, partService, noteService } = ctx

            // Set up job → path → step → parts
            const job = jobService.createJob({ name: 'Visibility Test', goalQuantity: partCount })
            const path = pathService.createPath({
              jobId: job.id,
              name: 'Route',
              goalQuantity: partCount,
              steps: [{ name: 'Step 1' }],
            })
            const parts = partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: partCount },
              'user_setup',
            )

            // Select a non-empty subset of parts using the boolean stream
            const selectedPartIds: string[] = []
            const iter = partSelectionStream[Symbol.iterator]()
            for (const part of parts) {
              if (iter.next().value) {
                selectedPartIds.push(part.id)
              }
            }
            // Ensure at least one part is selected
            if (selectedPartIds.length === 0) {
              selectedPartIds.push(parts[0].id)
            }

            // Create the note referencing the selected parts
            const note = noteService.createNote({
              jobId: job.id,
              pathId: path.id,
              stepId: path.steps[0].id,
              partIds: selectedPartIds,
              text: noteText,
              userId: 'user_noter',
            })

            // Property: for EVERY part in the subset, getNotesForPart must include this note
            for (const partId of selectedPartIds) {
              const notesForPart = noteService.getNotesForPart(partId)
              const noteIds = notesForPart.map(n => n.id)
              expect(noteIds).toContain(note.id)
            }
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 4: Audit trail records note creation
 *
 * For any valid note creation input, after calling `noteService.createNote`,
 * the audit log SHALL contain exactly one new entry with `action = 'note_created'`
 * and the matching user ID, job ID, path ID, and step ID.
 *
 * **Validates: Requirement 3.3**
 */
describe('Property 4: Audit trail records note creation', () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = createReusableTestContext()
  })
  afterAll(() => {
    ctx?.cleanup()
  })

  it('audit log contains exactly one new note_created entry with matching fields', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }), // partCount
        fc.stringMatching(/^[a-z][a-z0-9_]{0,19}$/), // userId
        fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 .,!?-]{0,199}$/), // noteText
        fc.infiniteStream(fc.boolean()), // partSelection
        (partCount, userId, noteText, partSelectionStream) => {
          savepoint(ctx.db)
          try {
            const { jobService, pathService, partService, noteService, auditService } = ctx

            // Set up job → path → step → parts
            const job = jobService.createJob({ name: 'Audit Trail Test', goalQuantity: partCount })
            const path = pathService.createPath({
              jobId: job.id,
              name: 'Route',
              goalQuantity: partCount,
              steps: [{ name: 'Step 1' }],
            })
            const parts = partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: partCount },
              'user_setup',
            )

            // Select a non-empty subset of parts
            const selectedPartIds: string[] = []
            const iter = partSelectionStream[Symbol.iterator]()
            for (const part of parts) {
              if (iter.next().value) {
                selectedPartIds.push(part.id)
              }
            }
            if (selectedPartIds.length === 0) {
              selectedPartIds.push(parts[0].id)
            }

            // Snapshot audit entries before note creation
            const auditBefore = auditService.getJobAuditTrail(job.id)
            const noteCreatedBefore = auditBefore.filter(e => e.action === 'note_created')

            // Create the note
            noteService.createNote({
              jobId: job.id,
              pathId: path.id,
              stepId: path.steps[0].id,
              partIds: selectedPartIds,
              text: noteText,
              userId,
            })

            // Snapshot audit entries after note creation
            const auditAfter = auditService.getJobAuditTrail(job.id)
            const noteCreatedAfter = auditAfter.filter(e => e.action === 'note_created')

            // Property: exactly one new note_created entry
            expect(noteCreatedAfter.length).toBe(noteCreatedBefore.length + 1)

            // Find the new entry (the one not in the before set)
            const beforeIds = new Set(noteCreatedBefore.map(e => e.id))
            const newEntries = noteCreatedAfter.filter(e => !beforeIds.has(e.id))
            expect(newEntries).toHaveLength(1)

            const entry = newEntries[0]

            // Property: matching userId, jobId, pathId, stepId
            expect(entry.userId).toBe(userId)
            expect(entry.jobId).toBe(job.id)
            expect(entry.pathId).toBe(path.id)
            expect(entry.stepId).toBe(path.steps[0].id)
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Property 5: Whitespace-only text is rejected', () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = createReusableTestContext()
  })
  afterAll(() => {
    ctx?.cleanup()
  })

  it('createNote throws ValidationError for any whitespace-only string and persists no note', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 50 }).map(chars => chars.join('')),
        (whitespaceText) => {
          savepoint(ctx.db)
          try {
            const { jobService, pathService, partService, noteService } = ctx

            // Set up minimal job → path → step → part
            const job = jobService.createJob({ name: 'Whitespace Test', goalQuantity: 1 })
            const path = pathService.createPath({
              jobId: job.id,
              name: 'Route',
              goalQuantity: 1,
              steps: [{ name: 'Step 1' }],
            })
            const parts = partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: 1 },
              'user_setup',
            )

            const stepId = path.steps[0].id

            // Property: createNote must throw a ValidationError for whitespace-only text
            expect(() =>
              noteService.createNote({
                jobId: job.id,
                pathId: path.id,
                stepId,
                partIds: [parts[0].id],
                text: whitespaceText,
                userId: 'user_noter',
              }),
            ).toThrow(ValidationError)

            // Property: no notes persisted for this step
            const notes = noteService.getNotesForStep(stepId)
            expect(notes).toHaveLength(0)
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
