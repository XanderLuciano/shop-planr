/**
 * Property 4: Dashboard and Settings are always enabled
 *
 * For any page toggle configuration, `isPageEnabled(toggles, '/')` and
 * `isPageEnabled(toggles, '/settings')` always return `true`.
 *
 * **Validates: Requirements 5.1, 5.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { isPageEnabled } from '~/server/utils/pageToggles'
import type { PageToggles } from '~/server/types/domain'

/** Arbitrary that produces a full PageToggles object with random booleans. */
const arbPageToggles: fc.Arbitrary<PageToggles> = fc.record({
  jobs: fc.boolean(),
  serials: fc.boolean(),
  parts: fc.boolean(),
  queue: fc.boolean(),
  templates: fc.boolean(),
  bom: fc.boolean(),
  certs: fc.boolean(),
  jira: fc.boolean(),
  audit: fc.boolean(),
})

describe('Property 4: Dashboard and Settings are always enabled', () => {
  /**
   * **Validates: Requirements 5.1**
   *
   * For any PageToggles configuration, `isPageEnabled(toggles, '/')` returns `true`.
   */
  it('`/` always returns true for any PageToggles configuration', () => {
    fc.assert(
      fc.property(arbPageToggles, (toggles) => {
        expect(isPageEnabled(toggles, '/')).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * **Validates: Requirements 5.2**
   *
   * For any PageToggles configuration, `isPageEnabled(toggles, '/settings')` returns `true`.
   */
  it('`/settings` always returns true for any PageToggles configuration', () => {
    fc.assert(
      fc.property(arbPageToggles, (toggles) => {
        expect(isPageEnabled(toggles, '/settings')).toBe(true)
      }),
      { numRuns: 200 },
    )
  })
})
