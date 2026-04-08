// Feature: navigation-stack, Property 12: Invalid Entry Filtering
/**
 * Property 12: Invalid Entry Filtering
 *
 * **Validates: Requirements 9.1, 9.2**
 *
 * Tests the validation logic directly:
 * - Valid entries have a non-empty `path` starting with `/` and a non-empty `label`
 * - Invalid entries are rejected by `isValidEntry`
 * - `backNavigation` skips invalid entries from top of stack, returns first valid one
 * - Falls back to fallback route if no valid entries exist
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { arbNavigationEntry, arbInvalidEntry, arbRoutePath } from './arbitraries/navigationStack'
import type { NavigationEntry } from './arbitraries/navigationStack'
import { resolveLabel } from '~/app/utils/navigationLabels'
import { resolveFallbackRoute } from '~/app/utils/navigationFallbacks'

function isValidEntry(entry: unknown): entry is NavigationEntry {
  return (
    typeof entry === 'object'
    && entry !== null
    && 'path' in entry
    && typeof (entry as NavigationEntry).path === 'string'
    && (entry as NavigationEntry).path.length > 0
    && (entry as NavigationEntry).path.startsWith('/')
    && 'label' in entry
    && typeof (entry as NavigationEntry).label === 'string'
    && (entry as NavigationEntry).label.length > 0
  )
}

function computeBackNavigation(stack: unknown[], currentPath: string) {
  for (let i = stack.length - 1; i >= 0; i--) {
    const entry = stack[i]
    if (isValidEntry(entry)) {
      return { to: entry.path, label: `Back to ${entry.label}` }
    }
  }
  const fallbackPath = resolveFallbackRoute(currentPath)
  const fallbackLabel = resolveLabel(fallbackPath)
  return { to: fallbackPath, label: `Back to ${fallbackLabel}` }
}

describe('Property 12: Invalid Entry Filtering', () => {
  // Feature: navigation-stack, Property 12: Invalid Entry Filtering

  /**
   * **Validates: Requirements 9.1, 9.2**
   *
   * Invalid entries on top of the stack are skipped; the first valid entry
   * beneath them is returned.
   */
  it('invalid entries are skipped, first valid entry is returned', () => {
    fc.assert(
      fc.property(
        fc.array(arbInvalidEntry, { minLength: 0, maxLength: 5 }),
        arbNavigationEntry,
        arbRoutePath,
        (invalidEntries, validEntry, currentPath) => {
          const stack = [...invalidEntries, validEntry]
          const result = computeBackNavigation(stack, currentPath)
          expect(result.to).toBe(validEntry.path)
          expect(result.label).toBe(`Back to ${validEntry.label}`)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * **Validates: Requirements 9.1, 9.2**
   *
   * A stack containing only invalid entries falls back to the fallback route.
   */
  it('stack with only invalid entries falls back to fallback route', () => {
    fc.assert(
      fc.property(
        fc.array(arbInvalidEntry, { minLength: 1, maxLength: 10 }),
        arbRoutePath,
        (invalidEntries, currentPath) => {
          const result = computeBackNavigation(invalidEntries, currentPath)
          const expectedFallback = resolveFallbackRoute(currentPath)
          expect(result.to).toBe(expectedFallback)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * **Validates: Requirements 9.1**
   *
   * All entries produced by the valid entry arbitrary pass validation.
   */
  it('valid entries always pass validation', () => {
    fc.assert(
      fc.property(arbNavigationEntry, (entry) => {
        expect(isValidEntry(entry)).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * **Validates: Requirements 9.2**
   *
   * All entries produced by the invalid entry arbitrary fail validation.
   */
  it('invalid entries always fail validation', () => {
    fc.assert(
      fc.property(arbInvalidEntry, (entry) => {
        expect(isValidEntry(entry)).toBe(false)
      }),
      { numRuns: 200 },
    )
  })
})
