export default defineNuxtRouteMiddleware((to, from) => {
  // Skip during SSR
  if (import.meta.server) return

  // Skip if only query/hash changed (same path)
  if (to.path === from.path) return

  const { push, pop, replaceTop, entries } = useNavigationStack()
  const stack = entries.value

  // Back navigation detected: destination matches stack top
  if (stack.length > 0 && stack[stack.length - 1]!.path === to.path) {
    pop()
    return
  }

  // Same-page-type navigation (e.g., Step → Step via Prev/Next): replace top
  if (routePattern(from.path) === routePattern(to.path)) {
    replaceTop({ path: from.path, label: resolveLabel(from.path) })
    return
  }

  // Normal forward navigation: push departing route
  push({ path: from.path, label: resolveLabel(from.path) })
})
