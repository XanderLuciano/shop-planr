/**
 * Property 6: Validation rejects paths with zero steps
 *
 * For any form state containing at least one PathDraft that has zero StepDrafts,
 * calling validate() should return { valid: false } with at least one error
 * indicating that path needs at least one step.
 *
 * **Validates: Requirements 4.3**
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

import { useJobForm, type PathDraft, type StepDraft } from '~/app/composables/useJobForm'

describe('Property 6: Validation rejects paths with zero steps', () => {
  it('validate returns valid:false with error on paths[i].steps when a path has zero steps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 0, max: 4 }),
        (pathCount, zeroStepIdx) => {
          const actualZeroIdx = zeroStepIdx % pathCount
          const { jobDraft, pathDrafts, addPath, validate } = useJobForm('create')

          // Set a valid job name so validation doesn't fail on that
          jobDraft.value.name = 'Test Job'
          jobDraft.value.goalQuantity = 1

          // Add paths
          for (let i = 0; i < pathCount; i++) {
            addPath()
            pathDrafts.value[i].name = `Path-${i}`
            pathDrafts.value[i].steps[0].name = `Step-${i}`
          }

          // Clear steps on the target path to create zero-step condition
          pathDrafts.value[actualZeroIdx].steps = []

          const result = validate()

          // Must be invalid
          expect(result.valid).toBe(false)

          // Must have an error referencing the zero-step path's steps field
          const stepsError = result.errors.find(
            e => e.field === `paths[${actualZeroIdx}].steps`,
          )
          expect(stepsError).toBeDefined()
        },
      ),
      { numRuns: 100 },
    )
  })
})
