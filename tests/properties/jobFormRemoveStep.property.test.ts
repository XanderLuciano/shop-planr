/**
 * Property 7: removeStep enforces minimum-one constraint
 *
 * For a PathDraft with exactly 1 StepDraft, calling removeStep should leave steps
 * unchanged (length remains 1). For a PathDraft with more than 1 StepDraft and any
 * valid step clientId, calling removeStep should decrease the steps length by exactly 1
 * and the removed step should no longer be present.
 *
 * **Validates: Requirements 4.5**
 */
import { describe, it, vi } from 'vitest'
import { ref } from 'vue'
import fc from 'fast-check'

import { useJobForm } from '~/app/composables/useJobForm'

// Stub auto-imported composables
vi.stubGlobal('useAuthFetch', () => vi.fn())
vi.stubGlobal('useJobs', () => ({
  createJob: vi.fn(),
  updateJob: vi.fn(),
}))
vi.stubGlobal('usePaths', () => ({
  createPath: vi.fn(),
  updatePath: vi.fn(),
  deletePath: vi.fn(),
}))
vi.stubGlobal('useAuth', () => ({
  authenticatedUser: ref({ id: 'test-user-id', username: 'test', displayName: 'Test User', isAdmin: true, active: true, createdAt: '2024-01-01' }),
}))

describe('Property 7: removeStep enforces minimum-one constraint', () => {
  it('does not remove the last step when path has exactly one step', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const { pathDrafts, addPath, removeStep } = useJobForm('create')
          addPath()

          const path = pathDrafts.value[0]
          expect(path.steps.length).toBe(1)

          const onlyStepId = path.steps[0]._clientId

          removeStep(path._clientId, onlyStepId)

          // Step should still be there
          expect(path.steps.length).toBe(1)
          expect(path.steps[0]._clientId).toBe(onlyStepId)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('removes exactly the targeted step when path has >1 steps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }),
        fc.nat(),
        (stepCount, removeIdxSeed) => {
          const { pathDrafts, addPath, addStep, removeStep } = useJobForm('create')
          addPath()

          const path = pathDrafts.value[0]

          // Add extra steps (path starts with 1 step)
          for (let i = 1; i < stepCount; i++) {
            addStep(path._clientId)
          }

          // Name steps for identification
          path.steps.forEach((s, i) => {
            s.name = `Step-${i}`
          })

          const removeIdx = removeIdxSeed % path.steps.length
          const targetClientId = path.steps[removeIdx]._clientId
          const lengthBefore = path.steps.length

          // Snapshot other steps' clientIds
          const otherClientIds = path.steps
            .filter(s => s._clientId !== targetClientId)
            .map(s => s._clientId)

          removeStep(path._clientId, targetClientId)

          // Length decreased by exactly 1
          expect(path.steps.length).toBe(lengthBefore - 1)

          // Removed step is gone
          expect(path.steps.find(s => s._clientId === targetClientId)).toBeUndefined()

          // All other steps remain in order
          const remainingClientIds = path.steps.map(s => s._clientId)
          expect(remainingClientIds).toEqual(otherClientIds)
        },
      ),
      { numRuns: 100 },
    )
  })
})
