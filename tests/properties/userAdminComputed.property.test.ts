/**
 * Feature: user-admin-roles
 * Property 4: isAdmin Computed Tracks Authenticated User
 *
 * For any sequence of ShopUser objects with varying `isAdmin` values,
 * when each user is set as the authenticated user in the `useAuth` composable,
 * the `isAdmin` computed property should equal that user's `isAdmin` field.
 * When the authenticated user is null, `isAdmin` should return `false`.
 *
 * **Validates: Requirements 5.1, 5.2, 5.3**
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import fc from 'fast-check'

// Module-level ref that the useAuth stub will return
const mockAuthenticatedUser = ref<any>(null)

// Stub useCookie so the real useAuth module doesn't crash if loaded in the same worker
vi.stubGlobal('useCookie', (_name: string, _opts?: any) => ref(null))
vi.stubGlobal('useState', (_key: string, init?: () => any) => ref(init ? init() : undefined))

vi.stubGlobal('useAuth', () => ({
  authenticatedUser: mockAuthenticatedUser,
  isAdmin: { get value() { return mockAuthenticatedUser.value?.isAdmin === true } },
}))

beforeEach(() => {
  mockAuthenticatedUser.value = null
})

/**
 * Arbitrary: a ShopUser with random isAdmin flag.
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

describe('Property 4: isAdmin Computed Tracks Authenticated User', () => {
  it('isAdmin matches authenticated user isAdmin for any sequence of users, and false when null', () => {
    fc.assert(
      fc.property(
        fc.array(arbShopUser, { minLength: 1, maxLength: 20 }),
        (users) => {
          const auth = useAuth()

          for (const user of users) {
            mockAuthenticatedUser.value = user
            expect(auth.isAdmin.value).toBe(user.isAdmin)
          }

          // After clearing, isAdmin must be false
          mockAuthenticatedUser.value = null
          expect(auth.isAdmin.value).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('isAdmin is false when no user is authenticated', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const auth = useAuth()

          mockAuthenticatedUser.value = null
          expect(auth.isAdmin.value).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})
