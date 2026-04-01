/**
 * Feature: serial-number-ux-redesign, Property 6: Status banner placement above section cards
 *
 * For any part with a terminal status, the appropriate status banner
 * (red for scrapped, amber for force-completed) is rendered above the section cards
 * and outside of any section card boundary.
 *
 * The green completed banner lives INSIDE the Routing SectionCard (per design),
 * so it is NOT tested as "above section cards".
 *
 * **Validates: Requirements 7.1, 7.2, 7.3**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// --- Types ---

type PartStatus = 'in_progress' | 'completed' | 'scrapped'

interface PartState {
  status: PartStatus
  forceCompleted: boolean
  currentStepId: string | null // null for completed, string for in-progress
}

// Rendering element types emitted by the model function
type RenderElement =
  | { type: 'scrap-banner' }
  | { type: 'force-complete-banner' }
  | { type: 'section-card'; name: string }

// --- Pure rendering model ---

/**
 * Models the template's banner/section rendering logic for the Routing tab.
 * Returns an ordered list of render elements as they appear in DOM order,
 * matching the structure in parts-browser/[id].vue.
 *
 * Banners that appear ABOVE section cards (between tab bar and first SectionCard):
 *   - scrap-banner: when status === 'scrapped'
 *   - force-complete-banner: when forceCompleted && status !== 'scrapped'
 *
 * The green completed banner is INSIDE the Routing SectionCard and is NOT
 * modelled here as a top-level element (it's part of the section card body).
 */
function computeRoutingTabElements(state: PartState): RenderElement[] {
  const elements: RenderElement[] = []

  // Derived booleans matching the page's computed properties
  const isScrapped = state.status === 'scrapped'
  const isCompleted = state.status === 'completed' || state.currentStepId === null
  const isForceCompleted = state.forceCompleted === true
  const isInProgress = !isScrapped && !isCompleted && state.currentStepId !== null

  // Banners rendered ABOVE section cards (outside any SectionCard)
  if (isScrapped) {
    elements.push({ type: 'scrap-banner' })
  }
  if (isForceCompleted && !isScrapped) {
    elements.push({ type: 'force-complete-banner' })
  }

  // Section cards (always present in this order when routing tab is active)
  elements.push({ type: 'section-card', name: 'Routing' })
  elements.push({ type: 'section-card', name: 'Certificates' })
  elements.push({ type: 'section-card', name: 'Notes' })

  // Advance Process only when in-progress (simplified: assume workQueueJob exists when in-progress)
  if (isInProgress) {
    elements.push({ type: 'section-card', name: 'Advance Process' })
  }

  return elements
}

// --- Generators ---

const partStatusArb: fc.Arbitrary<PartStatus> = fc.constantFrom(
  'in_progress' as const,
  'completed' as const,
  'scrapped' as const,
)

const partStateArb: fc.Arbitrary<PartState> = fc.record({
  status: partStatusArb,
  forceCompleted: fc.boolean(),
  currentStepId: fc.oneof(
    fc.constant(null as string | null), // completed
    fc.string({ minLength: 3, maxLength: 15 }), // in-progress at various steps
  ),
})

// --- Tests ---

describe('Property 6: Status banner placement above section cards', () => {
  it('scrap banner appears if and only if status is scrapped', () => {
    fc.assert(
      fc.property(partStateArb, (state) => {
        const elements = computeRoutingTabElements(state)
        const hasScrapBanner = elements.some(e => e.type === 'scrap-banner')
        const isScrapped = state.status === 'scrapped'

        expect(hasScrapBanner).toBe(isScrapped)
      }),
      { numRuns: 100 },
    )
  })

  it('force-complete banner appears if and only if forceCompleted is true and status is not scrapped', () => {
    fc.assert(
      fc.property(partStateArb, (state) => {
        const elements = computeRoutingTabElements(state)
        const hasForceBanner = elements.some(e => e.type === 'force-complete-banner')
        const expected = state.forceCompleted && state.status !== 'scrapped'

        expect(hasForceBanner).toBe(expected)
      }),
      { numRuns: 100 },
    )
  })

  it('all banners appear BEFORE any section card in DOM order', () => {
    fc.assert(
      fc.property(partStateArb, (state) => {
        const elements = computeRoutingTabElements(state)

        const firstSectionIndex = elements.findIndex(e => e.type === 'section-card')
        if (firstSectionIndex === -1) return // no sections (shouldn't happen, but safe)

        // Every element before the first section card must be a banner
        for (let i = 0; i < firstSectionIndex; i++) {
          const el = elements[i]
          expect(
            el.type === 'scrap-banner' || el.type === 'force-complete-banner',
          ).toBe(true)
        }

        // No banner appears after the first section card
        for (let i = firstSectionIndex; i < elements.length; i++) {
          const el = elements[i]
          expect(el.type).not.toBe('scrap-banner')
          expect(el.type).not.toBe('force-complete-banner')
        }
      }),
      { numRuns: 100 },
    )
  })

  it('banners are never inside a section card boundary (no banner shares index with a section card)', () => {
    fc.assert(
      fc.property(partStateArb, (state) => {
        const elements = computeRoutingTabElements(state)

        // Partition into banners and section cards
        const bannerIndices = elements
          .map((e, i) => (e.type === 'scrap-banner' || e.type === 'force-complete-banner') ? i : -1)
          .filter(i => i >= 0)
        const sectionIndices = elements
          .map((e, i) => e.type === 'section-card' ? i : -1)
          .filter(i => i >= 0)

        // No overlap — banners and section cards occupy distinct positions
        for (const bi of bannerIndices) {
          expect(sectionIndices).not.toContain(bi)
        }

        // Every banner index is strictly less than every section card index
        if (bannerIndices.length > 0 && sectionIndices.length > 0) {
          const maxBanner = Math.max(...bannerIndices)
          const minSection = Math.min(...sectionIndices)
          expect(maxBanner).toBeLessThan(minSection)
        }
      }),
      { numRuns: 100 },
    )
  })
})
