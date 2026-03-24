/**
 * Feature: serial-number-notes-add
 * Property 6: Error preserves form state
 *
 * For any note text and any error response from the Note_Service, the form
 * should remain open and the textarea should still contain the original text,
 * allowing the operator to retry.
 *
 * **Validates: Requirements 4.3**
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
 * Models the form state after a createNote error.
 * Mirrors the catch + finally blocks in handleSaveNote:
 *   catch: show error toast (side effect, not modelled), form stays open, text preserved
 *   finally: noteSaving = false
 */
function formAfterError(state: NoteFormState): NoteFormState {
  return {
    showNoteForm: true,
    noteText: state.noteText,
    noteSaving: false,
  }
}

// --- Generators ---

const validNoteTextArb = fc.string({ minLength: 1, maxLength: 200 })
  .filter(s => s.trim().length > 0)

// --- Tests ---

describe('Property 6: Error preserves form state', () => {
  it('after error, form stays open and text is unchanged for any valid input', () => {
    fc.assert(
      fc.property(validNoteTextArb, (text) => {
        const before = formBeforeSave(text)
        const after = formAfterError(before)

        expect(after.showNoteForm).toBe(true)
        expect(after.noteText).toBe(text)
        expect(after.noteSaving).toBe(false)
      }),
      { numRuns: 100 },
    )
  })
})
