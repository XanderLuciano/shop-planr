/**
 * Properties 5–8: mergePageToggles and isPageEnabled
 *
 * - Property 5: Partial update preservation — keys not in the update are preserved
 * - Property 6: Unknown keys ignored in merge — only valid keys remain
 * - Property 7: Missing keys default to true — partial PageToggles treat missing keys as true
 * - Property 8: Idempotent toggle — merging a state with itself produces identical PageToggles
 *
 * **Validates: Requirements 2.2, 2.3, 3.2, 7.1**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  mergePageToggles,
  DEFAULT_PAGE_TOGGLES,
  VALID_TOGGLE_KEYS,
} from '~/server/utils/pageToggles'
import type { PageToggles } from '~/server/types/domain'

/** All 10 valid toggle keys. */
const ALL_KEYS: (keyof PageToggles)[] = [
  'jobs', 'partsBrowser', 'parts', 'queue', 'templates', 'bom', 'certs', 'jira', 'audit', 'webhooks',
]

/** Arbitrary that produces a full PageToggles object with random booleans. */
const arbPageToggles: fc.Arbitrary<PageToggles> = fc.record({
  jobs: fc.boolean(),
  partsBrowser: fc.boolean(),
  parts: fc.boolean(),
  queue: fc.boolean(),
  templates: fc.boolean(),
  bom: fc.boolean(),
  certs: fc.boolean(),
  jira: fc.boolean(),
  audit: fc.boolean(),
  webhooks: fc.boolean(),
})

/** Arbitrary that produces a partial PageToggles (random subset of keys). */
const arbPartialToggles: fc.Arbitrary<Partial<PageToggles>> = arbPageToggles.chain(full =>
  fc.subarray(ALL_KEYS, { minLength: 0, maxLength: ALL_KEYS.length }).map((keys) => {
    const partial: Partial<PageToggles> = {}
    for (const k of keys) {
      partial[k] = full[k]
    }
    return partial
  }),
)

/** Arbitrary that produces an object with unknown (non-toggle) keys. */
const arbUnknownKeys: fc.Arbitrary<Record<string, unknown>> = fc
  .array(
    fc.tuple(
      fc.stringMatching(/^[a-z]{3,10}$/).filter(s => !VALID_TOGGLE_KEYS.has(s)),
      fc.oneof(fc.boolean(), fc.integer(), fc.string()),
    ),
    { minLength: 1, maxLength: 5 },
  )
  .map(pairs => Object.fromEntries(pairs))

describe('Property 5: Partial update preservation', () => {
  /**
   * **Validates: Requirements 2.2**
   *
   * For any existing PageToggles and partial update, keys not in the update are preserved.
   */
  it('keys not present in the partial update retain their original values', () => {
    fc.assert(
      fc.property(arbPageToggles, arbPartialToggles, (current, partial) => {
        const merged = mergePageToggles(current, partial)

        // Every key NOT in the partial must keep its value from current
        for (const key of ALL_KEYS) {
          if (!(key in partial)) {
            expect(merged[key]).toBe(current[key])
          }
        }

        // Every key IN the partial must have the partial's value
        for (const key of Object.keys(partial) as (keyof PageToggles)[]) {
          expect(merged[key]).toBe(partial[key])
        }
      }),
      { numRuns: 200 },
    )
  })
})

describe('Property 6: Unknown keys ignored in merge', () => {
  /**
   * **Validates: Requirements 2.3**
   *
   * Unknown keys in input are discarded; only valid keys remain.
   */
  it('result contains only the 10 valid toggle keys regardless of extra input keys', () => {
    fc.assert(
      fc.property(arbPageToggles, arbUnknownKeys, (current, unknowns) => {
        // Mix valid partial with unknown keys
        const mixed: Record<string, unknown> = { ...unknowns, jobs: !current.jobs }
        const merged = mergePageToggles(current, mixed)

        // Result has exactly the 10 valid keys
        const resultKeys = new Set(Object.keys(merged))
        expect(resultKeys.size).toBe(10)
        for (const key of ALL_KEYS) {
          expect(resultKeys.has(key)).toBe(true)
          expect(typeof merged[key]).toBe('boolean')
        }

        // No unknown keys leaked through
        for (const unknownKey of Object.keys(unknowns)) {
          if (!VALID_TOGGLE_KEYS.has(unknownKey)) {
            expect(unknownKey in DEFAULT_PAGE_TOGGLES || !(unknownKey in merged)).toBe(true)
          }
        }
      }),
      { numRuns: 200 },
    )
  })
})

describe('Property 7: Missing keys default to true', () => {
  /**
   * **Validates: Requirements 3.2**
   *
   * Partial PageToggles with fewer than 9 keys treat missing keys as true.
   */
  it('missing keys in current are filled with true (DEFAULT_PAGE_TOGGLES)', () => {
    fc.assert(
      fc.property(
        // Generate a partial current with a random subset of keys
        arbPageToggles.chain(full =>
          fc.subarray(ALL_KEYS, { minLength: 0, maxLength: 8 }).map((keys) => {
            const partial: Partial<PageToggles> = {}
            for (const k of keys) {
              partial[k] = full[k]
            }
            return partial
          }),
        ),
        (partialCurrent) => {
          // Merge with empty partial — no updates, just fill defaults
          const merged = mergePageToggles(partialCurrent, {})

          // Keys present in partialCurrent keep their value
          for (const key of ALL_KEYS) {
            if (key in partialCurrent) {
              expect(merged[key]).toBe(partialCurrent[key as keyof typeof partialCurrent])
            } else {
              // Missing keys default to true
              expect(merged[key]).toBe(true)
            }
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})

describe('Property 8: Idempotent toggle', () => {
  /**
   * **Validates: Requirements 7.1**
   *
   * Merging a state with itself produces identical PageToggles.
   */
  it('merging a full PageToggles with itself returns an identical object', () => {
    fc.assert(
      fc.property(arbPageToggles, (toggles) => {
        const merged = mergePageToggles(toggles, toggles)

        for (const key of ALL_KEYS) {
          expect(merged[key]).toBe(toggles[key])
        }
      }),
      { numRuns: 200 },
    )
  })
})
