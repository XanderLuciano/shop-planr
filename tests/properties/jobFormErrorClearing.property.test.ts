/**
 * Property 11: Error clearing on field correction
 *
 * For any form state that has validation errors, when clearFieldError is called
 * for a specific field, the errors array should no longer contain an error for
 * that specific field, while errors for other fields remain.
 *
 * **Validates: Requirements 14.4**
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
vi.stubGlobal('useUsers', () => ({
  requireUser: () => ({ id: 'test-user-id', username: 'test', displayName: 'Test', isAdmin: true, active: true, createdAt: '' }),
}))

import { useJobForm } from '~/app/composables/useJobForm'

describe('Property 11: Error clearing on field correction', () => {
  it('clearFieldError removes only the targeted field error, others remain', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 3 }),
        (pathCount, stepsPerPath) => {
          const { jobDraft, pathDrafts, addPath, addStep, validate, errors, clearFieldError } = useJobForm('create')

          // Leave job name empty to trigger job.name error
          jobDraft.value.name = ''
          jobDraft.value.goalQuantity = 1

          // Add paths with empty names and steps with empty names
          for (let i = 0; i < pathCount; i++) {
            addPath()
            pathDrafts.value[i].name = '' // empty to trigger error
            pathDrafts.value[i].steps[0].name = '' // empty to trigger error
            for (let j = 1; j < stepsPerPath; j++) {
              addStep(pathDrafts.value[i]._clientId)
              // steps added with empty name by default
            }
          }

          // Validate to populate errors
          const result = validate()
          expect(result.valid).toBe(false)
          expect(errors.value.length).toBeGreaterThan(1)

          // Pick a random error field to clear
          const errorFields = errors.value.map(e => e.field)
          const fieldToClear = errorFields[0]
          const otherFields = errorFields.filter(f => f !== fieldToClear)
          const errorCountBefore = errors.value.length

          // Clear the targeted field error
          clearFieldError(fieldToClear)

          // The cleared field should no longer have an error
          expect(errors.value.find(e => e.field === fieldToClear)).toBeUndefined()

          // All other errors should remain
          for (const otherField of otherFields) {
            expect(errors.value.find(e => e.field === otherField)).toBeDefined()
          }

          // Total errors decreased by exactly the number of errors for that field
          // (should be 1 since each field produces at most 1 error)
          expect(errors.value.length).toBe(errorCountBefore - 1)
        },
      ),
      { numRuns: 100 },
    )
  })
})
