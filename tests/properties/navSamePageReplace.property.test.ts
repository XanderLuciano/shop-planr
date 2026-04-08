// Feature: navigation-stack, Property 10: Same-Page-Type Replace vs Different-Page-Type Push
/**
 * Property 10: Same-Page-Type Replace vs Different-Page-Type Push
 * Property 11: Route Pattern Consistency (covered in navRoutePatternConsistency)
 *
 * **Validates: Requirements 8.1, 8.3**
 *
 * Verifies that when two routes share the same routePattern, the middleware
 * replaces the top entry (stack size unchanged). When patterns differ,
 * the stack size increases by one.
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { routePattern, resolveLabel } from '../../app/utils/navigationLabels'
import type { NavigationEntry } from './arbitraries/navigationStack'
import { arbNavigationEntry } from './arbitraries/navigationStack'

/** Generates pairs of step paths (same page type) with different dynamic segments */
const arbSameTypeStepPair = fc.tuple(
  fc.stringMatching(/^[A-Za-z0-9_-]+$/).filter(s => s.length > 0),
  fc.stringMatching(/^[A-Za-z0-9_-]+$/).filter(s => s.length > 0),
).filter(([a, b]) => a !== b)
  .map(([a, b]) => [`/parts/step/${a}`, `/parts/step/${b}`] as const)

/** Generates pairs of part-browser paths (same page type) */
const arbSameTypePartPair = fc.tuple(
  fc.stringMatching(/^[A-Za-z0-9_-]+$/).filter(s => s.length > 0),
  fc.stringMatching(/^[A-Za-z0-9_-]+$/).filter(s => s.length > 0),
).filter(([a, b]) => a !== b)
  .map(([a, b]) => [`/parts-browser/${a}`, `/parts-browser/${b}`] as const)

/** Generates pairs of job paths (same page type) */
const arbSameTypeJobPair = fc.tuple(
  fc.stringMatching(/^[A-Za-z0-9_-]+$/).filter(s => s.length > 0),
  fc.stringMatching(/^[A-Za-z0-9_-]+$/).filter(s => s.length > 0),
).filter(([a, b]) => a !== b)
  .map(([a, b]) => [`/jobs/${a}`, `/jobs/${b}`] as const)

const arbSameTypePair = fc.oneof(arbSameTypeStepPair, arbSameTypePartPair, arbSameTypeJobPair)

/**
 * Simulates middleware logic for same-page-type detection.
 */
function simulateMiddleware(
  stack: NavigationEntry[],
  fromPath: string,
  toPath: string,
): { result: NavigationEntry[], action: 'replace' | 'push' | 'pop' | 'skip' } {
  if (toPath === fromPath) return { result: [...stack], action: 'skip' }

  const copy = [...stack]

  // Back navigation
  if (copy.length > 0 && copy[copy.length - 1]!.path === toPath) {
    copy.pop()
    return { result: copy, action: 'pop' }
  }

  // Same-page-type → replace
  if (routePattern(fromPath) === routePattern(toPath)) {
    const entry = { path: fromPath, label: resolveLabel(fromPath) }
    if (copy.length > 0) {
      copy[copy.length - 1] = entry
    } else {
      copy.push(entry)
    }
    return { result: copy, action: 'replace' }
  }

  // Different page type → push
  copy.push({ path: fromPath, label: resolveLabel(fromPath) })
  return { result: copy, action: 'push' }
}

describe('Property 10: Same-Page-Type Replace vs Different-Page-Type Push', () => {
  // Feature: navigation-stack, Property 10

  /**
   * **Validates: Requirements 8.1**
   *
   * When from and to share the same routePattern, the stack size stays the same
   * (replace, not push).
   */
  it('same-page-type navigation replaces top entry (stack size unchanged)', () => {
    fc.assert(
      fc.property(
        fc.array(arbNavigationEntry, { minLength: 1, maxLength: 10 }),
        arbSameTypePair,
        (initialStack, [fromPath, toPath]) => {
          // Ensure toPath doesn't match stack top (would be detected as back nav)
          const stack = initialStack.filter(e => e.path !== toPath)
          if (stack.length === 0) return // skip degenerate case

          const { result, action } = simulateMiddleware(stack, fromPath, toPath)
          expect(action).toBe('replace')
          expect(result.length).toBe(stack.length)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * **Validates: Requirements 8.3**
   *
   * When from and to have different routePatterns, the stack grows by one (push).
   */
  it('different-page-type navigation pushes entry (stack size increases by 1)', () => {
    fc.assert(
      fc.property(
        fc.array(arbNavigationEntry, { minLength: 0, maxLength: 10 }),
        (initialStack) => {
          // Use /queue → /parts/step/abc (always different page types)
          const fromPath = '/queue'
          const toPath = '/parts/step/test-step'
          // Ensure toPath doesn't match stack top
          const stack = initialStack.filter(e => e.path !== toPath)

          const { result, action } = simulateMiddleware(stack, fromPath, toPath)
          expect(action).toBe('push')
          expect(result.length).toBe(stack.length + 1)
          expect(result[result.length - 1]!.path).toBe(fromPath)
        },
      ),
      { numRuns: 200 },
    )
  })
})
