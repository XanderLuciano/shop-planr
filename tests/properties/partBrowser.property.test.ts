/**
 * Property tests for part browser logic (P8, P9, P10).
 *
 * Tests the pure search, filter, and sort functions from usePartBrowser.
 *
 * Feature: step-assignment-and-part-views
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { EnrichedPart } from '../../server/types/computed'
import { searchParts, filterParts, sortParts } from '../../app/composables/usePartBrowser'
import type { PartBrowserFilters } from '../../app/composables/usePartBrowser'

// ---- Generators ----

const arbEnrichedPart = (): fc.Arbitrary<EnrichedPart> =>
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
    jobId: fc.string({ minLength: 3, maxLength: 20 }),
    jobName: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
    pathId: fc.string({ minLength: 3, maxLength: 20 }),
    pathName: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
    currentStepIndex: fc.oneof(fc.constant(-1), fc.integer({ min: 0, max: 10 })),
    currentStepName: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
    assignedTo: fc.option(
      fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
      { nil: undefined }
    ),
    status: fc.constantFrom('in-progress' as const, 'completed' as const),
    createdAt: fc
      .integer({ min: 1577836800000, max: 1893456000000 })
      .map((ts) => new Date(ts).toISOString()),
  })

const arbPartList = (): fc.Arbitrary<EnrichedPart[]> =>
  fc.array(arbEnrichedPart(), { minLength: 0, maxLength: 30 })

const arbSearchQuery = (): fc.Arbitrary<string> =>
  fc.oneof(fc.constant(''), fc.string({ minLength: 0, maxLength: 20 }))

// ---- Property 8: Part search filter correctness ----

/**
 * Property 8: Part search filter correctness
 *
 * For any search query and list of EnrichedParts, filtered result contains
 * exactly parts whose `id` contains query (case-insensitive); empty query
 * returns all.
 *
 * **Validates: Requirements 8.2**
 */
