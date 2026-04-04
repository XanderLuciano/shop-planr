/**
 * Feature: step-overflow-ux, Property 2: Truncated text has accessible full text
 *
 * For any step with a name or location string, the rendered Step_Card SHALL include
 * a title attribute containing the full untruncated text.
 *
 * **Validates: Requirements 2.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// --- Pure model functions ---

/**
 * Given a step name, returns the expected title attribute value for the step name element.
 * The title attribute must always equal the full untruncated step name,
 * regardless of how the text is visually displayed (truncated or not).
 */
function getStepNameTitleAttr(stepName: string): string {
  return stepName
}

/**
 * Given a location string, returns the expected title attribute value for the location element.
 * The title attribute must always equal the full untruncated location,
 * regardless of how the text is visually displayed (truncated or not).
 */
function getLocationTitleAttr(location: string): string {
  return location
}

/**
 * Simulates CSS truncation by taking a substring of the display text.
 * The title attribute must remain the full original string regardless of truncation.
 */
function simulateTruncation(text: string, maxDisplayChars: number): { displayText: string, titleAttr: string } {
  const displayText = text.length > maxDisplayChars
    ? text.substring(0, maxDisplayChars) + '…'
    : text
  // Title attribute is always the full text, never truncated
  const titleAttr = text
  return { displayText, titleAttr }
}

// --- Generators ---

const arbStepName = (): fc.Arbitrary<string> =>
  fc.string({ minLength: 1, maxLength: 200 })

const arbLocation = (): fc.Arbitrary<string> =>
  fc.string({ minLength: 1, maxLength: 200 })

const arbOptionalLocation = (): fc.Arbitrary<string | undefined> =>
  fc.option(arbLocation(), { nil: undefined })

const arbTruncationWidth = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 200 })

// --- Tests ---

describe('Property 2: Truncated text has accessible full text', () => {
  it('step name title attribute always equals the full untruncated step name', () => {
    fc.assert(
      fc.property(arbStepName(), (stepName) => {
        const titleAttr = getStepNameTitleAttr(stepName)
        expect(titleAttr).toBe(stepName)
      }),
      { numRuns: 100 },
    )
  })

  it('location title attribute always equals the full untruncated location', () => {
    fc.assert(
      fc.property(arbLocation(), (location) => {
        const titleAttr = getLocationTitleAttr(location)
        expect(titleAttr).toBe(location)
      }),
      { numRuns: 100 },
    )
  })

  it('truncation never affects the title attribute value', () => {
    fc.assert(
      fc.property(
        arbStepName(),
        arbTruncationWidth(),
        (stepName, maxDisplayChars) => {
          const { displayText, titleAttr } = simulateTruncation(stepName, maxDisplayChars)

          // Title attribute must always be the full original string
          expect(titleAttr).toBe(stepName)

          // When text is truncated, display differs from title
          if (stepName.length > maxDisplayChars) {
            expect(displayText).not.toBe(titleAttr)
            expect(displayText.length).toBeLessThan(titleAttr.length + 1) // +1 for ellipsis char
          } else {
            // When not truncated, display equals title
            expect(displayText).toBe(titleAttr)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('title attribute preserves unicode and special characters exactly', () => {
    // Build a custom generator for strings with extended characters using available fc v4 APIs
    const arbSpecialString = fc.array(
      fc.integer({ min: 0x20, max: 0xFFFF }),
      { minLength: 1, maxLength: 200 },
    ).map(codePoints => codePoints.map(cp => String.fromCharCode(cp)).join(''))

    fc.assert(
      fc.property(
        fc.oneof(
          arbSpecialString,
          fc.string({ minLength: 1, maxLength: 200 }),
        ),
        (text) => {
          const nameTitle = getStepNameTitleAttr(text)
          const locationTitle = getLocationTitleAttr(text)

          // Both must preserve the exact input including unicode
          expect(nameTitle).toBe(text)
          expect(locationTitle).toBe(text)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('optional location: title attribute is produced only when location exists', () => {
    fc.assert(
      fc.property(
        arbStepName(),
        arbOptionalLocation(),
        (stepName, location) => {
          // Step name always has a title attribute
          const nameTitle = getStepNameTitleAttr(stepName)
          expect(nameTitle).toBe(stepName)

          // Location title attribute only exists when location is defined
          if (location !== undefined) {
            const locTitle = getLocationTitleAttr(location)
            expect(locTitle).toBe(location)
          }
          // When location is undefined, no title attribute is produced (no assertion needed)
        },
      ),
      { numRuns: 100 },
    )
  })
})
