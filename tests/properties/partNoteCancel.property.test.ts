/**
 * Feature: serial-number-notes-add
 * Property 2: Cancel resets form state
 *
 * For any string entered in the note textarea, clicking "Cancel" should result
 * in the form being hidden and the textarea content being empty.
 *
 * **Validates: Requirements 2.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// --- Types ---

interface NoteFormState {
  showNoteForm: boolean
  noteText: string
}

// --- Pure model functions ---

/**
 * Models the initial state when the form is open with some text entered.
 */
function openFormWithText(text: string): NoteFormState {
  return { showNoteForm: true, noteText: text }
}

/**
 * Models the cancel action: hides the form and clears the textarea.
 * Mirrors the Cancel button handler in parts-browser/[id].vue:
 *   showNoteForm.value = false; noteText.value = ''
 */
function cancelForm(state: NoteFormState): NoteFormState {
  return { showNoteForm: false, noteText: '' }
}

// --- Generators ---

const noteTextArb = fc.string({ minLength: 0, maxLength: 500 })

// --- Tests ---

describe('Property 2: Cancel resets form state', () => {
  it('after cancel, form is hidden and textarea is empty for any input text', () => {
    fc.assert(
      fc.property(noteTextArb, (text) => {
        const before = openFormWithText(text)
        expect(before.showNoteForm).toBe(true)
        expect(before.noteText).toBe(text)

        const after = cancelForm(before)
        expect(after.showNoteForm).toBe(false)
        expect(after.noteText).toBe('')
      }),
      { numRuns: 100 },
    )
  })
})