describe('Property 8: Part search filter correctness', () => {
  it('filtered result contains exactly parts whose id contains query (case-insensitive)', () => {
    fc.assert(
      fc.property(arbPartList(), arbSearchQuery(), (parts, query) => {
        const result = searchParts(parts, query)
        const q = query.trim().toLowerCase()

        if (!q) {
          // Empty query returns all
          expect(result.length).toBe(parts.length)
          expect(result).toEqual(parts)
        } else {
          // Each result must contain the query in its id
          for (const s of result) {
            expect(s.id.toLowerCase()).toContain(q)
          }

          // Every part matching the query must be in the result
          const expected = parts.filter((s) => s.id.toLowerCase().includes(q))
          expect(result.length).toBe(expected.length)

          // Same set of ids
          const resultIds = result.map((s) => s.id)
          const expectedIds = expected.map((s) => s.id)
          expect(resultIds).toEqual(expectedIds)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('empty query returns all parts unchanged', () => {
    fc.assert(
      fc.property(arbPartList(), (parts) => {
        const result = searchParts(parts, '')
        expect(result).toEqual(parts)

        const resultSpaces = searchParts(parts, '   ')
        expect(resultSpaces).toEqual(parts)
      }),
      { numRuns: 100 }
    )
  })
})

// ---- Property 9: Part multi-filter AND logic ----

/**
 * Property 9: Part multi-filter AND logic
 *
 * For any combination of filters, result contains exactly parts matching ALL
 * active criteria; "Unassigned" filter matches undefined/null `assignedTo`;
 * all empty returns all.
 *
 * **Validates: Requirements 9.2, 9.3**
 */
describe('Property 9: Part multi-filter AND logic', () => {
  // Generator for filters that pick from actual part values (to get meaningful hits)
  const arbFiltersFromParts = (parts: EnrichedPart[]): fc.Arbitrary<PartBrowserFilters> => {
    if (parts.length === 0) {
      return fc.constant({})
    }
    const jobs = [...new Set(parts.map((s) => s.jobName))]
    const paths = [...new Set(parts.map((s) => s.pathName))]
    const steps = [...new Set(parts.map((s) => s.currentStepName))]
    const assignees = [...new Set(parts.map((s) => s.assignedTo).filter((v): v is string => !!v))]

    return fc.record({
      jobName: fc.option(fc.constantFrom(...jobs), { nil: undefined }),
      pathName: fc.option(fc.constantFrom(...paths), { nil: undefined }),
      stepName: fc.option(fc.constantFrom(...steps), { nil: undefined }),
      status: fc.option(
        fc.constantFrom('in-progress' as const, 'completed' as const, 'all' as const),
        { nil: undefined }
      ),
      assignee: fc.option(
        assignees.length > 0
          ? fc.constantFrom('Unassigned', ...assignees)
          : fc.constant('Unassigned'),
        { nil: undefined }
      ),
    })
  }

  it('result matches ALL active filter criteria with AND logic', () => {
    fc.assert(
      fc.property(
        arbPartList().filter((l) => l.length > 0),
        (parts) => {
          // Generate filters from actual data
          fc.assert(
            fc.property(arbFiltersFromParts(parts), (filters) => {
              const result = filterParts(parts, filters)

              // Manually compute expected
              const expected = parts.filter((s) => {
                if (filters.jobName && s.jobName !== filters.jobName) return false
                if (filters.pathName && s.pathName !== filters.pathName) return false
                if (filters.stepName && s.currentStepName !== filters.stepName) return false
                if (filters.status && filters.status !== 'all' && s.status !== filters.status)
                  return false
                if (filters.assignee) {
                  if (filters.assignee === 'Unassigned') {
                    if (s.assignedTo != null && s.assignedTo !== '') return false
                  } else {
                    if (s.assignedTo !== filters.assignee) return false
                  }
                }
                return true
              })

              expect(result.length).toBe(expected.length)
              for (let i = 0; i < result.length; i++) {
                expect(result[i]!.id).toBe(expected[i]!.id)
              }
            }),
            { numRuns: 20 }
          )
        }
      ),
      { numRuns: 5 }
    )
  })

  it('"Unassigned" filter matches only parts with undefined/null assignedTo', () => {
    fc.assert(
      fc.property(arbPartList(), (parts) => {
        const filters: PartBrowserFilters = { assignee: 'Unassigned' }
        const result = filterParts(parts, filters)

        for (const s of result) {
          expect(s.assignedTo == null || s.assignedTo === '').toBe(true)
        }

        // All unassigned parts must be in result
        const expectedCount = parts.filter(
          (s) => s.assignedTo == null || s.assignedTo === ''
        ).length
        expect(result.length).toBe(expectedCount)
      }),
      { numRuns: 100 }
    )
  })

  it('all empty filters returns all parts', () => {
    fc.assert(
      fc.property(arbPartList(), (parts) => {
        const result = filterParts(parts, {})
        expect(result.length).toBe(parts.length)
        expect(result).toEqual(parts)
      }),
      { numRuns: 100 }
    )
  })
})

// ---- Property 10: Part sort correctness ----

/**
 * Property 10: Part sort correctness
 *
 * For any list and valid sort column, ascending order produces elements ≤ next;
 * descending reverses; toggling same column reverses order.
 *
 * **Validates: Requirements 10.1, 10.2, 10.3, 11.5**
 */
describe('Property 10: Part sort correctness', () => {
  const validColumns = ['id', 'jobName', 'currentStepName', 'status', 'createdAt']

  it('ascending sort produces elements where each is ≤ next by column value', () => {
    fc.assert(
      fc.property(arbPartList(), fc.constantFrom(...validColumns), (parts, column) => {
        const sorted = sortParts(parts, column, 'asc')

        expect(sorted.length).toBe(parts.length)

        for (let i = 0; i < sorted.length - 1; i++) {
          const a = String((sorted[i] as any)[column] ?? '')
          const b = String((sorted[i + 1] as any)[column] ?? '')
          expect(a.localeCompare(b)).toBeLessThanOrEqual(0)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('descending sort produces elements where each is ≥ next by column value', () => {
    fc.assert(
      fc.property(arbPartList(), fc.constantFrom(...validColumns), (parts, column) => {
        const sorted = sortParts(parts, column, 'desc')

        expect(sorted.length).toBe(parts.length)

        for (let i = 0; i < sorted.length - 1; i++) {
          const a = String((sorted[i] as any)[column] ?? '')
          const b = String((sorted[i + 1] as any)[column] ?? '')
          expect(a.localeCompare(b)).toBeGreaterThanOrEqual(0)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('toggling direction reverses the ordering direction', () => {
    fc.assert(
      fc.property(arbPartList(), fc.constantFrom(...validColumns), (parts, column) => {
        const asc = sortParts(parts, column, 'asc')
        const desc = sortParts(parts, column, 'desc')

        expect(asc.length).toBe(desc.length)

        // Both contain the same set of elements
        const ascIds = new Set(asc.map((s) => s.id))
        const descIds = new Set(desc.map((s) => s.id))
        expect(ascIds).toEqual(descIds)

        // The column values in ascending are non-decreasing
        for (let i = 0; i < asc.length - 1; i++) {
          const a = String((asc[i] as any)[column] ?? '')
          const b = String((asc[i + 1] as any)[column] ?? '')
          expect(a.localeCompare(b)).toBeLessThanOrEqual(0)
        }

        // The column values in descending are non-increasing
        for (let i = 0; i < desc.length - 1; i++) {
          const a = String((desc[i] as any)[column] ?? '')
          const b = String((desc[i + 1] as any)[column] ?? '')
          expect(a.localeCompare(b)).toBeGreaterThanOrEqual(0)
        }
      }),
      { numRuns: 100 }
    )
  })
})
