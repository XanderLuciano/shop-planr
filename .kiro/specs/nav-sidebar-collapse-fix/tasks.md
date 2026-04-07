# Implementation Plan

- [x] 1. Explore bug condition in current markup
  - **Property 1: Bug Condition** — Sidebar footer contains UColorModeButton alongside UDashboardSidebarCollapse
  - **CRITICAL**: Verify BEFORE implementing the fix
  - **GOAL**: Confirm the bug exists by inspecting `app/layouts/default.vue`
  - Verify the sidebar `<template #footer>` contains `<UColorModeButton size="xs" />`
  - Verify the wrapper `<div class="flex items-center justify-between">` holds both buttons
  - Document finding: both components share a narrow collapsed sidebar footer, causing overlap
  - _Requirements: 1.1, 1.2_

- [x] 2. Verify preservation baseline (BEFORE implementing fix)
  - **Property 2: Preservation** — Navbar color mode toggle, API Docs link, and collapse button present
  - **IMPORTANT**: Confirm these elements exist in the current code so we know what to preserve
  - Verify `UDashboardNavbar` template `#right` slot contains `<UColorModeButton size="xs" />`
  - Verify sidebar footer contains `NuxtLink` to `/api-docs`
  - Verify sidebar footer contains `<UDashboardSidebarCollapse />`
  - All three confirmed present — baseline recorded
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Fix sidebar footer overlap

  - [x] 3.1 Remove UColorModeButton and wrapper div from sidebar footer
    - Delete `<UColorModeButton size="xs" />` from the sidebar `<template #footer>`
    - Replace the `<div class="flex items-center justify-between">` wrapper with bare `<UDashboardSidebarCollapse />`
    - _Bug_Condition: sidebarFooterHasColorModeButton = true AND sidebarCollapsed = true_
    - _Expected_Behavior: sidebar footer renders only UDashboardSidebarCollapse with no overlapping elements_
    - _Preservation: navbar UColorModeButton, API Docs link, collapse button unchanged_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 Verify bug condition is resolved
    - **Property 1: Expected Behavior** — Sidebar footer no longer contains UColorModeButton
    - Inspect updated `app/layouts/default.vue` sidebar `<template #footer>`
    - Confirm `UColorModeButton` is absent from the sidebar footer
    - Confirm `UDashboardSidebarCollapse` renders without a wrapper div
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation after fix
    - **Property 2: Preservation** — Navbar toggle, API Docs link, collapse button still present
    - Confirm `UDashboardNavbar` `#right` slot still contains `<UColorModeButton size="xs" />`
    - Confirm sidebar footer still contains `NuxtLink` to `/api-docs`
    - Confirm sidebar footer still contains `<UDashboardSidebarCollapse />`
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 3.4 Run lint and type checks
    - Run `npx nuxi typecheck` or project lint command to confirm no errors introduced
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

- [x] 4. Checkpoint — Ensure no lint/type errors and all checks pass
  - Ensure all verification steps above are satisfied, ask the user if questions arise.

- [x] 5. Fix collapsed sidebar clickability (resize panel overlap)
  - Add `:collapsed-size="4"` to `UDashboardSidebar` so the resizable panel allocates 4% width when collapsed
  - Without this, the default `collapsed-size` of `0` causes the adjacent panel/resize handle to sit on top of the sidebar's `min-w-16` visual area, intercepting clicks
  - _Requirements: 4.1, 5.1_

- [x] 6. Fix collapsed sidebar text wrapping and icon centering
  - [x] 6.1 Add `group` class to sidebar root via `:ui` prop to enable `group-data-[collapsed=true]` selectors
  - [x] 6.2 Add `group-data-[collapsed=true]:hidden` to "Shop Planr" header text span
  - [x] 6.3 Update existing `group-data-[collapsed]:hidden` to `group-data-[collapsed=true]:hidden` on API Docs text and external link icon (value-specific match required)
  - [x] 6.4 Wrap `UNavigationMenu` in `<template #default="{ collapsed }">` and pass `:collapsed="collapsed"` prop
  - [x] 6.5 Add collapsed-aware padding/centering via `:ui` prop: body `items-center` + `px-2`, header `justify-center`, footer `items-center` + `px-2`
  - _Requirements: 4.2, 4.3, 4.4, 5.2, 5.3, 5.4_
