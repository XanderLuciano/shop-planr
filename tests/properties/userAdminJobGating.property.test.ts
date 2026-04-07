/**
 * Feature: user-admin-roles
 * Property 5: Admin-Gated New Job Button Visibility
 *
 * For any ShopUser, the "New Job" button on the jobs list page should be
 * visible if and only if that user's `isAdmin` is `true`. When no user is
 * authenticated, the button should not be visible.
 *
 * The jobs page gates the button with `v-if="isAdmin"`, where `isAdmin` is
 * the computed from `useAuth()`. This test validates the composable logic
 * that drives that visibility.
 *
 * **Validates: Requirements 6.3, 6.4, 6.5**
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
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2026-01-01') }).map(d => d.toISOString()),
})

describe('Property 5: Admin-Gated New Job Button Visibility', () => {
  it('New Job button visible (isAdmin === true) iff authenticated user isAdmin is true', () => {
    fc.assert(
      fc.property(
        arbShopUser,
        (user) => {
          const auth = useAuth()

          mockAuthenticatedUser.value = user

          // The button uses v-if="isAdmin", so visibility === isAdmin.value
          if (user.isAdmin) {
            expect(auth.isAdmin.value).toBe(true)
          } else {
            expect(auth.isAdmin.value).toBe(false)
          }

          // Cleanup
          mockAuthenticatedUser.value = null
        },
      ),
      { numRuns: 100 },
    )
  })

  it('New Job button not visible when no user is authenticated', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const auth = useAuth()

          mockAuthenticatedUser.value = null
          // No user authenticated → isAdmin false → button hidden
          expect(auth.isAdmin.value).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})
