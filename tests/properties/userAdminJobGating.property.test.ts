/**
 * Feature: user-admin-roles
 * Property 5: Admin-Gated New Job Button Visibility
 *
 * For any ShopUser, the "New Job" button on the jobs list page should be
 * visible if and only if that user's `isAdmin` is `true`. When no user is
 * selected, the button should not be visible.
 *
 * The jobs page gates the button with `v-if="isAdmin"`, where `isAdmin` is
 * the computed from `useUsers()`. This test validates the composable logic
 * that drives that visibility.
 *
 * **Validates: Requirements 6.3, 6.4, 6.5**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { useUsers } from '../../app/composables/useUsers'

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
  createdAt: fc.date().map(d => d.toISOString()),
})

describe('Property 5: Admin-Gated New Job Button Visibility', () => {
  it('New Job button visible (isAdmin === true) iff selected user isAdmin is true', () => {
    fc.assert(
      fc.property(
        arbShopUser,
        (user) => {
          const { isAdmin, selectUser, clearUser } = useUsers()

          selectUser(user)

          // The button uses v-if="isAdmin", so visibility === isAdmin.value
          if (user.isAdmin) {
            expect(isAdmin.value).toBe(true)
          } else {
            expect(isAdmin.value).toBe(false)
          }

          // Cleanup
          clearUser()
        },
      ),
      { numRuns: 100 },
    )
  })

  it('New Job button not visible when no user is selected', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const { isAdmin, clearUser } = useUsers()

          clearUser()
          // No user selected → isAdmin false → button hidden
          expect(isAdmin.value).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})
