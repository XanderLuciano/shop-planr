/**
 * Property tests for serial browser logic (P8, P9, P10).
 *
 * Tests the pure search, filter, and sort functions from useSerialBrowser.
 *
 * Feature: step-assignment-and-part-views
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { EnrichedSerial } from '../../server/types/computed'
import { searchSerials, filterSerials, sortSerials } from '../../app/composables/useSerialBrowser'
import type { SerialBrowserFilters } from '../../app/composables/useSerialBrowser'

// ---- Generators ----

const arbEnrichedSerial = (): fc.Arbitrary<EnrichedSerial> =>
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
    jobId: fc.string({ minLength: 3, maxLength: 20 }),
    jobName: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
    pathId: fc.string({ minLength: 3, maxLength: 20 }),
    pathName: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
    currentStepIndex: fc.oneof(fc.constant(-1), fc.integer({ min: 0, max: 10 })),
    currentStepName: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
    assignedTo: fc.option(
      fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
      { nil: undefined },
    ),
    status: fc.constantFrom('in-progress' as const, 'completed' as const),
    createdAt: fc.integer({ min: 1577836800000, max: 1893456000000 })
      .map(ts => new Date(ts).toISOString()),
  })

const arbSerialList = (): fc.Arbitrary<EnrichedSerial[]> =>
  fc.array(arbEnrichedSerial(), { minLength: 0, maxLength: 30 })

const arbSearchQuery = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.constant(''),
    fc.string({ minLength: 0, maxLength: 20 }),
  )

// ---- Property 8: Serial search filter correctness ----

/**
 * Property 8: Serial search filter correctness
 *
 * For any search query and list of EnrichedSerials, filtered result contains
 * exactly serials whose `id` contains query (case-insensitive); empty query
 * returns all.
 *
 * **Validates: Requirements 8.2**
 */
