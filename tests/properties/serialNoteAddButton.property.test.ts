/**
 * Feature: serial-number-notes-add
 * Property 1: Add Note button visibility matches serial status
 *
 * For any serial number, the "Add Note" button should be visible if and only if
 * the serial's status is in-progress. For completed or scrapped serials, the
 * button must not be rendered.
 *
 * **Validates: Requirements 1.1, 1.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// --- Types ---

type SerialStatus = 'in_progress' | 'completed' | 'scrapped'

// --- Pure model function ---

/**
 * Given a serial status, returns whether the Add Note button should be visible.
 * Mirrors the `isInProgress` computed in serials/[id].vue.
 */
function isAddNoteButtonVisible(status: SerialStatus): boolean {
  return status === 'in_progress'
}

// --- Generators ---

const serialStatusArb: fc.Arbitrary<SerialStatus> = fc.constantFrom(
  'in_progress' as const,
  'completed' as const,
  'scrapped' as const,
)

// --- Tests ---

describe('Property 1: Add Note button visibility matches serial status', () => {
  it('button is visible if and only if status is in_progress', () => {
    fc.assert(
      fc.property(serialStatusArb, (status) => {
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
