# Bugfix Requirements Document

## Introduction

GitHub Issue #13: "Page toggle Bug on refresh"

The page visibility toggle system does not persist correctly across page refreshes. When a user has disabled certain pages via Settings → Page Visibility and then refreshes the browser, all pages become visible again in the sidebar and are accessible via direct URL. The toggle filter only re-applies when the user navigates to `/jira` or `/settings` (pages whose `onMounted` hooks call `fetchSettings()`). Even on those pages, there is a momentary flash of all pages before the filter takes effect.

The root cause is that `fetchSettings()` is never called at the app level during initialization. It is only invoked inside individual page components (`jira.vue`, `jobs/[id].vue`, `settings.vue`) in their `onMounted` hooks. On a fresh page load or refresh, `settings.value` in the `useSettings()` composable remains `null`, causing both the sidebar filtering in `default.vue` and the `pageGuard.global.ts` middleware to fall back to `DEFAULT_PAGE_TOGGLES` (all pages enabled).

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user has pages toggled off and refreshes any page (other than /jira, /settings, or /jobs/[id]) THEN the system shows all pages in the sidebar because `settings.value` is `null` and the fallback `DEFAULT_PAGE_TOGGLES` treats all pages as enabled

1.2 WHEN a user has pages toggled off and refreshes any page (other than /jira, /settings, or /jobs/[id]) THEN the system allows navigation to disabled pages via direct URL because the `pageGuard.global.ts` middleware reads `null` settings and falls back to `DEFAULT_PAGE_TOGGLES`

1.3 WHEN a user has pages toggled off and refreshes the /jira or /settings page THEN the system momentarily shows all pages in the sidebar before the filter is applied, because `fetchSettings()` runs asynchronously in `onMounted` and the sidebar renders with `DEFAULT_PAGE_TOGGLES` until the fetch completes

1.4 WHEN a user has pages toggled off and navigates from a non-fetching page to another non-fetching page THEN the system continues to show all pages because no page in the navigation path triggers `fetchSettings()`

### Expected Behavior (Correct)

2.1 WHEN a user has pages toggled off and refreshes any page THEN the system SHALL fetch settings during app initialization (before the first render) so that the sidebar immediately reflects the persisted page toggle state

2.2 WHEN a user has pages toggled off and refreshes any page THEN the system SHALL enforce the persisted page toggle state in the route middleware on the initial navigation, redirecting to `/` if the current route's page is disabled

2.3 WHEN a user has pages toggled off and refreshes the /jira or /settings page THEN the system SHALL not show a momentary flash of all pages, because settings are already loaded before the layout renders

2.4 WHEN a user has pages toggled off and navigates between any pages THEN the system SHALL consistently filter the sidebar and enforce route guards using the persisted page toggle state, regardless of which page is visited

### Unchanged Behavior (Regression Prevention)

3.1 WHEN all page toggles are enabled (default state) and the user refreshes any page THEN the system SHALL CONTINUE TO show all pages in the sidebar and allow navigation to all routes

3.2 WHEN a user changes a page toggle on the Settings page THEN the system SHALL CONTINUE TO reactively update the sidebar and route access without requiring a page reload

3.3 WHEN settings have not yet been fetched (e.g., network delay during app init) THEN the system SHALL CONTINUE TO treat all pages as enabled using `DEFAULT_PAGE_TOGGLES` so users are never incorrectly blocked

3.4 WHEN the user navigates to Dashboard (`/`) or Settings (`/settings`) THEN the system SHALL CONTINUE TO allow access regardless of any page toggle configuration

3.5 WHEN the `fetchSettings()` call fails due to a network or server error THEN the system SHALL CONTINUE TO fall back to `DEFAULT_PAGE_TOGGLES` so the app remains usable
