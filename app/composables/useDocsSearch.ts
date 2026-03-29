/**
 * Composable for full-text search across API documentation content.
 *
 * Uses Nuxt Content v3's `queryCollectionSearchSections` for search,
 * debounced at 300ms, scoped to `/api-docs` paths only.
 */

export interface DocsSearchResult {
  title: string
  path: string
  titles: string[] // breadcrumb titles from Nuxt Content search
}

export function useDocsSearch() {
  const query = ref('')
  const results = ref<DocsSearchResult[]>([])
  const isSearching = ref(false)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  async function search(q: string) {
    query.value = q

    // Clear any pending debounce
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }

    // Empty query → clear results immediately
    if (!q.trim()) {
      results.value = []
      isSearching.value = false
      return
    }

    isSearching.value = true

    debounceTimer = setTimeout(async () => {
      try {
        const sections = await queryCollectionSearchSections('docs').where(
          'path',
          'LIKE',
          '/api-docs%'
        )

        const searchTerms = q.toLowerCase().split(/\s+/).filter(Boolean)

        const matched = sections.filter((section) => {
          const haystack = [section.title, section.content, ...section.titles]
            .join(' ')
            .toLowerCase()

          return searchTerms.every((term) => haystack.includes(term))
        })

        // Deduplicate by path (extracted from id) and map to DocsSearchResult
        const seen = new Set<string>()
        const deduplicated: DocsSearchResult[] = []

        for (const section of matched) {
          // Section id format is typically the path — extract the page path
          const path = section.id.replace(/#.*$/, '')
          if (seen.has(path)) continue
          seen.add(path)

          deduplicated.push({
            title: section.title || section.titles[section.titles.length - 1] || path,
            path,
            titles: section.titles,
          })
        }

        results.value = deduplicated
      } catch {
        results.value = []
      } finally {
        isSearching.value = false
      }
    }, 300)
  }

  return {
    query,
    results,
    isSearching,
    search,
  }
}
