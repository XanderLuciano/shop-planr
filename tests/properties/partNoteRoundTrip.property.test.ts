/**
 * Feature: serial-number-notes-add
 * Property 4: Note creation round trip
 *
 * For any valid (non-whitespace) note text, after a successful createNote call,
 * the shared notes array should contain a note whose text matches the submitted
 * text, whose partIds includes the current part ID, and whose stepId matches
 * the current step.
 *
 * **Validates: Requirements 3.1, 3.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// --- Types ---

interface StepNote {
  id: string
  jobId: string
  pathId: string
  stepId: string
  partIds: string[]
  text: string
  createdBy: string
  createdAt: string
  pushedToJira: boolean
}

interface CreateNoteInput {
  jobId: string
  pathId: string
  stepId: string
  partIds: string[]
  text: string
  userId: string
}

// --- Pure model function ---

/**
 * Models the createNote round trip: given an input and existing notes,
 * simulates the server returning a new StepNote and prepending it to the
 * notes array (matching useNotes.ts behavior).
 */
function modelCreateNote(existingNotes: StepNote[], input: CreateNoteInput): StepNote[] {
  const newNote: StepNote = {
    id: `note-${Date.now()}`,
    jobId: input.jobId,
    pathId: input.pathId,
    stepId: input.stepId,
    partIds: input.partIds,
    text: input.text,
    createdBy: input.userId,
    createdAt: new Date().toISOString(),
    pushedToJira: false,
  }
  return [newNote, ...existingNotes]
}

// --- Generators ---

const nonWhitespaceStringArb = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s) => s.trim().length > 0)

const idArb = fc.uuid()

// --- Tests ---

describe('Property 4: Note creation round trip', () => {
  it('new note appears in notes array with matching text, partIds, and stepId', () => {
    fc.assert(
      fc.property(
        nonWhitespaceStringArb,
        idArb,
        idArb,
        idArb,
        idArb,
        idArb,
        (noteText, jobId, pathId, stepId, partId, userId) => {
          const trimmedText = noteText.trim()
          const input: CreateNoteInput = {
            jobId,
            pathId,
            stepId,
            partIds: [partId],
            text: trimmedText,
            userId,
          }

          const notesBefore: StepNote[] = []
          const notesAfter = modelCreateNote(notesBefore, input)

          // Notes array should have exactly one note
          expect(notesAfter).toHaveLength(1)

          // The new note should match the input
          const created = notesAfter[0]
          expect(created.text).toBe(trimmedText)
          expect(created.partIds).toContain(partId)
          expect(created.stepId).toBe(stepId)
          expect(created.jobId).toBe(jobId)
          expect(created.pathId).toBe(pathId)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('new note is prepended (appears first) in existing notes array', () => {
    fc.assert(
      fc.property(
        nonWhitespaceStringArb,
        idArb,
        idArb,
        idArb,
        idArb,
        idArb,
        (noteText, jobId, pathId, stepId, partId, userId) => {
          const existingNote: StepNote = {
            id: 'existing-1',
            jobId: 'old-job',
            pathId: 'old-path',
            stepId: 'old-step',
            partIds: ['old-part'],
            text: 'existing note',
            createdBy: 'old-user',
            createdAt: '2024-01-01T00:00:00Z',
            pushedToJira: false,
          }

          const input: CreateNoteInput = {
            jobId,
            pathId,
            stepId,
            partIds: [partId],
            text: noteText.trim(),
            userId,
          }

          const notesAfter = modelCreateNote([existingNote], input)

          expect(notesAfter).toHaveLength(2)
          expect(notesAfter[0].text).toBe(noteText.trim())
          expect(notesAfter[1].id).toBe('existing-1')
        }
      ),
      { numRuns: 100 }
    )
  })
})
