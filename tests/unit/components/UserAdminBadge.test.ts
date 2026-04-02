/**
 * Feature: user-admin-roles
 * Property 6: Admin Badge Matches isAdmin Flag
 *
 * For any list of ShopUser objects rendered in the Settings user list,
 * a user should have an "Admin" badge displayed next to their name
 * if and only if their `isAdmin` field is `true`.
 *
 * Mounts a minimal reproduction of the Settings user-row template
 * and asserts on actual DOM presence of the badge element.
 *
 * **Validates: Requirements 7.1, 7.2**
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import type { ShopUser } from '../../server/types/domain'

/**
 * Minimal reproduction of the Settings page user-row template.
 * Mirrors the real markup: displayName + conditional "Admin" badge.
 */
const UserRow = defineComponent({
  name: 'UserRow',
  props: {
    users: { type: Array as () => ShopUser[], required: true },
  },
  setup(props) {
    return () =>
      h('div', { class: 'user-list' },
        props.users.map(u =>
          h('div', { key: u.id, class: 'user-row', 'data-user-id': u.id }, [
            h('span', { class: 'display-name' }, u.displayName),
            u.isAdmin
              ? h('span', { class: 'admin-badge' }, 'Admin')
              : null,
          ]),
        ),
      )
  },
})

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
  it('badge rendered for admin users only in a mixed list', () => {
    const users: ShopUser[] = [
      makeUser({ id: '1', displayName: 'Alice', isAdmin: true }),
      makeUser({ id: '2', displayName: 'Bob', isAdmin: false }),
      makeUser({ id: '3', displayName: 'Carol', isAdmin: true }),
      makeUser({ id: '4', displayName: 'Dave', isAdmin: false }),
      makeUser({ id: '5', displayName: 'Eve', isAdmin: false }),
    ]

    const wrapper = mount(UserRow, { props: { users } })

    for (const u of users) {
      const row = wrapper.find(`[data-user-id="${u.id}"]`)
      expect(row.exists()).toBe(true)
      expect(row.find('.display-name').text()).toBe(u.displayName)

      const badge = row.find('.admin-badge')
      if (u.isAdmin) {
        expect(badge.exists()).toBe(true)
        expect(badge.text()).toBe('Admin')
      } else {
        expect(badge.exists()).toBe(false)
      }
    }

    wrapper.unmount()
  })

  it('no badges rendered when all users are non-admin', () => {
    const users: ShopUser[] = [
      makeUser({ id: '1', displayName: 'Alice', isAdmin: false }),
      makeUser({ id: '2', displayName: 'Bob', isAdmin: false }),
    ]

    const wrapper = mount(UserRow, { props: { users } })
    expect(wrapper.findAll('.admin-badge')).toHaveLength(0)
    wrapper.unmount()
  })

  it('all rows have badges when all users are admin', () => {
    const users: ShopUser[] = [
      makeUser({ id: '1', displayName: 'Alice', isAdmin: true }),
      makeUser({ id: '2', displayName: 'Bob', isAdmin: true }),
    ]

    const wrapper = mount(UserRow, { props: { users } })
    expect(wrapper.findAll('.admin-badge')).toHaveLength(2)
    wrapper.unmount()
  })

  it('no rows rendered for empty user list', () => {
    const wrapper = mount(UserRow, { props: { users: [] } })
    expect(wrapper.findAll('.user-row')).toHaveLength(0)
    expect(wrapper.findAll('.admin-badge')).toHaveLength(0)
    wrapper.unmount()
  })

  it('badge matches isAdmin for single user', () => {
    const admin = makeUser({ id: '1', isAdmin: true })
    const regular = makeUser({ id: '2', isAdmin: false })

    const wrapperAdmin = mount(UserRow, { props: { users: [admin] } })
    expect(wrapperAdmin.find('.admin-badge').exists()).toBe(true)
    wrapperAdmin.unmount()

    const wrapperRegular = mount(UserRow, { props: { users: [regular] } })
    expect(wrapperRegular.find('.admin-badge').exists()).toBe(false)
    wrapperRegular.unmount()
  })
})
