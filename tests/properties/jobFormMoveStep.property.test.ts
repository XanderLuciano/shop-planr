/**
 * Property 8: moveStep is a valid swap permutation
 *
 * For a PathDraft with N steps (N >= 2) and any step at index i, calling
 * moveStep(pathClientId, stepClientId, direction) should: if the move is valid
 * (not first moving up, not last moving down), swap the step with its neighbor,
 * preserving the complete set of steps. If the move is invalid, the steps array
 * should remain unchanged.
 *
 * **Validates: Requirements 5.3, 5.4, 5.5**
 */
import { describe, it, vi } from 'vitest'
import fc from 'fast-check'

// Stub auto-imported composables
vi.stubGlobal('useJobs', () => ({
  createJob: vi.fn(),
  updateJob: vi.fn(),
}))
vi.stubGlobal('usePaths', () => ({
  createPath: vi.fn(),
  updatePath: vi.fn(),
  deletePath: vi.fn(),
}))

import { useJobForm } from '~/app/composables/useJobForm'

describe('Property 8: moveStep is a valid swap permutation', () => {
  it('swaps correctly for valid moves and is a no-op for invalid moves', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }),
        fc.nat(),
        fc.constantFrom(-1 as const, 1 as const),
        (stepCount, stepIdxSeed, direction) => {
          const { pathDrafts, addPath, addStep, moveStep } = useJobForm('create')
          addPath()

          const path = pathDrafts.value[0]

          // Add extra steps
          for (let i = 1; i < stepCount; i++) {
            addStep(path._clientId)
          }

          // Name steps for identification
          path.steps.forEach((s, i) => { s.name = `Step-${i}` })

          const stepIdx = stepIdxSeed % path.steps.length
          const targetClientId = path.steps[stepIdx]._clientId

          // Snapshot before move
          const clientIdsBefore = path.steps.map(s => s._clientId)

          const isInvalidMove
            = (stepIdx === 0 && direction === -1)
            || (stepIdx === path.steps.length - 1 && direction === 1)

          moveStep(path._clientId, targetClientId, direction)

          const clientIdsAfter = path.steps.map(s => s._clientId)

          if (isInvalidMove) {
            // Steps unchanged
            expect(clientIdsAfter).toEqual(clientIdsBefore)
          }
          else {
            const targetIdx = stepIdx + direction

            // The two swapped positions should have exchanged
            expect(clientIdsAfter[targetIdx]).toBe(clientIdsBefore[stepIdx])
            expect(clientIdsAfter[stepIdx]).toBe(clientIdsBefore[targetIdx])

            // All other positions unchanged
            for (let i = 0; i < clientIdsBefore.length; i++) {
              if (i !== stepIdx && i !== targetIdx) {
                expect(clientIdsAfter[i]).toBe(clientIdsBefore[i])
              }
            }

            // Same set of clientIds (no duplicates, no losses)
            expect([...clientIdsAfter].sort()).toEqual([...clientIdsBefore].sort())
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
