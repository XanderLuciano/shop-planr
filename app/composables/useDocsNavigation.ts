import type { ContentNavigationItem } from '@nuxt/content'

/**
 * Thin wrapper around Nuxt Content v3 navigation for the API docs sidebar.
 *
 * Returns the navigation tree, the current category slug, and an
 * `isActive` helper for highlighting the active page.
 */
export function useDocsNavigation() {
  const route = useRoute()

  const { data: navigation } = useAsyncData('docs-navigation', () =>
    queryCollectionNavigation('docs', ['icon', 'method', 'endpoint'])
  )

  const currentCategory = computed<string | null>(() => {
    // Extract category from route path: /api-docs/jobs/create → "jobs"
    const segments = route.path
      .replace(/^\/api-docs\/?/, '')
      .split('/')
      .filter(Boolean)
    return segments.length > 0 ? segments[0] : null
  })

  function isActive(path: string): boolean {
    return route.path === path
  }

  return {
    navigation: navigation as Ref<ContentNavigationItem[] | null>,
    currentCategory,
    isActive,
  }
}
