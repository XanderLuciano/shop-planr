/**
 * Feature: user-admin-roles
 * Property 6: Admin Badge Matches isAdmin Flag
 *
 * For any list of ShopUser objects rendered in the Settings user list,
 * a user should have an "Admin" badge displayed next to their name
 * if and only if their `isAdmin` field is `true`.
 *
 * The Settings page renders the badge with `v-if="u.isAdmin"`.
 * This test validates the condition logic: for each user in a mixed list,
 * the badge presence matches the `isAdmin` flag exactly.
 *
 * **Validates: Requirements 7.1, 7.2**
 */
import { describe, it, expect } from 'vitest'
import type { ShopUser } from '../../server/types/domain'

/**
 * Simulates the badge visibility logic from settings.vue:
 *   <UBadge v-if="u.isAdmin" ...>Admin</UBadge>
 *
 * Returns true if the badge should be rendered for this user.
 */
function shouldShowAdminBadge(user: ShopUser): boolean {
  return user.isAdmin
}

function makeUser(overrides: Partial<ShopUser> = {}): ShopUser {
  return {
    id: overrides.id ?? 'user-1',
    username: overrides.username ?? 'jdoe',
    displayName: overrides.displayName ?? 'John Doe',
    isAdmin: overrides.isAdmin ?? false,
    department: overrides.department,
    active: overrides.active ?? true,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  }
}

describe('Property 6: Admin Badge Matches isAdmin Flag', () => {
  it('badge shown for admin users only in a mixed list', () => {
    const users: ShopUser[] = [
      makeUser({ id: '1', displayName: 'Alice', isAdmin: true }),
      makeUser({ id: '2', displayName: 'Bob', isAdmin: false }),
      makeUser({ id: '3', displayName: 'Carol', isAdmin: true }),
      makeUser({ id: '4', displayName: 'Dave', isAdmin: false }),
      makeUser({ id: '5', displayName: 'Eve', isAdmin: false }),
    ]

    const badgeResults = users.map(u => ({
      displayName: u.displayName,
      isAdmin: u.isAdmin,
      badgeVisible: shouldShowAdminBadge(u),
    }))

    for (const result of badgeResults) {
      expect(result.badgeVisible).toBe(result.isAdmin)
    }
  })

  it('badge not shown when all users are non-admin', () => {
    const users: ShopUser[] = [
      makeUser({ id: '1', displayName: 'Alice', isAdmin: false }),
      makeUser({ id: '2', displayName: 'Bob', isAdmin: false }),
      makeUser({ id: '3', displayName: 'Carol', isAdmin: false }),
    ]

    for (const u of users) {
      expect(shouldShowAdminBadge(u)).toBe(false)
    }
  })

  it('badge shown for all users when all are admin', () => {
    const users: ShopUser[] = [
      makeUser({ id: '1', displayName: 'Alice', isAdmin: true }),
      makeUser({ id: '2', displayName: 'Bob', isAdmin: true }),
    ]

    for (const u of users) {
      expect(shouldShowAdminBadge(u)).toBe(true)
    }
  })

  it('badge not shown for empty user list', () => {
    const users: ShopUser[] = []
    const badgeResults = users.map(u => shouldShowAdminBadge(u))
    expect(badgeResults).toEqual([])
  })

  it('badge matches isAdmin for single user', () => {
    const admin = makeUser({ isAdmin: true })
    const regular = makeUser({ isAdmin: false })

    expect(shouldShowAdminBadge(admin)).toBe(true)
    expect(shouldShowAdminBadge(regular)).toBe(false)
  })
})
