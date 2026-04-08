import type { RouterConfig } from '@nuxt/schema'

export default <RouterConfig>{
  scrollBehavior(to, _from, savedPosition) {
    // Restore saved position on browser back/forward
    if (savedPosition) return savedPosition

    // Skip scroll for hashes used as tab state (no matching DOM element)
    if (to.hash && !document.querySelector(to.hash)) return false

    // Scroll to hash anchor if the element exists
    if (to.hash) return { el: to.hash, behavior: 'smooth' }

    // Default: scroll to top
    return { top: 0 }
  },
}
