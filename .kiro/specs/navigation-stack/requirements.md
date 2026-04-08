# Requirements Document

## Introduction

Shop Planr currently relies on a manual `from` query parameter for back-button navigation between pages. Every `navigateTo()` call must explicitly pass `?from=...`, and every destination page must read `route.query.from` and compute a back link. This approach is fragile: if any link forgets the parameter, the back button silently falls back to a generic default (usually `/parts`), losing the user's navigation context. Deep navigation chains (e.g., Queue → Step → Part Detail → Sibling Part) compound the problem because only the immediate referrer is tracked — the full chain is lost.

This feature replaces the manual `from` query parameter system with a `useNavigationStack()` composable backed by `sessionStorage`. A global route middleware automatically maintains a small navigation stack as the user moves between pages. Each page type registers a human-readable label. The back button reads from the stack, always producing the correct destination without any manual wiring. When the stack is empty or corrupted, deterministic fallback logic derives a sensible parent route from the current URL pattern.

## Glossary

- **Navigation_Stack**: A bounded, ordered list of navigation entries stored in `sessionStorage`, representing the user's recent page-visit history within the current browser tab.
- **Navigation_Entry**: A single record in the Navigation_Stack containing a route path and a human-readable label.
- **Navigation_Middleware**: A global Nuxt route middleware that intercepts every client-side navigation event and updates the Navigation_Stack by pushing or popping entries.
- **Navigation_Composable**: The `useNavigationStack()` Vue composable that exposes the current back destination, label, and stack state to page components.
- **Fallback_Route**: A deterministic parent route derived from the current URL pattern, used when the Navigation_Stack is empty or contains no valid prior entry.
- **Label_Registry**: A mapping from route path patterns to human-readable page labels (e.g., `/parts-browser/:id` → "Part {id}", `/queue` → "Work Queue").
- **Stack_Capacity**: The maximum number of Navigation_Entry records the Navigation_Stack retains (oldest entries are evicted when the limit is exceeded).
- **Back_Button**: The back-arrow UI element on detail/sub-pages that navigates the user to the previous page in context.

## Requirements

### Requirement 1: Navigation Stack Storage

**User Story:** As a user, I want my navigation history to persist within my browser tab session, so that refreshing the page or navigating via the address bar does not lose my back-button context.

#### Acceptance Criteria

1. THE Navigation_Composable SHALL store the Navigation_Stack in `sessionStorage` under a consistent key.
2. WHEN the Navigation_Composable initializes, THE Navigation_Composable SHALL load the existing Navigation_Stack from `sessionStorage`.
3. WHEN the Navigation_Stack is modified, THE Navigation_Composable SHALL persist the updated Navigation_Stack to `sessionStorage`.
4. THE Navigation_Stack SHALL retain a maximum of Stack_Capacity entries, where Stack_Capacity is 20.
5. WHEN a new Navigation_Entry would exceed Stack_Capacity, THE Navigation_Composable SHALL remove the oldest entry before adding the new one.
6. IF `sessionStorage` contains invalid or unparseable data for the Navigation_Stack key, THEN THE Navigation_Composable SHALL reset the Navigation_Stack to an empty list and continue operation.

### Requirement 2: Automatic Stack Management via Middleware

**User Story:** As a developer, I want navigation history to be tracked automatically on every page transition, so that I never need to manually pass context parameters between pages.

#### Acceptance Criteria

1. THE Navigation_Middleware SHALL execute on every client-side route navigation.
2. WHEN the user navigates to a new route, THE Navigation_Middleware SHALL push a Navigation_Entry for the departing route onto the Navigation_Stack.
3. WHEN the user navigates back (the destination matches the top entry on the Navigation_Stack), THE Navigation_Middleware SHALL pop the top entry instead of pushing.
4. THE Navigation_Middleware SHALL skip stack updates for navigations that only change the query string or hash of the current route path.
5. THE Navigation_Middleware SHALL skip stack updates during server-side rendering (SSR).

### Requirement 3: Page Label Resolution

**User Story:** As a user, I want the back button to show a meaningful label like "Back to Work Queue" or "Back to Part SN-00004", so that I know where I will go before clicking.

#### Acceptance Criteria

1. THE Label_Registry SHALL map each known route pattern to a human-readable label template.
2. THE Label_Registry SHALL support the following route-to-label mappings:
   - `/` → "Dashboard"
   - `/jobs` → "Jobs"
   - `/jobs/:id` → "Job {name}" (where name is derived from the route path)
   - `/parts-browser` → "Parts Browser"
   - `/parts-browser/:id` → "Part {id}"
   - `/parts` → "Parts"
   - `/parts/step/:stepId` → "Step View"
   - `/queue` → "Work Queue"
   - `/templates` → "Templates"
   - `/bom` → "BOM"
   - `/certs` → "Certs"
   - `/audit` → "Audit"
   - `/settings` → "Settings"
3. WHEN a route path does not match any known pattern in the Label_Registry, THE Label_Registry SHALL return a generic label "Back".
4. THE Navigation_Entry label SHALL be resolved at the time the entry is pushed onto the Navigation_Stack.

### Requirement 4: Back Navigation Resolution

**User Story:** As a user, I want the back button to always take me to the correct previous page regardless of how I arrived at the current page, so that I never get lost in the app.

#### Acceptance Criteria

