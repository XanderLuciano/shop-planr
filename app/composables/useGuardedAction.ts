export function useGuardedAction<Args extends unknown[], T>(fn: (...args: Args) => Promise<T>) {
  const loading = ref(false)

  async function execute(...args: Args): Promise<T | undefined> {
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
