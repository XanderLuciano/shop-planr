import { ref, readonly } from 'vue'
import type { ShopUser } from '~/types/domain'

const STORAGE_KEY = 'shop_erp_operator_id'

const operatorId = ref<string | null>(null)
const operatorName = ref<string | null>(null)
const activeUsers = ref<ShopUser[]>([])
const loading = ref(false)

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export function useOperatorIdentity() {
  const $api = useAuthFetch()

  async function fetchActiveUsers(): Promise<void> {
    loading.value = true
    try {
      activeUsers.value = await $api<ShopUser[]>('/api/users')
    } catch {
      activeUsers.value = []
    } finally {
      loading.value = false
    }
  }

  function selectOperator(userId: string): void {
    const user = activeUsers.value.find(u => u.id === userId)
    operatorId.value = userId
    operatorName.value = user?.displayName ?? null
    if (isBrowser()) {
      localStorage.setItem(STORAGE_KEY, userId)
    }
  }

  function clearOperator(): void {
    operatorId.value = null
    operatorName.value = null
    if (isBrowser()) {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  /** Restore operator from localStorage and validate against active users */
  async function init(): Promise<void> {
    await fetchActiveUsers()

    if (isBrowser()) {
      const storedId = localStorage.getItem(STORAGE_KEY)
      if (storedId) {
        const found = activeUsers.value.find(u => u.id === storedId)
        if (found) {
          operatorId.value = found.id
          operatorName.value = found.displayName
        } else {
          // Stored operator no longer active — clear stale entry
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    }
  }

  return {
    operatorId: readonly(operatorId),
    operatorName: readonly(operatorName),
    activeUsers: readonly(activeUsers),
    loading: readonly(loading),
    fetchActiveUsers,
    selectOperator,
    clearOperator,
    init,
  }
}
