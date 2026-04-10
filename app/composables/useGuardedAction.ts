export function useGuardedAction<T>(fn: (...args: any[]) => Promise<T>) {
  const loading = ref(false)

  async function execute(...args: any[]): Promise<T | undefined> {
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
