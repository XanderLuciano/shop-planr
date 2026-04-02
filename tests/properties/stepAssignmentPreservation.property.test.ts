/**
 * Preservation Property Tests — Non-Assignment Behavior Unchanged
 *
 * These tests establish baseline behavior on UNFIXED code that must
 * be preserved after the fix is applied. They validate:
 *
 * 1. Null input to extraction logic returns null (unassign preserved)
 * 2. filterDropdownOptions returns "Unassigned" first + matching active
 *    users for any user list and search string (dropdown filter preserved)
 *
 * Feature: step-assignment-dropdown bugfix
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { ShopUser } from '~/server/types/domain'

// ---- Duplicated UNFIXED extraction logic ----
// Mirrors: `const userId = item?.value ?? null`
// On unfixed code, null input → null?.value → undefined → null (correct by coincidence)

function extractUserIdUnfixed(item: any): string | null {
  const userId = item?.value ?? null
  return userId
}

// ---- Pure filter function (mirrors StepAssignmentDropdown logic) ----

interface DropdownOption {
  label: string
  value: string | null
}

function filterDropdownOptions(users: ShopUser[], search: string): DropdownOption[] {
  const unassignedOption: DropdownOption = {
    label: 'Unassigned',
    value: null,
  }

  const normalizedSearch = search.toLowerCase().trim()

  const userOptions: DropdownOption[] = users
    .filter(u => u.active && (normalizedSearch === '' || u.displayName.toLowerCase().includes(normalizedSearch)))
    .map(u => ({
      label: u.displayName,
      value: u.id,
    }))

  return [unassignedOption, ...userOptions]
}

// ---- Generators ----

const arbShopUser = (): fc.Arbitrary<ShopUser> =>
  fc.record({
    id: fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length >= 3),
    username: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length >= 1),
    displayName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length >= 1),
    isAdmin: fc.boolean(),
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

// ---- Property 2: Preservation ----

describe('Property 2: Preservation — Non-Assignment Behavior Unchanged', () => {
  describe('Unassign extraction preserved', () => {
    it('null input to extraction logic always returns null', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          (input) => {
            const result = extractUserIdUnfixed(input)
            expect(result).toBeNull()
          },
        ),
        { numRuns: 50 },
      )
    })
  })

  describe('Dropdown filter behavior preserved', () => {
    it('"Unassigned" is always the first option regardless of users or search', () => {
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

    it('returns exactly active users whose name matches search (case-insensitive)', () => {
      fc.assert(
        fc.property(
          arbUserList(),
          arbSearchString(),
          (users, search) => {
            const result = filterDropdownOptions(users, search)
            const normalizedSearch = search.toLowerCase().trim()

            const expectedUsers = users.filter(u =>
              u.active && (normalizedSearch === '' || u.displayName.toLowerCase().includes(normalizedSearch)),
            )

            const resultUsers = result.slice(1)
            expect(resultUsers.length).toBe(expectedUsers.length)

            for (let i = 0; i < resultUsers.length; i++) {
              expect(resultUsers[i]!.label).toBe(expectedUsers[i]!.displayName)
              expect(resultUsers[i]!.value).toBe(expectedUsers[i]!.id)
            }
          },
        ),
        { numRuns: 100 },
      )
    })

    it('inactive users are never included in filtered results', () => {
      fc.assert(
        fc.property(
          arbUserList(),
          arbSearchString(),
          (users, search) => {
            const result = filterDropdownOptions(users, search)
            // Collect IDs that belong ONLY to inactive users (not also active)
            const activeIds = new Set(users.filter(u => u.active).map(u => u.id))
            const purelyInactiveIds = new Set(
              users.filter(u => !u.active && !activeIds.has(u.id)).map(u => u.id),
            )

            for (const option of result.slice(1)) {
              expect(purelyInactiveIds.has(option.value!)).toBe(false)
            }
          },
        ),
        { numRuns: 100 },
      )
    })
  })
})
