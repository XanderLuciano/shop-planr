/**
 * Property 2: Non-step /parts routes respect the parts toggle
 *
 * For any toggle config and any `/parts` sub-route not matching
 * ALWAYS_ENABLED_ROUTES, `isPageEnabled` equals `toggles.parts`.
 *
 * **Validates: Requirements 2.1, 2.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { isPageEnabled } from '~/server/utils/pageToggles'
import { arbPageToggles } from './arbitraries/pageToggles'

/**
 * Arbitrary that produces a random sub-route suffix guaranteed NOT to
 * start with `step/` or equal `step`. This ensures the generated path
 * `/parts/<suffix>` never matches ALWAYS_ENABLED_ROUTES (`/parts/step`).
 *
 * Examples: `view-xyz`, `abc123`, `foo/bar`
 */
const arbNonStepSuffix: fc.Arbitrary<string> = fc
  .array(fc.stringMatching(/^[a-z0-9]{1,8}$/), { minLength: 1, maxLength: 3 })
  .map((segments) => segments.join('/'))
  .filter((suffix) => suffix !== 'step' && !suffix.startsWith('step/'))

describe('Property 2: Non-step /parts routes respect the parts toggle', () => {
  /**
   * **Validates: Requirements 2.1**
   *
   * The exact `/parts` route returns `toggles.parts` for any toggle config.
   */
  it('`/parts` exact route returns `toggles.parts`', () => {
    fc.assert(
      fc.property(arbPageToggles, (toggles) => {
        expect(isPageEnabled(toggles, '/parts')).toBe(toggles.parts)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * **Validates: Requirements 2.2**
   *
   * `/parts` sub-routes that do NOT start with `/parts/step` return
   * `toggles.parts` for any toggle config.
   */
  it('`/parts/<non-step suffix>` returns `toggles.parts`', () => {
    fc.assert(
      fc.property(arbPageToggles, arbNonStepSuffix, (toggles, suffix) => {
        const route = '/parts/' + suffix
        expect(isPageEnabled(toggles, route)).toBe(toggles.parts)
      }),
      { numRuns: 200 },
    )
  })
})
