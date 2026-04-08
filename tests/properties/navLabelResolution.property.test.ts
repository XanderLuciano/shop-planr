// Feature: navigation-stack, Property 5: Label Resolution Completeness
/**
 * Property 5: Label Resolution Completeness
 *
 * **Validates: Requirements 3.1, 3.3**
 *
 * Verifies that `resolveLabel` always returns a non-empty string for any
 * arbitrary path string, and that known route paths resolve to their
 * specific labels (never the generic "Back" fallback).
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { resolveLabel, NAVIGATION_LABELS } from '~/app/utils/navigationLabels'

describe('Property 5: Label Resolution Completeness', () => {
  // Feature: navigation-stack, Property 5: Label Resolution Completeness

  /**
   * **Validates: Requirements 3.1, 3.3**
   *
   * For any arbitrary string, `resolveLabel` must return a non-empty string.
   */
  it('resolveLabel always returns a non-empty string for any path', () => {
    fc.assert(
      fc.property(fc.string(), (path) => {
        const label = resolveLabel(path)
        expect(label).toBeTruthy()
        expect(typeof label).toBe('string')
        expect(label.length).toBeGreaterThan(0)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * **Validates: Requirements 3.1, 3.3**
   *
   * Known route paths must resolve to their specific label, not the
   * generic "Back" fallback.
   */
  it('known route paths return their specific label, not "Back"', () => {
    const knownPaths = [
      '/',
      '/jobs',
      '/parts-browser',
      '/parts',
      '/queue',
      '/templates',
      '/bom',
      '/certs',
      '/audit',
      '/settings',
    ]
    for (const path of knownPaths) {
      expect(resolveLabel(path)).not.toBe('Back')
    }
  })

  /**
   * **Validates: Requirements 3.3**
   *
   * Paths that don't match any registered pattern must return "Back".
   */
  it('unknown paths return "Back"', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => !NAVIGATION_LABELS.some(nl => nl.pattern.test(s))),
        (path) => {
          expect(resolveLabel(path)).toBe('Back')
        },
      ),
      { numRuns: 200 },
    )
  })
})
