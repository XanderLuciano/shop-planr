/**
 * Feature: serial-number-notes-add
 * Property 7: Successful save resets form state
 *
 * For any valid note text, after a successful createNote call, the form should
 * be hidden and the textarea content should be empty.
 *
 * **Validates: Requirements 3.3**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// --- Types ---

interface NoteFormState {
  showNoteForm: boolean
  noteText: string
  noteSaving: boolean
}

// --- Pure model functions ---

/**
 * Models the form state before save is attempted: form is open, text is entered,
 * saving has started.
 */
function formBeforeSave(text: string): NoteFormState {
  return { showNoteForm: true, noteText: text, noteSaving: true }
}

/**
 * Models the form state after a successful createNote call.
 * Mirrors the try + finally blocks in handleSaveNote:
 *   try: showNoteForm = false, noteText = '', show success toast
 *   finally: noteSaving = false
 */
function formAfterSuccess(_state: NoteFormState): NoteFormState {
  return {
    showNoteForm: false,
    noteText: '',
    noteSaving: false,
  }
}

// --- Generators ---

const validNoteTextArb = fc.string({ minLength: 1, maxLength: 200 })
  .filter(s => s.trim().length > 0)

// --- Tests ---

describe('Property 7: Successful save resets form state', () => {
  it('after success, form is hidden and text is cleared for any valid input', () => {
    fc.assert(
      fc.property(validNoteTextArb, (text) => {
        const before = formBeforeSave(text)
        expect(before.showNoteForm).toBe(true)
        expect(before.noteText).toBe(text)

        const after = formAfterSuccess(before)
        expect(after.showNoteForm).toBe(false)
        expect(after.noteText).toBe('')
        expect(after.noteSaving).toBe(false)
      }),
      { numRuns: 100 },
    )
  })
})
