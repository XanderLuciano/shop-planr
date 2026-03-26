/**
 * Global route middleware that blocks navigation to disabled pages.
 *
 * Reads `pageToggles` from the shared settings composable and redirects
 * to the dashboard (`/`) when the target route's page is toggled off.
 *
 * If settings haven't loaded yet, all pages are treated as enabled
 * (DEFAULT_PAGE_TOGGLES) so users are never incorrectly blocked.
 */
export default defineNuxtRouteMiddleware((to) => {
  const { settings } = useSettings()
  const pageToggles = settings.value?.pageToggles ?? DEFAULT_PAGE_TOGGLES

  if (!isPageEnabled(pageToggles, to.path)) {
    return navigateTo('/')
  }
})
