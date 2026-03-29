/**
 * Properties 1–2: resolveBackNavigation
 *
 * - Property 1: Bug Condition — Back Arrow Returns to Job Detail Page
 * - Property 2: Preservation — Default Back Navigation to Parts
 *
 * **Validates: Requirements 2.1, 2.2, 3.1, 3.2, 3.3, 6.1, 6.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { resolveBackNavigation } from '~/app/utils/resolveBackNavigation'

/** Arbitrary that produces a non-empty alphanumeric/dash/underscore job ID. */
const arbJobId = fc.stringMatching(/^[A-Za-z0-9_-]+$/, { minLength: 1 })

describe('Property 1: Bug Condition — Back Arrow Returns to Job Detail Page', () => {
  /**
   * **Validates: Requirements 2.1, 2.2**
   *
   * For any valid job path (`/jobs/{id}`), `resolveBackNavigation` returns
   * that path with label "Back to Job".
   */
  it('returns the job path and "Back to Job" label for any /jobs/{id} input', () => {
    fc.assert(
      fc.property(arbJobId, (jobId) => {
        const jobPath = `/jobs/${jobId}`
        const result = resolveBackNavigation(jobPath)

        expect(result.to).toBe(jobPath)
        expect(result.label).toBe('Back to Job')
      }),
      { numRuns: 200 }
    )
  })
})

describe('Property 2: Preservation — Default Back Navigation to Parts', () => {
  /**
   * **Validates: Requirements 3.1, 3.2, 3.3, 6.1, 6.2**
   *
   * For any string that does NOT start with `/jobs/`, `resolveBackNavigation`
   * returns `/parts` with label "Back to Parts".
   */
  it('returns /parts and "Back to Parts" for any string not starting with /jobs/', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.startsWith('/jobs/')),
        (input) => {
          const result = resolveBackNavigation(input)

          expect(result.to).toBe('/parts')
          expect(result.label).toBe('Back to Parts')
        }
      ),
      { numRuns: 200 }
    )
  })

  it('returns /parts and "Back to Parts" for undefined input', () => {
    const result = resolveBackNavigation(undefined)

    expect(result.to).toBe('/parts')
    expect(result.label).toBe('Back to Parts')
  })

  it('returns /parts and "Back to Parts" for empty string input', () => {
    const result = resolveBackNavigation('')

    expect(result.to).toBe('/parts')
    expect(result.label).toBe('Back to Parts')
  })
})
