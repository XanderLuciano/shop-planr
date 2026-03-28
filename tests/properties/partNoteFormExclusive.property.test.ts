/**
 * Feature: serial-number-notes-add
 * Property 3: Add Note button and form are mutually exclusive
 *
 * For any UI state, the "Add Note" button and the inline note form must never
 * both be visible simultaneously. When the form is shown, the button is hidden,
 * and vice versa.
 *
 * **Validates: Requirements 2.3**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// --- Pure model function ---

/**
 * Computes visibility of the Add Note button and the note form.
 * Mirrors the template logic in parts-browser/[id].vue:
 *   - Button: v-if="isInProgress && !showNoteForm"
 *   - Form:   v-if="showNoteForm"
 */
function computeVisibility(isInProgress: boolean, showNoteForm: boolean): {
  buttonVisible: boolean
  formVisible: boolean
} {
  return {
    buttonVisible: isInProgress && !showNoteForm,
    formVisible: showNoteForm,
  }
}

// --- Tests ---

describe('Property 3: Add Note button and form are mutually exclusive', () => {
  it('button and form are never both visible at the same time', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (isInProgress, showNoteForm) => {
        const { buttonVisible, formVisible } = computeVisibility(isInProgress, showNoteForm)

        // They must never both be true
        expect(buttonVisible && formVisible).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  it('when form is visible, button is always hidden', () => {
    fc.assert(
      fc.property(fc.boolean(), (isInProgress) => {
        const { buttonVisible, formVisible } = computeVisibility(isInProgress, true)

        expect(formVisible).toBe(true)
        expect(buttonVisible).toBe(false)
      }),
      { numRuns: 100 },
    )
  })
})
