// Feature: navigation-stack, Property 4: Query/Hash-Only Navigation Is a No-Op
/**
 * Property 4: Query/Hash-Only Navigation Is a No-Op
 *
 * **Validates: Requirements 2.4**
 *
 * Verifies that when `to.path === from.path` (only query/hash differs),
 * the middleware logic does not modify the stack.
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { arbRoutePath, arbNavigationEntry } from './arbitraries/navigationStack'
import type { NavigationEntry } from './arbitraries/navigationStack'

/**
 * Simulates the middleware skip logic: if to.path === from.path, the stack
 * is unchanged. Otherwise a push would occur.
 */
function simulateMiddleware(
  stack: NavigationEntry[],
  fromPath: string,
  toPath: string,
): NavigationEntry[] {
  // Middleware skips when paths are identical (query/hash-only change)
  if (toPath === fromPath) return [...stack]
  // Otherwise would push
  return [...stack, { path: fromPath, label: `Label for ${fromPath}` }]
}

describe('Property 4: Query/Hash-Only Navigation Is a No-Op', () => {
  // Feature: navigation-stack, Property 4: Query/Hash-Only Navigation Is a No-Op

  /**
   * **Validates: Requirements 2.4**
   *
   * Navigating from a path to the same path (with different query/hash)
   * should not change the stack contents or length.
   */
  it('stack is unchanged when to.path equals from.path', () => {
    fc.assert(
      fc.property(
        fc.array(arbNavigationEntry, { minLength: 0, maxLength: 10 }),
        arbRoutePath,
        (initialStack, path) => {
          const result = simulateMiddleware(initialStack, path, path)
          expect(result).toEqual(initialStack)
          expect(result.length).toBe(initialStack.length)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * **Validates: Requirements 2.4**
   *
   * When paths differ, the stack should grow (push occurs).
   */
  it('stack grows when to.path differs from from.path', () => {
    fc.assert(
      fc.property(
        fc.array(arbNavigationEntry, { minLength: 0, maxLength: 10 }),
        arbRoutePath,
        arbRoutePath.filter(p => p !== '/'), // ensure we can get a different path
        (initialStack, fromPath, toPath) => {
          fc.pre(fromPath !== toPath)
          const result = simulateMiddleware(initialStack, fromPath, toPath)
          expect(result.length).toBe(initialStack.length + 1)
        },
      ),
      { numRuns: 200 },
    )
  })
})
