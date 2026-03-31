/**
 * Composable to detect mobile viewport using matchMedia.
 * Returns a reactive `isMobile` ref that is `true` when viewport < 768px.
 * SSR-safe: defaults to `false` on server (no window available).
 *
 * Requirements: 1.1, 1.2, 4.2
 */
export function useMobileBreakpoint() {
  const isMobile = ref(false)

  if (import.meta.client) {
    let mql: MediaQueryList | null = null

    function onChange(e: MediaQueryListEvent) {
      isMobile.value = e.matches
    }

    onMounted(() => {
      mql = window.matchMedia('(max-width: 767.9px)')
      isMobile.value = mql.matches
      mql.addEventListener('change', onChange)
    })

    onUnmounted(() => {
      if (mql) {
        mql.removeEventListener('change', onChange)
      }
    })
  }

  return { isMobile }
}
