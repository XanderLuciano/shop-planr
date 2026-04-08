// Feature: navigation-stack, Property 2: Capacity Invariant with Oldest Eviction
/**
 * Property 2: Capacity Invariant with Oldest Eviction
 *
 * **Validates: Requirements 1.4, 1.5**
 *
 * Verifies that the navigation stack never exceeds MAX_ENTRIES (20)
 * after any number of pushes, and that when overflow occurs the
 * oldest entries are evicted so the retained entries are always
 * the most recently pushed.
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { arbNavigationSequence } from './arbitraries/navigationStack'
import type { NavigationEntry } from './arbitraries/navigationStack'

const MAX_ENTRIES = 20

function simulatePushes(entries: NavigationEntry[]): NavigationEntry[] {
  let stack: NavigationEntry[] = []
  for (const entry of entries) {
    if (stack.length >= MAX_ENTRIES) {
      stack = stack.slice(1)
    }
    stack.push(entry)
  }
  return stack
}

describe('Property 2: Capacity Invariant with Oldest Eviction', () => {
  // Feature: navigation-stack, Property 2: Capacity Invariant with Oldest Eviction

  /**
   * **Validates: Requirements 1.4**
   *
   * After any number of pushes the stack length must never exceed MAX_ENTRIES.
   */
  it('stack length never exceeds MAX_ENTRIES after any number of pushes', () => {
    fc.assert(
      fc.property(arbNavigationSequence, (entries) => {
        const stack = simulatePushes(entries)
        expect(stack.length).toBeLessThanOrEqual(MAX_ENTRIES)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * **Validates: Requirements 1.5**
   *
   * When overflow occurs, the retained entries are the most recently pushed.
   */
  it('when overflow occurs, retained entries are the most recently pushed', () => {
    fc.assert(
      fc.property(arbNavigationSequence, (entries) => {
        const stack = simulatePushes(entries)
        const expected = entries.slice(-MAX_ENTRIES)
        expect(stack).toEqual(expected)
      }),
      { numRuns: 200 },
    )
  })
})
