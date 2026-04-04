/**
 * Property 3: All other toggle-mapped routes are unaffected
 *
 * For any toggle config and any route in ROUTE_TOGGLE_MAP (excluding `/parts`),
 * `isPageEnabled` equals the corresponding toggle value.
 *
 * **Validates: Requirements 3.1, 3.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  isPageEnabled,
  ROUTE_TOGGLE_MAP,
} from '~/server/utils/pageToggles'
import { arbPageToggles } from './arbitraries/pageToggles'

/** Non-/parts entries from ROUTE_TOGGLE_MAP as [basePath, toggleKey] tuples. */
const NON_PARTS_ENTRIES = Object.entries(ROUTE_TOGGLE_MAP).filter(
  ([bp]) => bp !== '/parts',
)

/** Arbitrary that produces a random detail route suffix (e.g., `/abc123`, `/foo/bar`). */
const arbDetailSuffix: fc.Arbitrary<string> = fc
  .array(fc.stringMatching(/^[a-z0-9]{1,8}$/), { minLength: 1, maxLength: 3 })
  .map(segments => '/' + segments.join('/'))

describe('Property 3: All other toggle-mapped routes are unaffected', () => {
  /**
   * **Validates: Requirements 3.1**
   *
   * For all base paths in ROUTE_TOGGLE_MAP (excluding `/parts`),
   * `isPageEnabled(toggles, basePath)` equals `toggles[toggleKey]`.
   */
  it('base routes return their corresponding toggle value', () => {
    fc.assert(
      fc.property(
        arbPageToggles,
        fc.constantFrom(...NON_PARTS_ENTRIES),
        (toggles, [basePath, toggleKey]) => {
          expect(isPageEnabled(toggles, basePath)).toBe(toggles[toggleKey])
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * **Validates: Requirements 3.2**
   *
   * Detail routes under non-/parts base paths (e.g., `/jobs/abc123`)
   * inherit the corresponding toggle value.
   */
  it('detail routes inherit their parent toggle value', () => {
    fc.assert(
      fc.property(
        arbPageToggles,
        fc.constantFrom(...NON_PARTS_ENTRIES),
        arbDetailSuffix,
        (toggles, [basePath, toggleKey], suffix) => {
          const detailRoute = basePath + suffix
          expect(isPageEnabled(toggles, detailRoute)).toBe(toggles[toggleKey])
        },
      ),
      { numRuns: 200 },
    )
  })
})
