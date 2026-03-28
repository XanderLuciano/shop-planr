/**
 * Properties 1 & 3: isPageEnabled route matching
 *
 * - Property 1: Always-visible invariant — `/` and `/settings` always return `true`
 * - Property 3: Route access matches toggle state — `isPageEnabled` returns `false`
 *   only when route maps to a toggle key that is `false`; detail routes inherit parent toggle
 *
 * **Validates: Requirements 4.2, 5.1, 5.2, 5.3, 5.4, 6.1**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  isPageEnabled,
  ROUTE_TOGGLE_MAP,
} from '~/server/utils/pageToggles'
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

/** All base paths from ROUTE_TOGGLE_MAP. */
const BASE_PATHS = Object.keys(ROUTE_TOGGLE_MAP)

/** Arbitrary that produces a random detail route suffix (e.g., `/123`, `/abc/def`). */
const arbDetailSuffix: fc.Arbitrary<string> = fc
  .array(fc.stringMatching(/^[a-z0-9]{1,8}$/), { minLength: 1, maxLength: 3 })
  .map((segments) => '/' + segments.join('/'))

describe('Property 1: Always-visible invariant', () => {
  /**
   * **Validates: Requirements 4.2, 5.3, 6.1**
   *
   * For any PageToggles configuration (including all-false, partial, or mixed),
   * `/` and `/settings` always return `true`.
   */
  it('`/` always returns true for any PageToggles configuration', () => {
    fc.assert(
      fc.property(arbPageToggles, (toggles) => {
        expect(isPageEnabled(toggles, '/')).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  it('`/settings` always returns true for any PageToggles configuration', () => {
    fc.assert(
      fc.property(arbPageToggles, (toggles) => {
        expect(isPageEnabled(toggles, '/settings')).toBe(true)
      }),
      { numRuns: 200 },
    )
  })
})

describe('Property 3: Route access matches toggle state', () => {
  /**
   * **Validates: Requirements 5.1, 5.2, 5.4**
   *
   * `isPageEnabled` returns `false` only when route maps to a toggle key that is `false`.
   * Detail routes inherit their parent toggle.
   */
  it('base route returns false iff its toggle key is false', () => {
    fc.assert(
      fc.property(
        arbPageToggles,
        fc.constantFrom(...BASE_PATHS),
        (toggles, basePath) => {
          const toggleKey = ROUTE_TOGGLE_MAP[basePath]
          const result = isPageEnabled(toggles, basePath)
          expect(result).toBe(toggles[toggleKey] !== false)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('detail routes inherit their parent page toggle', () => {
    fc.assert(
      fc.property(
        arbPageToggles,
        fc.constantFrom(...BASE_PATHS),
        arbDetailSuffix,
        (toggles, basePath, suffix) => {
          const detailRoute = basePath + suffix
          const toggleKey = ROUTE_TOGGLE_MAP[basePath]
          const result = isPageEnabled(toggles, detailRoute)
          expect(result).toBe(toggles[toggleKey] !== false)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('routes with no toggle mapping always return true', () => {
    /** Arbitrary for routes that don't match any ROUTE_TOGGLE_MAP entry. */
    const arbUnmappedRoute: fc.Arbitrary<string> = fc
      .stringMatching(/^\/[a-z]{2,10}$/)
      .filter((route) => {
        // Exclude always-visible routes and any route that starts with a mapped base path
        if (route === '/' || route === '/settings') return false
        return !BASE_PATHS.some((bp) => route === bp || route.startsWith(bp + '/'))
      })

    fc.assert(
      fc.property(arbPageToggles, arbUnmappedRoute, (toggles, route) => {
        expect(isPageEnabled(toggles, route)).toBe(true)
      }),
      { numRuns: 200 },
    )
  })
})
