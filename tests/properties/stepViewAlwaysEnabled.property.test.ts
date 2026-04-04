/**
 * Property 1: Step view routes are always enabled
 *
 * For any step ID and any page toggle configuration,
 * `isPageEnabled(toggles, '/parts/step/' + stepId)` returns `true`.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 4.3**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { isPageEnabled } from '~/server/utils/pageToggles'
import { arbPageToggles } from './arbitraries/pageToggles'

/** Arbitrary that produces a random step ID string (any non-empty URL path segment). */
const arbStepId: fc.Arbitrary<string> = fc.webSegment().filter(s => s.length > 0)

describe('Property 1: Step view routes are always enabled', () => {
  /**
   * **Validates: Requirements 1.1, 1.2, 1.3, 4.3**
   *
   * For any step ID and any page toggle configuration (including parts=false),
   * `isPageEnabled(toggles, '/parts/step/' + stepId)` always returns `true`.
   */
  it('`/parts/step/:stepId` always returns true for any PageToggles configuration', () => {
    fc.assert(
      fc.property(arbPageToggles, arbStepId, (toggles, stepId) => {
        expect(isPageEnabled(toggles, '/parts/step/' + stepId)).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * **Validates: Requirements 1.2, 4.3**
   *
   * The exact prefix `/parts/step` itself is always enabled.
   */
  it('`/parts/step` exact prefix always returns true for any PageToggles configuration', () => {
    fc.assert(
      fc.property(arbPageToggles, (toggles) => {
        expect(isPageEnabled(toggles, '/parts/step')).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * **Validates: Requirements 1.2, 4.3**
   *
   * The trailing-slash variant `/parts/step/` is always enabled.
   */
  it('`/parts/step/` trailing slash always returns true', () => {
    fc.assert(
      fc.property(arbPageToggles, (toggles) => {
        expect(isPageEnabled(toggles, '/parts/step/')).toBe(true)
      }),
      { numRuns: 200 },
    )
  })
})