1. THE Navigation_Composable SHALL expose a computed `backNavigation` property containing a destination path and a display label.
2. WHEN the Navigation_Stack contains one or more entries, THE Navigation_Composable SHALL return the top entry's path and a label formatted as "Back to {entry label}".
3. WHEN the Navigation_Stack is empty, THE Navigation_Composable SHALL return the Fallback_Route for the current route path.
4. THE Navigation_Composable SHALL expose a `goBack()` function that pops the top entry from the Navigation_Stack and navigates to the popped entry's path.

### Requirement 5: Fallback Route Resolution

**User Story:** As a user, I want the back button to navigate to a sensible parent page even when I arrive at a page via a direct URL or bookmark, so that I always have a way to navigate up.

#### Acceptance Criteria

1. THE Navigation_Composable SHALL compute a Fallback_Route based on the current route path when the Navigation_Stack is empty.
2. THE Fallback_Route mapping SHALL follow this hierarchy:
   - `/parts-browser/:id` → `/parts-browser`
   - `/parts/step/:stepId` → `/parts`
   - `/jobs/:id` → `/jobs`
   - `/jobs/new` → `/jobs`
   - `/jobs/edit/:id` → `/jobs`
   - `/serials/:id` → `/parts-browser`
   - `/queue` → `/`
   - `/api-docs/**` → `/api-docs`
   - Any other route → `/`
3. THE Fallback_Route label SHALL use the Label_Registry to produce a human-readable label for the fallback destination.
4. IF the current route path does not match any specific fallback pattern, THEN THE Navigation_Composable SHALL fall back to `/` with the label "Dashboard".

### Requirement 6: Removal of Manual `from` Query Parameter

**User Story:** As a developer, I want to remove all manual `from` query parameter wiring from navigation links and back-button logic, so that the codebase is simpler and navigation context is never accidentally lost.

#### Acceptance Criteria

1. WHEN the Navigation_Stack feature is active, THE application SHALL remove `?from=` query parameters from all `navigateTo()` calls that currently pass navigation context.
2. THE application SHALL remove the `resolveBackNavigation` utility function from `app/utils/resolveBackNavigation.ts`.
3. THE application SHALL delete the `app/utils/eyeIconLink.ts` file and inline the part detail URL directly in `ProcessAdvancementPanel.vue` as `` `/parts-browser/${encodeURIComponent(partId)}` ``.
4. THE application SHALL update the following pages to use the Navigation_Composable instead of reading `route.query.from`:
   - `app/pages/parts/step/[stepId].vue`
   - `app/pages/parts-browser/[id].vue`
5. THE application SHALL update the following pages to stop passing `?from=` in their `navigateTo()` calls:
   - `app/pages/jobs/[id].vue`
   - `app/pages/queue.vue`
   - `app/pages/parts-browser/[id].vue` (step click and sibling navigation)
   - `app/components/ProcessAdvancementPanel.vue` (eye icon link)

### Requirement 7: Deep Navigation Chain Correctness

**User Story:** As a user, I want the back button to correctly unwind through multi-page navigation chains, so that pressing back repeatedly returns me through each page I visited in reverse order.

#### Acceptance Criteria

1. WHEN a user navigates Queue → Step View → Part Detail, THE Back_Button on Part Detail SHALL navigate to Step View, and THE Back_Button on Step View SHALL navigate to Queue.
2. WHEN a user navigates Part Detail → Step View → Part Detail (sibling), THE Back_Button on the sibling Part Detail SHALL navigate to Step View, and THE Back_Button on Step View SHALL navigate to the original Part Detail.
3. WHEN a user navigates Jobs → Job Detail → Step View → Part Detail, THE Back_Button SHALL unwind through each page in reverse order: Part Detail → Step View → Job Detail → Jobs.
4. WHEN a user navigates to a sibling part from a Part Detail page, THE Navigation_Stack SHALL preserve the full chain so that pressing back from the sibling returns to the original Part Detail page.

### Requirement 8: Same-Page Navigation Handling

**User Story:** As a user, I want navigating between steps (Prev/Next) on the Step View page to not pollute my back-button history with every intermediate step, so that pressing back returns me to the page before I entered the Step View.

#### Acceptance Criteria

1. WHEN the user navigates from one Step View page to another Step View page (via Prev/Next buttons), THE Navigation_Middleware SHALL replace the current Step View entry on the Navigation_Stack instead of pushing a new entry.
2. THE Navigation_Middleware SHALL detect same-page-type navigation by comparing the route pattern (e.g., `/parts/step/:stepId`) of the departing and arriving routes.
3. WHEN the user navigates from Step View to a different page type (e.g., Part Detail), THE Navigation_Middleware SHALL push the Step View entry normally.

### Requirement 9: Stack Integrity

**User Story:** As a developer, I want the navigation stack to be resilient to corruption and edge cases, so that the back button never breaks or navigates to an invalid destination.

#### Acceptance Criteria

1. IF the Navigation_Stack contains entries with paths that no longer match valid application routes, THEN THE Navigation_Composable SHALL skip invalid entries and return the next valid entry or the Fallback_Route.
2. THE Navigation_Composable SHALL validate that each Navigation_Entry contains a non-empty string path starting with `/`.
3. IF `sessionStorage` is unavailable (e.g., private browsing restrictions), THEN THE Navigation_Composable SHALL operate with an in-memory-only Navigation_Stack without errors.
4. THE Navigation_Stack SHALL be scoped to the browser tab via `sessionStorage` (each tab maintains an independent stack).
