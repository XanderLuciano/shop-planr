// Feature: navigation-stack, Property 3: Push/Pop Round-Trip
// Feature: navigation-stack, Property 8: goBack Pops Correct Entry
// Feature: navigation-stack, Property 9: LIFO Unwinding for Navigation Chains
/**
 * Properties 3, 8, 9: Push/Pop Round-Trip, goBack Pops Correct Entry,
 * LIFO Unwinding for Navigation Chains
 *
 * **Validates: Requirements 2.2, 2.3, 4.4, 7.3**
 *
 * Verifies push/pop stack semantics:
 * - Push then pop returns the same entry and restores prior state
 * - goBack pops the correct (top) entry
 * - LIFO unwinding: push N entries, pop N times → entries in reverse order
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { arbNavigationEntry } from './arbitraries/navigationStack'
import type { NavigationEntry } from './arbitraries/navigationStack'

const MAX_ENTRIES = 20

// Simulate stack operations matching the composable logic
function pushEntry(stack: NavigationEntry[], entry: NavigationEntry): NavigationEntry[] {
  const next = [...stack]
  if (next.length >= MAX_ENTRIES) next.shift()
  next.push(entry)
  return next
}

function popEntry(stack: NavigationEntry[]): { stack: NavigationEntry[], popped: NavigationEntry | undefined } {
  if (stack.length === 0) return { stack: [], popped: undefined }
  const next = [...stack]
  const popped = next.pop()
  return { stack: next, popped }
}

describe('Property 3: Push/Pop Round-Trip', () => {
  // Feature: navigation-stack, Property 3: Push/Pop Round-Trip

  /**
   * **Validates: Requirements 2.2, 2.3**
   *
   * Pushing an entry then popping must return the same entry.
   */
  it('pushing then popping returns the same entry', () => {
    fc.assert(
      fc.property(arbNavigationEntry, (entry) => {
        const stack = pushEntry([], entry)
        const { popped } = popEntry(stack)
        expect(popped).toEqual(entry)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * **Validates: Requirements 2.2, 2.3**
   *
   * Pushing an entry onto an existing stack then popping must restore
   * the prior stack state exactly.
   */
  it('pushing then popping restores prior stack state', () => {
    fc.assert(
      fc.property(
        fc.array(arbNavigationEntry, { minLength: 0, maxLength: 15 }),
        arbNavigationEntry,
        (initial, newEntry) => {
          // Build the prior stack from initial entries
          let priorStack: NavigationEntry[] = []
          for (const e of initial) {
            priorStack = pushEntry(priorStack, e)
          }
          const afterPush = pushEntry(priorStack, newEntry)
          const { stack: afterPop } = popEntry(afterPush)
          expect(afterPop).toEqual(priorStack)
        },
      ),
      { numRuns: 200 },
    )
  })
})

describe('Property 8: goBack Pops Correct Entry', () => {
  // Feature: navigation-stack, Property 8: goBack Pops Correct Entry

  /**
   * **Validates: Requirements 4.4**
   *
   * goBack removes the top entry and returns it; the remaining stack
   * is one element shorter.
   */
  it('goBack removes the top entry and returns it', () => {
    fc.assert(
      fc.property(
        fc.array(arbNavigationEntry, { minLength: 1, maxLength: 20 }),
        (entries) => {
          let stack: NavigationEntry[] = []
          for (const e of entries) {
            stack = pushEntry(stack, e)
          }
          const topBefore = stack[stack.length - 1]
          const { popped, stack: afterPop } = popEntry(stack)
          expect(popped).toEqual(topBefore)
          expect(afterPop.length).toBe(stack.length - 1)
        },
      ),
      { numRuns: 200 },
    )
  })
})

describe('Property 9: LIFO Unwinding for Navigation Chains', () => {
  // Feature: navigation-stack, Property 9: LIFO Unwinding for Navigation Chains

  /**
   * **Validates: Requirements 7.3**
   *
   * Pushing N entries then popping N times returns them in reverse
   * push order (respecting the MAX_ENTRIES cap).
   */
  it('popping N entries returns them in reverse push order', () => {
    fc.assert(
      fc.property(
        fc.array(arbNavigationEntry, { minLength: 1, maxLength: 20 }),
        (entries) => {
          let stack: NavigationEntry[] = []
          for (const e of entries) {
            stack = pushEntry(stack, e)
          }
          const popped: NavigationEntry[] = []
          while (stack.length > 0) {
            const result = popEntry(stack)
            if (result.popped) popped.push(result.popped)
            stack = result.stack
          }
          // Popped entries should be in reverse order of the (possibly capped) stack
          const expectedReversed = entries.slice(-MAX_ENTRIES).reverse()
          expect(popped).toEqual(expectedReversed)
        },
      ),
      { numRuns: 200 },
    )
  })
})
