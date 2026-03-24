/**
 * Property test for dropdown filter logic (P4).
 *
 * Tests the pure filtering logic used by StepAssignmentDropdown.
 * The filter function is duplicated here to avoid Vue component imports.
 *
 * Feature: step-assignment-and-part-views, Property 4: Dropdown option list with search filtering
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { ShopUser } from '~/server/types/domain'

// ---- Pure filter function (mirrors StepAssignmentDropdown logic) ----

interface DropdownOption {
  label: string
  value: string | null
}

/**
 * Pure dropdown filter logic.
 * Returns "Unassigned" as first option, then active users whose name
 * contains the search string (case-insensitive partial match).
 * "Unassigned" is always visible regardless of search input.
 */
export function filterDropdownOptions(users: ShopUser[], search: string): DropdownOption[] {
  const unassignedOption: DropdownOption = {
    label: 'Unassigned',
    value: null,
  }

  const normalizedSearch = search.toLowerCase().trim()

  const userOptions: DropdownOption[] = users
    .filter(u => u.active && (normalizedSearch === '' || u.name.toLowerCase().includes(normalizedSearch)))
    .map(u => ({
      label: u.name,
      value: u.id,
    }))

  return [unassignedOption, ...userOptions]
}

// ---- Generators ----

const arbShopUser = (): fc.Arbitrary<ShopUser> =>
  fc.record({
    id: fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length >= 3),
    name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length >= 1),
    department: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
    active: fc.boolean(),
    createdAt: fc.constant(new Date().toISOString()),
  })

const arbUserList = (): fc.Arbitrary<ShopUser[]> =>
  fc.array(arbShopUser(), { minLength: 0, maxLength: 20 })

const arbSearchString = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.constant(''),
    fc.string({ minLength: 0, maxLength: 30 }),
  )

// ---- Property 4 ----

/**
 * Property 4: Dropdown option list with search filtering
 *
 * For any list of active users and search string, filtered options =
 * "Unassigned" + users whose name contains search (case-insensitive);
 * empty search returns all active users.
 *
 * **Validates: Requirements 3.2, 3.3**
 */
describe('Property 4: Dropdown option list with search filtering', () => {
  it('"Unassigned" is always the first option regardless of search input', () => {
    fc.assert(
      fc.property(
        arbUserList(),
        arbSearchString(),
        (users, search) => {
          const result = filterDropdownOptions(users, search)
          expect(result.length).toBeGreaterThanOrEqual(1)
          expect(result[0]!.label).toBe('Unassigned')
          expect(result[0]!.value).toBeNull()
        },
      ),
      { numRuns: 100 },
    )
  })

  it('filtered options contain exactly active users whose name matches search (case-insensitive)', () => {
    fc.assert(
      fc.property(
        arbUserList(),
        arbSearchString(),
        (users, search) => {
          const result = filterDropdownOptions(users, search)
          const normalizedSearch = search.toLowerCase().trim()

          // Expected: active users whose name contains the search string
          const expectedUsers = users.filter(u =>
            u.active && (normalizedSearch === '' || u.name.toLowerCase().includes(normalizedSearch)),
          )

          // Result minus the "Unassigned" entry
          const resultUsers = result.slice(1)

          // Count should match
          expect(resultUsers.length).toBe(expectedUsers.length)

          // Each result user should correspond to an expected user
          for (let i = 0; i < resultUsers.length; i++) {
            expect(resultUsers[i]!.label).toBe(expectedUsers[i]!.name)
            expect(resultUsers[i]!.value).toBe(expectedUsers[i]!.id)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('empty search returns "Unassigned" + all active users', () => {
    fc.assert(
      fc.property(
        arbUserList(),
        (users) => {
          const result = filterDropdownOptions(users, '')
          const activeUsers = users.filter(u => u.active)

          // Should be Unassigned + all active users
          expect(result.length).toBe(1 + activeUsers.length)
          expect(result[0]!.label).toBe('Unassigned')

          for (let i = 0; i < activeUsers.length; i++) {
            expect(result[i + 1]!.label).toBe(activeUsers[i]!.name)
            expect(result[i + 1]!.value).toBe(activeUsers[i]!.id)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('inactive users are never included in results', () => {
    fc.assert(
      fc.property(
        arbUserList(),
        arbSearchString(),
        (users, search) => {
          const result = filterDropdownOptions(users, search)
          const inactiveIds = new Set(users.filter(u => !u.active).map(u => u.id))

          for (const option of result.slice(1)) {
            expect(inactiveIds.has(option.value!)).toBe(false)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
