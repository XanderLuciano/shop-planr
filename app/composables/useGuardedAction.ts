export function useGuardedAction<T>(fn: (...args: unknown[]) => Promise<T>) {
  const loading = ref(false)

  async function execute(...args: unknown[]): Promise<T | undefined> {
    if (loading.value) return undefined
    loading.value = true
    try {
      return await fn(...args)
    } finally {
      loading.value = false
    }
  }

  return { execute, loading }
}
