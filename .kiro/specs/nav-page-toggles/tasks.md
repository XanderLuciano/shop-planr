# Implementation Plan: Nav Page Toggles

## Overview

Add page visibility toggles to the Settings page, allowing administrators to hide/show sidebar navigation pages. Extends the existing `AppSettings` domain type, `settingsService`, `settingsRepository`, and `useSettings()` composable. Adds a new route middleware and a new Settings tab component.

## Tasks

- [x] 1. Database migration and domain types
  - [x] 1.1 Add `PageToggles` type and `DEFAULT_PAGE_TOGGLES` constant
    - Add `PageToggles` interface to `server/types/domain.ts` with 9 boolean keys: `jobs`, `serials`, `parts`, `queue`, `templates`, `bom`, `certs`, `jira`, `audit`
    - Add `pageToggles: PageToggles` field to the `AppSettings` interface
    - Create `server/utils/pageToggles.ts` with `DEFAULT_PAGE_TOGGLES` (all `true`), `ROUTE_TOGGLE_MAP`, `VALID_TOGGLE_KEYS`, `mergePageToggles()`, and `isPageEnabled()` utility functions
    - _Requirements: 3.1, 3.2_

  - [x] 1.2 Write property tests for `mergePageToggles` and `isPageEnabled`
    - **Property 5: Partial update preservation** — for any existing PageToggles and partial update, keys not in the update are preserved
    - **Validates: Requirements 2.2**
    - **Property 6: Unknown keys ignored in merge** — unknown keys in input are discarded, only valid keys remain
    - **Validates: Requirements 2.3**
    - **Property 7: Missing keys default to true** — partial PageToggles with fewer than 9 keys treat missing keys as `true`
    - **Validates: Requirements 3.2**
    - **Property 8: Idempotent toggle** — merging a state with itself produces identical PageToggles
    - **Validates: Requirements 7.1**

  - [x] 1.3 Create SQLite migration 005 for `page_toggles` column
    - Create `server/repositories/sqlite/migrations/005_add_page_toggles.sql`
    - `ALTER TABLE settings ADD COLUMN page_toggles TEXT NOT NULL DEFAULT '{}'`
    - _Requirements: 8.1_

  - [x] 1.4 Update `settingsRepository` to handle `pageToggles`
    - Update `SettingsRow` interface to include `page_toggles` column
    - Update `rowToDomain()` to parse `page_toggles` JSON and merge with `DEFAULT_PAGE_TOGGLES` for missing keys
    - Update `upsert()` to serialize `pageToggles` to JSON and include in INSERT/UPDATE
    - _Requirements: 8.2, 3.1, 3.2_

- [x] 2. Service and API layer
  - [x] 2.1 Extend `settingsService.updateSettings()` for `pageToggles`
    - Accept optional `pageToggles?: Partial<PageToggles>` in the input type
    - Use `mergePageToggles()` to merge partial update with current state
    - Validate that all provided values are booleans; ignore unknown keys
    - Update `buildDefaultSettings()` to include `pageToggles: DEFAULT_PAGE_TOGGLES`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 7.1_

  - [x] 2.2 Write unit tests for `settingsService` pageToggles handling
    - Test partial merge preserves existing values
    - Test unknown keys are ignored
    - Test non-boolean values are rejected/ignored
    - Test idempotent update (same values)
    - _Requirements: 2.2, 2.3, 2.4, 7.1_

  - [x] 2.3 Update `PUT /api/settings` route to pass `pageToggles` through
    - The existing route handler already passes `body` to `settingsService.updateSettings()` — verify it works with the new `pageToggles` field
    - _Requirements: 2.1_

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Route middleware and sidebar filtering
  - [x] 4.1 Create `pageGuard.global.ts` route middleware
    - Create `app/middleware/pageGuard.global.ts`
    - Read `pageToggles` from `useSettings()` composable, defaulting to `DEFAULT_PAGE_TOGGLES` if settings not yet loaded
    - Use `isPageEnabled()` to check if the target route is allowed
    - Redirect to `/` if the page is disabled
    - Always allow `/` and `/settings`
    - Match detail routes (e.g., `/jobs/123`) by their parent page toggle
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 10.1_

  - [x] 4.2 Write property tests for `isPageEnabled` route matching
    - **Property 1: Always-visible invariant** — `/` and `/settings` always return `true` for any PageToggles configuration
    - **Validates: Requirements 4.2, 5.3, 6.1**
    - **Property 3: Route access matches toggle state** — `isPageEnabled` returns `false` only when route maps to a toggle key that is `false`; detail routes inherit parent toggle
    - **Validates: Requirements 5.1, 5.2, 5.4**

  - [x] 4.3 Update sidebar in `default.vue` to filter nav items
    - Import `useSettings` composable and `isPageEnabled` / `DEFAULT_PAGE_TOGGLES` from `pageToggles` utils
    - Replace static `navItems` binding with a computed `filteredNavItems` that filters based on `pageToggles`
    - Ensure Dashboard and Settings items always appear
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 10.2_

  - [x] 4.4 Write property tests for sidebar filtering
    - **Property 2: Toggle-visibility consistency** — an item appears in filtered list iff `isPageEnabled` returns `true` for its route
    - **Validates: Requirements 4.1**
    - **Property 4: Sidebar item count bounds** — filtered items count is always ≥ 2 and ≤ total items
    - **Validates: Requirements 6.1, 6.2**

- [x] 5. Settings UI — Page Visibility tab
  - [x] 5.1 Create `PageVisibilitySettings` component
    - Create `app/components/PageVisibilitySettings.vue`
    - Accept `toggles: PageToggles` prop, emit `update` event with updated `PageToggles`
    - Render a toggle switch (Nuxt UI `USwitch`) for each of the 9 toggleable pages with label and icon
    - Show Dashboard and Settings as always-on (disabled switches or visual indicator)
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 5.2 Add "Page Visibility" tab to Settings page
    - Add a new tab `{ label: 'Page Visibility', value: 'pages', icon: 'i-lucide-eye' }` to the `tabs` array in `app/pages/settings.vue`
    - Add tab content section that renders `PageVisibilitySettings` with current `settings.pageToggles`
    - Wire `@update` handler to call `updateSettings({ pageToggles })` with error handling, toast notification, and revert on failure
    - _Requirements: 1.1, 9.1, 9.2_

  - [x] 5.3 Extend `useSettings` composable for `pageToggles`
    - Update `updateSettings()` input type to accept `pageToggles?: Partial<PageToggles>`
    - Ensure reactive `settings` ref updates after successful save so sidebar re-renders immediately
    - _Requirements: 4.3, 4.4_

- [x] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The design uses TypeScript throughout — all implementation uses TypeScript
- Property tests use `fast-check` per project conventions
- The existing `PUT /api/settings` route already passes the body through, so minimal API route changes are needed
- `server/utils/` exports are auto-imported by Nitro — `DEFAULT_PAGE_TOGGLES`, `mergePageToggles()`, `isPageEnabled()` will be available in API routes without explicit imports
- `app/composables/` exports are auto-imported by Nuxt — `useSettings()` is available in components and middleware without imports
