// Feature: navigation-stack, Property 6: Back Navigation from Non-Empty Stack
// Feature: navigation-stack, Property 7: Back Navigation Fallback from Empty Stack
/**
 * Properties 6, 7: Back Navigation from Non-Empty Stack,
 * Back Navigation Fallback from Empty Stack
 *
 * **Validates: Requirements 4.2, 4.3, 5.1, 5.3**
 *
 * Verifies back navigation logic:
 * - Non-empty stack: returns top entry path and "Back to {label}"
 * - Empty stack: returns fallback route and "Back to {fallbackLabel}"
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { arbNavigationEntry, arbRoutePath } from './arbitraries/navigationStack'
import type { NavigationEntry } from './arbitraries/navigationStack'
import { resolveLabel } from '~/app/utils/navigationLabels'
import { resolveFallbackRoute } from '~/app/utils/navigationFallbacks'

function computeBackNavigation(stack: NavigationEntry[], currentPath: string) {
  if (stack.length > 0) {
    const top = stack[stack.length - 1]
    return { to: top.path, label: `Back to ${top.label}` }
  }
  const fallbackPath = resolveFallbackRoute(currentPath)
  const fallbackLabel = resolveLabel(fallbackPath)
  return { to: fallbackPath, label: `Back to ${fallbackLabel}` }
}

describe('Property 6: Back Navigation from Non-Empty Stack', () => {
  // Feature: navigation-stack, Property 6: Back Navigation from Non-Empty Stack

  /**
   * **Validates: Requirements 4.2, 4.3**
   *
   * When the stack is non-empty, back navigation returns the top entry's
   * path and "Back to {label}".
   */
  it('returns top entry path and "Back to {label}" when stack is non-empty', () => {
    fc.assert(
      fc.property(
        fc.array(arbNavigationEntry, { minLength: 1, maxLength: 20 }),
        arbRoutePath,
        (entries, currentPath) => {
          const result = computeBackNavigation(entries, currentPath)
          const top = entries[entries.length - 1]
          expect(result.to).toBe(top.path)
          expect(result.label).toBe(`Back to ${top.label}`)
        },
      ),
      { numRuns: 200 },
    )
  })
})

describe('Property 7: Back Navigation Fallback from Empty Stack', () => {
  // Feature: navigation-stack, Property 7: Back Navigation Fallback from Empty Stack

  /**
   * **Validates: Requirements 5.1, 5.3**
   *
   * When the stack is empty, back navigation returns the fallback route
   * for the current path and "Back to {fallbackLabel}".
   */
  it('returns fallback route and label when stack is empty', () => {
    fc.assert(
      fc.property(arbRoutePath, (currentPath) => {
        const result = computeBackNavigation([], currentPath)
        const expectedFallback = resolveFallbackRoute(currentPath)
        const expectedLabel = resolveLabel(expectedFallback)
        expect(result.to).toBe(expectedFallback)
        expect(result.label).toBe(`Back to ${expectedLabel}`)
      }),
      { numRuns: 200 },
    )
  })
})
