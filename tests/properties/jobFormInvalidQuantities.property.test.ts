/**
 * Property 3: Validation rejects invalid goal quantities
 *
 * For any form state where the job-level goalQuantity or any path-level goalQuantity
 * is less than 1, calling validate() should return { valid: false } with at least one
 * error referencing the offending quantity field.
 *
 * **Validates: Requirements 2.4, 3.5**
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

// Arbitrary for invalid quantities (≤ 0, including negative and zero)
const invalidQuantityArb = fc.integer({ min: -10000, max: 0 })

describe('Property 3: Validation rejects invalid goal quantities', () => {
  it('rejects job goalQuantity less than 1', () => {
    fc.assert(
      fc.property(invalidQuantityArb, (badQty) => {
        const { jobDraft, validate } = useJobForm('create')
        jobDraft.value.name = 'Valid Job'
        jobDraft.value.goalQuantity = badQty

        const result = validate()
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => e.field === 'job.goalQuantity')).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  it('rejects path goalQuantity less than 1', () => {
    fc.assert(
      fc.property(invalidQuantityArb, (badQty) => {
        const { jobDraft, pathDrafts, addPath, validate } = useJobForm('create')
        jobDraft.value.name = 'Valid Job'
        jobDraft.value.goalQuantity = 1

        addPath()
        const path = pathDrafts.value[0]
        path.name = 'Valid Path'
        path.goalQuantity = badQty
        path.steps[0].name = 'Valid Step'

        const result = validate()
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => e.field === 'paths[0].goalQuantity')).toBe(true)
      }),
      { numRuns: 100 },
    )
  })
})
