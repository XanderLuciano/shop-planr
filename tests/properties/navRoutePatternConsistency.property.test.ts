// Feature: navigation-stack, Property 11: Route Pattern Consistency
/**
 * Property 11: Route Pattern Consistency
 *
 * **Validates: Requirements 8.2**
 *
 * Verifies that paths differing only in dynamic segments produce the same
 * `routePattern()` value. This ensures same-page-type detection works
 * correctly regardless of the specific dynamic segment values.
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { routePattern } from '~/app/utils/navigationLabels'

describe('Property 11: Route Pattern Consistency', () => {
  // Feature: navigation-stack, Property 11: Route Pattern Consistency

  // Generate non-empty strings without slashes for dynamic segments
  const arbSegment = fc.stringMatching(/^[A-Za-z0-9_-]+$/).filter(s => s.length > 0)

  const dynamicRouteTemplates = [
    { template: (id: string) => `/jobs/${id}`, name: 'jobs/:id' },
    { template: (id: string) => `/parts-browser/${id}`, name: 'parts-browser/:id' },
    { template: (id: string) => `/parts/step/${id}`, name: 'parts/step/:stepId' },
  ]

  /**
   * **Validates: Requirements 8.2**
   *
   * For each dynamic route template, substituting any two different segment
   * values must yield the same routePattern result.
   */
  for (const { template, name } of dynamicRouteTemplates) {
    it(`paths differing only in dynamic segment produce same routePattern for ${name}`, () => {
      fc.assert(
        fc.property(arbSegment, arbSegment, (seg1, seg2) => {
          expect(routePattern(template(seg1))).toBe(routePattern(template(seg2)))
        }),
        { numRuns: 200 },
      )
    })
  }
})
