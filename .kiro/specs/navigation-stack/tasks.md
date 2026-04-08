# Implementation Plan: Navigation Stack

## Overview

Replace the manual `from` query parameter system with an automatic, stack-based navigation history. Implementation proceeds bottom-up: pure utilities first (label registry, fallback resolver), then the composable, then the middleware, then page migrations, and finally cleanup of legacy code.

## Tasks

- [x] 1. Create label registry and fallback route utilities
  - [x] 1.1 Create `app/utils/navigationLabels.ts` with `NavigationLabel` interface, `NAVIGATION_LABELS` array, `resolveLabel()` function, and `routePattern()` function
    - Implement the ordered regex-based label registry mapping 13 route patterns to human-readable labels
    - `resolveLabel(path)` returns first matching label or `"Back"` for unknown routes
    - `routePattern(path)` returns the regex source for same-page-type detection
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.2 Write property test for label resolution completeness
    - **Property 5: Label Resolution Completeness**
    - **Validates: Requirements 3.1, 3.3**
    - Create `tests/properties/navLabelResolution.property.test.ts`
    - Use `fast-check` to verify `resolveLabel` always returns a non-empty string for arbitrary path strings

  - [x] 1.3 Write property test for route pattern consistency
    - **Property 11: Route Pattern Consistency**
    - **Validates: Requirements 8.2**
    - Create `tests/properties/navRoutePatternConsistency.property.test.ts`
    - Verify that paths differing only in dynamic segments produce the same `routePattern()` value

  - [x] 1.4 Create `app/utils/navigationFallbacks.ts` with `FallbackMapping` interface, `FALLBACK_ROUTES` array, and `resolveFallbackRoute()` function
    - Implement the 8 fallback mappings from Requirement 5.2
    - Returns `"/"` for unmatched paths
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 1.5 Write unit tests for label registry and fallback routes
    - Create `tests/unit/utils/navigationLabels.test.ts` — verify all 13 route-to-label mappings from Requirement 3.2
    - Create `tests/unit/utils/navigationFallbacks.test.ts` — verify all 8 fallback mappings from Requirement 5.2
    - _Requirements: 3.2, 5.2_

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement the `useNavigationStack` composable
  - [x] 3.1 Create `app/composables/useNavigationStack.ts`
    - Define `NavigationEntry` and `BackNavigation` interfaces
    - Use `useState<NavigationEntry[]>('nav-stack', () => [])` for reactive shared state
    - On client init (`import.meta.client`), hydrate from `sessionStorage` key `nav-stack`; reset to `[]` on parse failure
    - Implement `push(entry)`: validate entry, cap at 20 entries (shift oldest), persist to `sessionStorage`
    - Implement `pop()`: remove and return top entry, persist to `sessionStorage`
    - Implement `replaceTop(entry)`: replace top entry (or push if empty), persist to `sessionStorage`
    - Implement computed `backNavigation`: return top entry as `{ to, label: "Back to {label}" }`, or fallback route via `resolveFallbackRoute()` + `resolveLabel()` when stack is empty
    - Implement `goBack()`: pop top entry and `navigateTo()` the popped path; if stack empty, navigate to fallback
    - Skip invalid entries (path must be non-empty string starting with `/`) when loading from `sessionStorage`
    - Gracefully handle `sessionStorage` unavailability (in-memory only, no errors)
    - Expose read-only `entries` computed for debugging
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 4.1, 4.2, 4.3, 4.4, 5.1, 5.3, 9.1, 9.2, 9.3, 9.4_

  - [x] 3.2 Write property test for sessionStorage round-trip
    - **Property 1: sessionStorage Round-Trip**
    - **Validates: Requirements 1.1, 1.2, 1.3**
    - Create `tests/properties/navStackRoundTrip.property.test.ts`
    - Create shared arbitraries in `tests/properties/arbitraries/navigationStack.ts` (`arbRoutePath`, `arbNavigationEntry`, `arbInvalidEntry`, `arbNavigationSequence`)

  - [x] 3.3 Write property test for capacity invariant
    - **Property 2: Capacity Invariant with Oldest Eviction**
    - **Validates: Requirements 1.4, 1.5**
    - Create `tests/properties/navStackCapacity.property.test.ts`

  - [x] 3.4 Write property test for push/pop round-trip and LIFO unwinding
    - **Property 3: Push/Pop Round-Trip**
    - **Property 8: goBack Pops Correct Entry**
    - **Property 9: LIFO Unwinding for Navigation Chains**
    - **Validates: Requirements 2.2, 2.3, 4.4, 7.3**
    - Create `tests/properties/navStackPushPop.property.test.ts`

  - [x] 3.5 Write property test for back navigation with and without stack
    - **Property 6: Back Navigation from Non-Empty Stack**
    - **Property 7: Back Navigation Fallback from Empty Stack**
    - **Validates: Requirements 4.2, 4.3, 5.1, 5.3**
    - Create `tests/properties/navBackNavigation.property.test.ts`

  - [x] 3.6 Write property test for invalid entry filtering
    - **Property 12: Invalid Entry Filtering**
    - **Validates: Requirements 9.1, 9.2**
    - Create `tests/properties/navEntryValidation.property.test.ts`

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create the global navigation middleware
  - [x] 5.1 Create `app/middleware/stackTracker.global.ts`
    - Skip during SSR (`import.meta.server`)
    - Skip if `to.path === from.path` (query/hash-only change)
    - If destination matches stack top → `pop()` (back navigation detected)
    - If `routePattern(from.path) === routePattern(to.path)` → `replaceTop()` (same-page-type, e.g., Step → Step via Prev/Next)
    - Otherwise → `push()` departing route with label from `resolveLabel(from.path)`
    - Named `stackTracker` so it sorts alphabetically after `pageGuard` (runs after page guard)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 8.2, 8.3_

  - [x] 5.2 Write property test for query/hash-only navigation no-op
    - **Property 4: Query/Hash-Only Navigation Is a No-Op**
    - **Validates: Requirements 2.4**
    - Create `tests/properties/navStackQuerySkip.property.test.ts`

  - [x] 5.3 Write property test for same-page-type replace vs different-page-type push
    - **Property 10: Same-Page-Type Replace vs Different-Page-Type Push**
    - **Validates: Requirements 8.1, 8.3**
    - Create `tests/properties/navSamePageReplace.property.test.ts`

