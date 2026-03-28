/**
 * Feature: serial-number-notes-add
 * Property 1: Add Note button visibility matches part status
 *
 * For any part, the "Add Note" button should be visible if and only if
 * the part's status is in-progress. For completed or scrapped parts, the
 * button must not be rendered.
 *
 * **Validates: Requirements 1.1, 1.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// --- Types ---

type PartStatus = 'in_progress' | 'completed' | 'scrapped'

// --- Pure model function ---

/**
 * Given a part status, returns whether the Add Note button should be visible.
 * Mirrors the `isInProgress` computed in parts-browser/[id].vue.
 */
function isAddNoteButtonVisible(status: PartStatus): boolean {
  return status === 'in_progress'
}

// --- Generators ---

const partStatusArb: fc.Arbitrary<PartStatus> = fc.constantFrom(
  'in_progress' as const,
  'completed' as const,
  'scrapped' as const,
)

// --- Tests ---

describe('Property 1: Add Note button visibility matches part status', () => {
  it('button is visible if and only if status is in_progress', () => {
    fc.assert(
      fc.property(partStatusArb, (status) => {
        const visible = isAddNoteButtonVisible(status)
        if (status === 'in_progress') {
          expect(visible).toBe(true)
        } else {
          expect(visible).toBe(false)
        }
      }),
      { numRuns: 100 },
    )
  })
})
