# Implementation Plan: Job Step Dashboard Redirect Fix

## Overview

Add an `ALWAYS_ENABLED_ROUTES` constant to `server/utils/pageToggles.ts` and update `isPageEnabled()` to check it before the standard `ROUTE_TOGGLE_MAP` prefix matching. This ensures `/parts/step/*` routes are always accessible regardless of the `parts` toggle. No changes to `pageGuard.global.ts` or Vue components.

## Tasks

- [x] 1. Add ALWAYS_ENABLED_ROUTES and update isPageEnabled()
  - [x] 1.1 Add the `ALWAYS_ENABLED_ROUTES` constant and update `isPageEnabled()` in `server/utils/pageToggles.ts`
    - Add `ALWAYS_ENABLED_ROUTES: readonly string[]` containing `'/parts/step'`
    - Insert a loop over `ALWAYS_ENABLED_ROUTES` after the dashboard/settings check and before the `ROUTE_TOGGLE_MAP` loop
    - Match logic: `routePath === prefix || routePath.startsWith(prefix + '/')`
    - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3_

  - [x] 1.2 Re-export `ALWAYS_ENABLED_ROUTES` from `app/utils/pageToggles.ts` for client-side auto-import
    - Ensure the client-side barrel re-exports the new constant alongside existing exports
    - _Requirements: 4.1_

  - [x] 1.3 Write property test: Step view routes are always enabled (Property 1)
    - **Property 1: Step view routes are always enabled**
    - For any step ID and any page toggle configuration, `isPageEnabled(toggles, '/parts/step/' + stepId)` returns `true`
    - **Validates: Requirements 1.1, 1.2, 1.3, 4.3**

  - [x] 1.4 Write property test: Non-step /parts routes respect the parts toggle (Property 2)
    - **Property 2: Non-step /parts routes respect the parts toggle**
    - For any toggle config and any `/parts` sub-route not matching ALWAYS_ENABLED_ROUTES, `isPageEnabled` equals `toggles.parts`
    - **Validates: Requirements 2.1, 2.2**

  - [x] 1.5 Write property test: All other toggle-mapped routes are unaffected (Property 3)
    - **Property 3: All other toggle-mapped routes are unaffected**
    - For any toggle config and any route in ROUTE_TOGGLE_MAP (excluding `/parts/step` sub-routes), `isPageEnabled` equals the corresponding toggle value
    - **Validates: Requirements 3.1, 3.2**

  - [x] 1.6 Write property test: Dashboard and Settings are always enabled (Property 4)
    - **Property 4: Dashboard and Settings are always enabled**
    - For any toggle config, `isPageEnabled(toggles, '/')` and `isPageEnabled(toggles, '/settings')` return `true`
    - **Validates: Requirements 5.1, 5.2**

- [x] 2. Checkpoint — Ensure all tests pass
  - Run `npm run test` and ensure all existing and new tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The fix is entirely within `server/utils/pageToggles.ts` — no middleware or component changes needed
- Existing property tests in `tests/properties/pageToggleMerge.property.test.ts` and `pageToggleRouteAccess.property.test.ts` cover related toggle behavior and should continue to pass
- Property tests use `fast-check` with minimum 100 iterations per the project convention