- [x] 6. Migrate pages to use `useNavigationStack`
  - [x] 6.1 Update `app/pages/parts/step/[stepId].vue` to use `useNavigationStack()`
    - Replace `resolveBackNavigation(fromQuery)` with `const { backNavigation } = useNavigationStack()`
    - Remove `fromQuery` variable and `route.query.from` reading
    - Update back link to use `backNavigation.to` and `backNavigation.label`
    - Update Prev/Next step buttons: remove `?from=` query parameter from `:to` bindings (middleware handles context automatically)
    - Update cancel handler to use `goBack()` instead of `navigateTo(backNav.value.to)`
    - _Requirements: 6.4, 6.5, 8.1_

  - [x] 6.2 Update `app/pages/parts-browser/[id].vue` to use `useNavigationStack()`
    - Replace the `fromQuery` / `backNav` computed with `const { backNavigation } = useNavigationStack()`
    - Remove `route.query.from` reading
    - Update back link to use `backNavigation.to` and `backNavigation.label`
    - Remove `?from=` from step click `navigateTo()` call (routing section step rows)
    - Remove `?from=` from sibling part navigation (`@click` on sibling table rows)
    - _Requirements: 6.4, 6.5_

  - [x] 6.3 Update `app/pages/queue.vue` — remove `?from=/queue` from `handleStepClick`
    - Change `navigateTo(\`/parts/step/${job.stepId}?from=/queue\`)` to `navigateTo(\`/parts/step/${job.stepId}\`)`
    - _Requirements: 6.5_

  - [x] 6.4 Update `app/pages/jobs/[id].vue` — remove `?from=` from step click navigation
    - Change `navigateTo(\`/parts/step/...?from=...\`)` to `navigateTo(\`/parts/step/${encodeURIComponent(payload.stepId)}\`)`
    - _Requirements: 6.5_

  - [x] 6.5 Update `app/components/ProcessAdvancementPanel.vue` — inline part detail URL and remove `partDetailLink` import
    - Replace `partDetailLink(partId, route.fullPath)` with `` `/parts-browser/${encodeURIComponent(partId)}` ``
    - Remove the `route` import/usage if no longer needed for other purposes
    - _Requirements: 6.3, 6.5_

- [x] 7. Delete legacy navigation utilities
  - [x] 7.1 Delete `app/utils/eyeIconLink.ts`
    - _Requirements: 6.3_

  - [x] 7.2 Delete `app/utils/resolveBackNavigation.ts`
    - _Requirements: 6.2_

  - [x] 7.3 Delete `tests/unit/utils/resolveBackNavigation.test.ts`
    - Remove the test file for the deleted utility
    - _Requirements: 6.2_

- [x] 8. Deep navigation chain validation
  - [x] 8.1 Write unit tests for deep navigation chain scenarios
    - Create `tests/unit/composables/useNavigationStack.test.ts`
    - Test Queue → Step View → Part Detail chain (Requirement 7.1)
    - Test Part Detail → Step View → Sibling Part chain (Requirement 7.2)
    - Test Jobs → Job Detail → Step View → Part Detail chain (Requirement 7.3)
    - Test sibling navigation preserves full chain (Requirement 7.4)
    - Test corrupted `sessionStorage` recovery (null, undefined, invalid JSON, invalid entries)
    - Test `sessionStorage` unavailable graceful degradation
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 1.6, 9.3_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The design uses TypeScript throughout — all implementations use TypeScript
- The middleware file is named `stackTracker.global.ts` to sort alphabetically after `pageGuard.global.ts`
- Step View Prev/Next replaces the top stack entry instead of pushing (same-page-type detection)
- `eyeIconLink.ts` is deleted entirely; the URL is inlined in `ProcessAdvancementPanel.vue`
- `resolveBackNavigation.ts` and its test file are both deleted
- Property tests use `fast-check` with shared arbitraries in `tests/properties/arbitraries/navigationStack.ts`
- All composables and utils are auto-imported by Nuxt — no explicit imports needed in components
