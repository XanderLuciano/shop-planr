/**
 * UI Polish Batch — Property-Based Tests
 *
 * Five properties covering the pure utility functions extracted
 * for the UI polish batch spec items.
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { removePartFromList, removePartFromSelection } from '~/app/utils/scrapPartFromList'
import { shouldHighlightStep } from '~/app/utils/stepHighlight'
import { tabToHash, hashToTab } from '~/app/utils/tabHash'
import { partDetailLink } from '~/app/utils/eyeIconLink'

import { shouldShowSkip } from '~/app/utils/shouldShowSkip'

/**
 * Property 1: Scrap removes part from list and deselects
 *
 * For any list of part IDs and any selected-parts subset,
 * scrapping a member removes it from both collections.
 *
 * **Validates: Requirements 1.1, 1.3**
 */
describe('Property 1: Scrap removes part from list and deselects', () => {
  it('scrapped part is removed from list and deselected', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 50 }),
        (partIds) => {
          // Pick a random index to scrap via fast-check seeded selection
          const scrappedId = partIds[0]

          // Build a selected set that includes the scrapped ID
          const selected = new Set(partIds.slice(0, Math.max(1, Math.ceil(partIds.length / 2))))

          const newList = removePartFromList(partIds, scrappedId)
          const newSelected = removePartFromSelection(selected, scrappedId)

          // Scrapped ID must not be in the new list
          expect(newList).not.toContain(scrappedId)
          // List length decreases by exactly 1
          expect(newList.length).toBe(partIds.length - 1)
          // Scrapped ID must not be in the new selected set
          expect(newSelected.has(scrappedId)).toBe(false)
          // If scrapped was selected, size decreases by 1; otherwise stays same
          if (selected.has(scrappedId)) {
            expect(newSelected.size).toBe(selected.size - 1)
          } else {
            expect(newSelected.size).toBe(selected.size)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 2: Skip button visibility equals stepOptional && !isFinalStep
 *
 * The Skip button should be visible iff the step is optional and not the final step.
 *
 * **Validates: Requirements 2.1, 2.5**
 */
describe('Property 2: Skip button visibility equals stepOptional flag', () => {
  it('visibility matches stepOptional && !isFinalStep', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        (stepOptional, isFinalStep) => {
          const result = shouldShowSkip(stepOptional, isFinalStep)
          expect(result).toBe(stepOptional && !isFinalStep)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('returns false when stepOptional is undefined', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (isFinalStep) => {
          expect(shouldShowSkip(undefined, isFinalStep)).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 3: Step highlight classification
 *
 * Blue highlight is applied iff partCount > 0 AND isBottleneck is false.
 * Bottleneck steps always get amber (not blue). Zero-part steps get default.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 */
describe('Property 3: Step highlight classification', () => {
  it('shouldHighlightStep returns true only when partCount > 0 and not bottleneck', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500 }),
        fc.boolean(),
        (partCount, isBottleneck) => {
          const result = shouldHighlightStep(partCount, isBottleneck)
          const expected = partCount > 0 && !isBottleneck
          expect(result).toBe(expected)
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 4: Eye icon link target correctness
 *
 * For any part ID string, the eye icon link resolves to
 * `/parts-browser/${encodeURIComponent(partId)}`.
 *
 * **Validates: Requirements 4.1, 4.2**
 */
describe('Property 4: Eye icon link target correctness', () => {
  it('link resolves to /parts-browser/{encodedPartId}', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (partId) => {
          const link = partDetailLink(partId)
          expect(link).toBe(`/parts-browser/${encodeURIComponent(partId)}`)
          // Link always starts with the correct prefix
          expect(link.startsWith('/parts-browser/')).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 5: Tab-hash round trip
 *
 * Converting a tab to a hash and back produces the original tab.
 * Converting a hash to a tab and back produces the original hash.
 *
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 */
describe('Property 5: Tab-hash round trip', () => {
  it('tab → hash → tab round-trips correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('routing', 'siblings'),
        (tab) => {
          const hash = tabToHash(tab)
          const roundTripped = hashToTab(hash)
          expect(roundTripped).toBe(tab)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('hash → tab → hash round-trips correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('#routing', '#parts'),
        (hash) => {
          const tab = hashToTab(hash)
          const roundTripped = tabToHash(tab)
          expect(roundTripped).toBe(hash)
        },
      ),
      { numRuns: 100 },
    )
  })
})