describe('Property 8: Serial search filter correctness', () => {
  it('filtered result contains exactly serials whose id contains query (case-insensitive)', () => {
    fc.assert(
      fc.property(
        arbSerialList(),
        arbSearchQuery(),
        (serials, query) => {
          const result = searchSerials(serials, query)
          const q = query.trim().toLowerCase()

          if (!q) {
            // Empty query returns all
            expect(result.length).toBe(serials.length)
            expect(result).toEqual(serials)
          } else {
            // Each result must contain the query in its id
            for (const s of result) {
              expect(s.id.toLowerCase()).toContain(q)
            }

            // Every serial matching the query must be in the result
            const expected = serials.filter(s => s.id.toLowerCase().includes(q))
            expect(result.length).toBe(expected.length)

            // Same set of ids
            const resultIds = result.map(s => s.id)
            const expectedIds = expected.map(s => s.id)
            expect(resultIds).toEqual(expectedIds)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('empty query returns all serials unchanged', () => {
    fc.assert(
      fc.property(
        arbSerialList(),
        (serials) => {
          const result = searchSerials(serials, '')
          expect(result).toEqual(serials)

          const resultSpaces = searchSerials(serials, '   ')
          expect(resultSpaces).toEqual(serials)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---- Property 9: Serial multi-filter AND logic ----

/**
 * Property 9: Serial multi-filter AND logic
 *
 * For any combination of filters, result contains exactly serials matching ALL
 * active criteria; "Unassigned" filter matches undefined/null `assignedTo`;
 * all empty returns all.
 *
 * **Validates: Requirements 9.2, 9.3**
 */
describe('Property 9: Serial multi-filter AND logic', () => {
  // Generator for filters that pick from actual serial values (to get meaningful hits)
  const arbFiltersFromSerials = (serials: EnrichedSerial[]): fc.Arbitrary<SerialBrowserFilters> => {
    if (serials.length === 0) {
      return fc.constant({})
    }
    const jobs = [...new Set(serials.map(s => s.jobName))]
    const paths = [...new Set(serials.map(s => s.pathName))]
    const steps = [...new Set(serials.map(s => s.currentStepName))]
    const assignees = [...new Set(serials.map(s => s.assignedTo).filter((v): v is string => !!v))]

    return fc.record({
      jobName: fc.option(fc.constantFrom(...jobs), { nil: undefined }),
      pathName: fc.option(fc.constantFrom(...paths), { nil: undefined }),
      stepName: fc.option(fc.constantFrom(...steps), { nil: undefined }),
      status: fc.option(
        fc.constantFrom('in-progress' as const, 'completed' as const, 'all' as const),
        { nil: undefined },
      ),
      assignee: fc.option(
        assignees.length > 0
          ? fc.constantFrom('Unassigned', ...assignees)
          : fc.constant('Unassigned'),
        { nil: undefined },
      ),
    })
  }

  it('result matches ALL active filter criteria with AND logic', () => {
    fc.assert(
      fc.property(
        arbSerialList().filter(l => l.length > 0),
        (serials) => {
          // Generate filters from actual data
          fc.assert(
            fc.property(
              arbFiltersFromSerials(serials),
              (filters) => {
                const result = filterSerials(serials, filters)

                // Manually compute expected
                const expected = serials.filter((s) => {
                  if (filters.jobName && s.jobName !== filters.jobName) return false
                  if (filters.pathName && s.pathName !== filters.pathName) return false
                  if (filters.stepName && s.currentStepName !== filters.stepName) return false
                  if (filters.status && filters.status !== 'all' && s.status !== filters.status) return false
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
              },
            ),
            { numRuns: 20 },
          )
        },
      ),
      { numRuns: 5 },
    )
  })

  it('"Unassigned" filter matches only serials with undefined/null assignedTo', () => {
    fc.assert(
      fc.property(
        arbSerialList(),
        (serials) => {
          const filters: SerialBrowserFilters = { assignee: 'Unassigned' }
          const result = filterSerials(serials, filters)

          for (const s of result) {
            expect(s.assignedTo == null || s.assignedTo === '').toBe(true)
          }

          // All unassigned serials must be in result
          const expectedCount = serials.filter(s => s.assignedTo == null || s.assignedTo === '').length
          expect(result.length).toBe(expectedCount)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('all empty filters returns all serials', () => {
    fc.assert(
      fc.property(
        arbSerialList(),
        (serials) => {
          const result = filterSerials(serials, {})
          expect(result.length).toBe(serials.length)
          expect(result).toEqual(serials)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---- Property 10: Serial sort correctness ----

/**
 * Property 10: Serial sort correctness
 *
 * For any list and valid sort column, ascending order produces elements ≤ next;
 * descending reverses; toggling same column reverses order.
 *
 * **Validates: Requirements 10.1, 10.2, 10.3, 11.5**
 */
describe('Property 10: Serial sort correctness', () => {
  const validColumns = ['id', 'jobName', 'currentStepName', 'status', 'createdAt']

  it('ascending sort produces elements where each is ≤ next by column value', () => {
    fc.assert(
      fc.property(
        arbSerialList(),
        fc.constantFrom(...validColumns),
        (serials, column) => {
          const sorted = sortSerials(serials, column, 'asc')

          expect(sorted.length).toBe(serials.length)

          for (let i = 0; i < sorted.length - 1; i++) {
            const a = String((sorted[i] as any)[column] ?? '')
            const b = String((sorted[i + 1] as any)[column] ?? '')
            expect(a.localeCompare(b)).toBeLessThanOrEqual(0)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('descending sort produces elements where each is ≥ next by column value', () => {
    fc.assert(
      fc.property(
        arbSerialList(),
        fc.constantFrom(...validColumns),
        (serials, column) => {
          const sorted = sortSerials(serials, column, 'desc')

          expect(sorted.length).toBe(serials.length)

          for (let i = 0; i < sorted.length - 1; i++) {
            const a = String((sorted[i] as any)[column] ?? '')
            const b = String((sorted[i + 1] as any)[column] ?? '')
            expect(a.localeCompare(b)).toBeGreaterThanOrEqual(0)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('toggling direction reverses the ordering direction', () => {
    fc.assert(
      fc.property(
        arbSerialList(),
        fc.constantFrom(...validColumns),
        (serials, column) => {
          const asc = sortSerials(serials, column, 'asc')
          const desc = sortSerials(serials, column, 'desc')

          expect(asc.length).toBe(desc.length)

          // Both contain the same set of elements
          const ascIds = new Set(asc.map(s => s.id))
          const descIds = new Set(desc.map(s => s.id))
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
        },
      ),
      { numRuns: 100 },
    )
  })
})
