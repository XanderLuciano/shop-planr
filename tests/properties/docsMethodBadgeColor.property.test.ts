/**
 * Property 8: Method badge color mapping
 *
 * For any valid HTTP method string (GET, POST, PUT, PATCH, DELETE),
 * the badge color mapping returns the defined color
 * (GET=green, POST=blue, PUT=amber, DELETE=red, PATCH=purple).
 * Unknown methods fall back to gray.
 *
 * **Validates: Requirement 8.1**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { getMethodColor } from '~/app/utils/docsMethodColor'

const METHOD_COLOR_MAP: Record<string, string> = {
  GET: 'green',
  POST: 'blue',
  PUT: 'amber',
  DELETE: 'red',
  PATCH: 'purple',
}

const VALID_METHODS = Object.keys(METHOD_COLOR_MAP)

describe('Property 8: Method badge color mapping', () => {
  // Arbitrary that picks from valid HTTP methods
  const arbValidMethod = fc.constantFrom(...VALID_METHODS)

  it('every valid HTTP method maps to its defined color in bg and text', () => {
    fc.assert(
      fc.property(arbValidMethod, (method) => {
        const result = getMethodColor(method)
        const expectedColor = METHOD_COLOR_MAP[method]

        expect(result.bg, `${method}: bg should contain '${expectedColor}'`).toContain(expectedColor)
        expect(result.text, `${method}: text should contain '${expectedColor}'`).toContain(expectedColor)
      }),
      { numRuns: 100 }
    )
  })

  it('handles case-insensitive input for valid methods', () => {
    // Arbitrary that generates mixed-case variants by randomly toggling each character's case
    const arbCaseVariant = arbValidMethod.chain((method) =>
      fc.tuple(...[...method].map(() => fc.boolean())).map((flags) =>
        [...method].map((c, i) => (flags[i] ? c.toLowerCase() : c.toUpperCase())).join('')
      )
    )

    fc.assert(
      fc.property(arbCaseVariant, (variant) => {
        const result = getMethodColor(variant)
        const expectedColor = METHOD_COLOR_MAP[variant.toUpperCase()]

        expect(result.bg, `'${variant}': bg should contain '${expectedColor}'`).toContain(expectedColor)
        expect(result.text, `'${variant}': text should contain '${expectedColor}'`).toContain(expectedColor)
      }),
      { numRuns: 100 }
    )
  })

  it('unknown methods return gray fallback', () => {
    // Arbitrary that generates strings NOT matching any valid method (case-insensitive)
    const arbUnknownMethod = fc.string({ minLength: 1 }).filter(
      (s) => !VALID_METHODS.includes(s.toUpperCase())
    )

    fc.assert(
      fc.property(arbUnknownMethod, (method) => {
        const result = getMethodColor(method)

        expect(result.bg, `'${method}': unknown method bg should contain 'gray'`).toContain('gray')
        expect(result.text, `'${method}': unknown method text should contain 'gray'`).toContain('gray')
      }),
      { numRuns: 100 }
    )
  })
})
