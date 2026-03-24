/**
 * Property 2: Validation rejects empty/whitespace names
 *
 * For any form state where the job name, any path name, or any step name is a string
 * composed entirely of whitespace (including the empty string), calling validate()
 * should return { valid: false } with at least one error referencing the offending field.
 *
 * **Validates: Requirements 2.3, 3.4, 4.4**
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

// Arbitrary that produces whitespace-only strings (including empty)
const whitespaceArb = fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 10 }).map(chars => chars.join(''))

describe('Property 2: Validation rejects empty/whitespace names', () => {
  it('rejects whitespace-only job name', () => {
    fc.assert(
      fc.property(whitespaceArb, (wsName) => {
        const { jobDraft, validate } = useJobForm('create')
        jobDraft.value.name = wsName
        jobDraft.value.goalQuantity = 1

        const result = validate()
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => e.field === 'job.name')).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  it('rejects whitespace-only path name', () => {
    fc.assert(
      fc.property(whitespaceArb, (wsName) => {
        const { jobDraft, pathDrafts, addPath, validate } = useJobForm('create')
        jobDraft.value.name = 'Valid Job'
        jobDraft.value.goalQuantity = 1

        addPath()
        const path = pathDrafts.value[0]
        path.name = wsName
        path.goalQuantity = 1
        path.steps[0].name = 'Valid Step'

        const result = validate()
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => e.field === 'paths[0].name')).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  it('rejects whitespace-only step name', () => {
    fc.assert(
      fc.property(whitespaceArb, (wsName) => {
        const { jobDraft, pathDrafts, addPath, validate } = useJobForm('create')
        jobDraft.value.name = 'Valid Job'
        jobDraft.value.goalQuantity = 1

        addPath()
        const path = pathDrafts.value[0]
        path.name = 'Valid Path'
        path.goalQuantity = 1
        path.steps[0].name = wsName

        const result = validate()
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => e.field === 'paths[0].steps[0].name')).toBe(true)
      }),
      { numRuns: 100 },
    )
  })
})
