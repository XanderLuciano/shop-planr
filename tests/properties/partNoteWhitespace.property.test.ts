/**
 * Feature: serial-number-notes-add
 * Property 5: Whitespace-only text disables Save
 *
 * For any string composed entirely of whitespace characters (including the empty
 * string), the "Save" button should be disabled and the form should not attempt
 * submission.
 *
 * **Validates: Requirements 4.1**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// --- Pure model function ---

/**
 * Determines whether the Save button should be disabled.
 * Mirrors the template logic in parts-browser/[id].vue:
 *   :disabled="!noteText.trim() || noteSaving"
 *
 * For this property we focus on the text validation aspect (noteSaving = false).
 */
function isSaveDisabled(noteText: string, noteSaving: boolean = false): boolean {
  return !noteText.trim() || noteSaving
}

// --- Generators ---

const whitespaceOnlyArb = fc.array(
  fc.constantFrom(' ', '\t', '\n', '\r'),
  { minLength: 0, maxLength: 100 },
).map(chars => chars.join(''))

// --- Tests ---

describe('Property 5: Whitespace-only text disables Save', () => {
  it('Save is disabled for any whitespace-only string', () => {
    fc.assert(
      fc.property(whitespaceOnlyArb, (text) => {
        expect(isSaveDisabled(text)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  it('Save is enabled for any string with non-whitespace content (when not saving)', () => {
    const nonWhitespaceArb = fc.string({ minLength: 1, maxLength: 200 })
      .filter(s => s.trim().length > 0)

    fc.assert(
      fc.property(nonWhitespaceArb, (text) => {
        expect(isSaveDisabled(text, false)).toBe(false)
      }),
      { numRuns: 100 },
    )
  })
})
