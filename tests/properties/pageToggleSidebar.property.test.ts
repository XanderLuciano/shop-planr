/**
 * Properties 2 & 4: Sidebar filtering
 *
 * - Property 2: Toggle-visibility consistency — an item appears in filtered list
 *   iff `isPageEnabled` returns `true` for its route
 * - Property 4: Sidebar item count bounds — filtered items count is always ≥ 2
 *   and ≤ total items
 *
 * **Validates: Requirements 4.1, 6.1, 6.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { isPageEnabled } from '~/server/utils/pageToggles'
import type { PageToggles } from '~/server/types/domain'

/** The same nav items defined in app/layouts/default.vue. */
const navItems = [
  { label: 'Dashboard', to: '/' },
  { label: 'Jobs', to: '/jobs' },
  { label: 'Serials', to: '/serials' },
  { label: 'Parts', to: '/parts' },
  { label: 'Work Queue', to: '/queue' },
  { label: 'Templates', to: '/templates' },
  { label: 'BOM', to: '/bom' },
  { label: 'Certs', to: '/certs' },
  { label: 'Jira', to: '/jira' },
  { label: 'Audit', to: '/audit' },
  { label: 'Settings', to: '/settings' },
]

const TOTAL_ITEMS = navItems.length // 11

/** Replicates the sidebar filtering logic from default.vue. */
function getFilteredNavItems(toggles: PageToggles) {
  return navItems.filter((item) => isPageEnabled(toggles, item.to))
}

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

describe('Property 2: Toggle-visibility consistency', () => {
  /**
   * **Validates: Requirements 4.1**
   *
   * For any PageToggles configuration, an item appears in the filtered sidebar
   * list if and only if `isPageEnabled` returns `true` for its route.
   */
  it('each nav item appears in filtered list iff isPageEnabled returns true for its route', () => {
    fc.assert(
      fc.property(arbPageToggles, (toggles) => {
        const filtered = getFilteredNavItems(toggles)
        const filteredRoutes = new Set(filtered.map((item) => item.to))

        for (const item of navItems) {
          const enabled = isPageEnabled(toggles, item.to)
          expect(filteredRoutes.has(item.to)).toBe(enabled)
        }
      }),
      { numRuns: 200 }
    )
  })
})

describe('Property 4: Sidebar item count bounds', () => {
  /**
   * **Validates: Requirements 6.1, 6.2**
   *
   * For any PageToggles configuration, the filtered sidebar has at least 2 items
   * (Dashboard + Settings) and at most the total number of nav items (11).
   */
  it('filtered items count is always >= 2 and <= total items', () => {
    fc.assert(
      fc.property(arbPageToggles, (toggles) => {
        const filtered = getFilteredNavItems(toggles)
        expect(filtered.length).toBeGreaterThanOrEqual(2)
        expect(filtered.length).toBeLessThanOrEqual(TOTAL_ITEMS)
      }),
      { numRuns: 200 }
    )
  })
})
