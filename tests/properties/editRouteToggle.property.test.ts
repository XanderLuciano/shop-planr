/**
 * Property 1: Edit route toggle inheritance
 *
 * Test that ∀ toggles ∈ PageToggles, id ∈ AlphanumericStrings:
 *   isPageEnabled(toggles, '/jobs/edit/' + id) === toggles.jobs
 *
 * The new `/jobs/edit/:id` route inherits the `jobs` toggle,
 * matching the existing detail route behavior.
 *
 * **Validates: Requirements 6.1, 6.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { isPageEnabled } from '~/server/utils/pageToggles'
import type { PageToggles } from '~/server/types/domain'

/** Arbitrary that produces a full PageToggles object with random booleans. */
const arbPageToggles: fc.Arbitrary<PageToggles> = fc.record({
  jobs: fc.boolean(),
  partsBrowser: fc.boolean(),
  parts: fc.boolean(),
  queue: fc.boolean(),
  templates: fc.boolean(),
  bom: fc.boolean(),
  certs: fc.boolean(),
  jira: fc.boolean(),
  audit: fc.boolean(),
})

/** Arbitrary that produces a random alphanumeric ID string. */
const arbAlphanumericId: fc.Arbitrary<string> = fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/)

describe('Property 1: Edit route toggle inheritance', () => {
  /**
   * **Validates: Requirements 6.1, 6.2**
   *
   * For any PageToggles and any alphanumeric ID,
   * `isPageEnabled(toggles, '/jobs/edit/' + id)` equals `toggles.jobs`.
   */
  it('`/jobs/edit/:id` inherits the `jobs` toggle', () => {
    fc.assert(
      fc.property(arbPageToggles, arbAlphanumericId, (toggles, id) => {
        expect(isPageEnabled(toggles, '/jobs/edit/' + id)).toBe(toggles.jobs)
      }),
      { numRuns: 200 },
    )
  })
})
