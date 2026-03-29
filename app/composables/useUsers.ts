import { ref, readonly } from 'vue'
import type { ShopUser } from '~/server/types/domain'

const STORAGE_KEY = 'shop_erp_selected_user'

const users = ref<ShopUser[]>([])
const selectedUser = ref<ShopUser | null>(null)
const loading = ref(false)

let initialized = false

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export function useUsers() {
  async function fetchUsers() {
    loading.value = true
    try {
      users.value = await $fetch<ShopUser[]>('/api/users')
    } catch {
      users.value = []
    } finally {
      loading.value = false
    }
  }

  function selectUser(user: ShopUser) {
    selectedUser.value = user
    if (isBrowser()) {
      localStorage.setItem(STORAGE_KEY, user.id)
    }
  }

  function clearUser() {
    selectedUser.value = null
    if (isBrowser()) {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  /** Restore selected user from localStorage and validate it still exists */
  async function init() {
    if (initialized) return
    initialized = true

    await fetchUsers()

    if (isBrowser()) {
      const storedId = localStorage.getItem(STORAGE_KEY)
      if (storedId) {
        const found = users.value.find((u) => u.id === storedId)
        if (found) {
          selectedUser.value = found
        } else {
          // Stored user no longer exists or is inactive — clear
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    }
  }

  /**
   * Returns the currently selected user or throws if none is selected.
   * Use before auditable actions to ensure a user is identified.
   */
  function requireUser(): ShopUser {
    if (!selectedUser.value) {
      throw new Error('No user selected. Please select a user before performing this action.')
    }
    return selectedUser.value
  }

  return {
    users: readonly(users),
    selectedUser: readonly(selectedUser),
    loading: readonly(loading),
    fetchUsers,
    selectUser,
    clearUser,
    requireUser,
    init,
  }
}
