/**
 * Feature: user-admin-roles
 * Property 4: isAdmin Computed Tracks Selected User
 *
 * For any sequence of ShopUser objects with varying `isAdmin` values,
 * when each user is set as the selected user in the `useUsers` composable,
 * the `isAdmin` computed property should equal that user's `isAdmin` field.
 * When the selected user is cleared (set to null), `isAdmin` should return `false`.
 *
 * **Validates: Requirements 5.1, 5.2, 5.3**
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fc from 'fast-check'
import { useUsers } from '../../app/composables/useUsers'

// happy-dom provides window but localStorage may not be fully functional.
// Stub it with a simple in-memory implementation.
let store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { store = {} },
})

beforeEach(() => {
  store = {}
})

/**
 * Arbitrary: a ShopUser with random isAdmin flag.
 * Only id and isAdmin matter for this property; other fields are plausible defaults.
 */
const arbShopUser = fc.record({
  id: fc.uuid(),
  username: fc.string({ minLength: 1, maxLength: 20 }),
  displayName: fc.string({ minLength: 1, maxLength: 30 }),
  isAdmin: fc.boolean(),
  department: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  active: fc.boolean(),
  createdAt: fc.constant(new Date().toISOString()),
})

describe('Property 4: isAdmin Computed Tracks Selected User', () => {
  it('isAdmin matches selected user isAdmin for any sequence of users, and false after clear', () => {
    fc.assert(
      fc.property(
        fc.array(arbShopUser, { minLength: 1, maxLength: 20 }),
        (users) => {
          const { isAdmin, selectUser, clearUser } = useUsers()

          for (const user of users) {
            selectUser(user)
            expect(isAdmin.value).toBe(user.isAdmin)
          }

          // After clearing, isAdmin must be false
          clearUser()
          expect(isAdmin.value).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('isAdmin is false when no user is selected', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const { isAdmin, clearUser } = useUsers()

          // Ensure cleared state
          clearUser()
          expect(isAdmin.value).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})
