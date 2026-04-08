export default defineNuxtRouteMiddleware((to, from) => {
  // Skip during SSR
  if (import.meta.server) return

  // Skip if only query/hash changed (same path)
  if (to.path === from.path) return

  const { push, pop, entries } = useNavigationStack()
  const stack = entries.value

  // Back navigation detected: destination matches stack top
  if (stack.length > 0 && stack[stack.length - 1]!.path === to.path) {
    pop()
    return
  }

  // Same-page-type navigation (e.g., Step → Step via Prev/Next): no-op
  // The stack already has the entry point (e.g., Queue), don't replace it
  if (routePattern(from.path) === routePattern(to.path)) {
    return
  }

  // Normal forward navigation: push departing route
  push({ path: from.path, label: resolveLabel(from.path) })
})
