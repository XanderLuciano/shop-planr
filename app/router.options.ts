import type { RouterConfig } from '@nuxt/schema'

export default <RouterConfig>{
  scrollBehavior(to, _from, savedPosition) {
    // Restore saved position on browser back/forward
    if (savedPosition) return savedPosition

    if (to.hash) {
      const id = to.hash.slice(1)
      if (!id || !document.getElementById(id)) return false
      return { el: `#${CSS.escape(id)}`, behavior: 'smooth' }
    }

    // Default: scroll to top
    return { top: 0 }
  },
}
