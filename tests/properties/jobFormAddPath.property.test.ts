/**
 * Property 4: addPath produces correct defaults
 *
 * For any current job draft with goalQuantity G and any current list of pathDrafts,
 * calling addPath() should: increase the pathDrafts length by exactly 1, and the new
 * PathDraft should have an empty name, goalQuantity equal to G, advancementMode equal
 * to 'strict', and exactly one StepDraft with empty name, empty location, optional=false,
 * and dependencyType='preferred'.
 *
 * **Validates: Requirements 3.1, 6.2, 7.2, 9.2, 10.2**
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

describe('Property 4: addPath produces correct defaults', () => {
  it('new path has correct defaults matching job goalQuantity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 0, max: 5 }),
        (goalQuantity, existingPathCount) => {
          const { jobDraft, pathDrafts, addPath } = useJobForm('create')
          jobDraft.value.goalQuantity = goalQuantity

          // Add some existing paths first
          for (let i = 0; i < existingPathCount; i++) {
            addPath()
          }
          const lengthBefore = pathDrafts.value.length

          // Add the path under test
          addPath()

          // Length increased by exactly 1
          expect(pathDrafts.value.length).toBe(lengthBefore + 1)

          // Inspect the newly added path (last element)
          const newPath = pathDrafts.value[pathDrafts.value.length - 1]
          expect(newPath.name).toBe('')
          expect(newPath.goalQuantity).toBe(goalQuantity)
          expect(newPath.advancementMode).toBe('strict')

          // Exactly one step with correct defaults
          expect(newPath.steps.length).toBe(1)
          const step = newPath.steps[0]
          expect(step.name).toBe('')
          expect(step.location).toBe('')
          expect(step.optional).toBe(false)
          expect(step.dependencyType).toBe('preferred')

          // _clientId should be a non-empty string
          expect(typeof newPath._clientId).toBe('string')
          expect(newPath._clientId.length).toBeGreaterThan(0)
          expect(typeof step._clientId).toBe('string')
          expect(step._clientId.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
