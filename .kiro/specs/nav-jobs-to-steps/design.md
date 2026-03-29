# Nav Jobs-to-Steps Back Arrow Bugfix Design

## Overview

When a user navigates from a Job detail page (`/jobs/:id`) to a Step View page (`/parts/step/:stepId`), the back arrow on the Step View page always directs them to `/parts` (the Parts list) instead of back to the Job detail page they came from. The fix will make the back navigation context-aware by passing the referrer route as a query parameter, so the Step View page can return the user to their actual origin.

## Glossary

- **Bug_Condition (C)**: The user arrived at the Step View page from the Job detail page (not from the Parts list), and the back arrow incorrectly navigates to `/parts`
- **Property (P)**: The back arrow should navigate to the page the user came from — `/jobs/:id` when arriving from Job detail, `/parts` when arriving from Parts list
- **Preservation**: Navigation from the Parts list to Step View must continue to show "Back to Parts" linking to `/parts`. All other Step View functionality (advancement, serial creation, operator selection, prev/next step navigation) must remain unchanged.
- **Step View page**: `app/pages/parts/step/[stepId].vue` — the page that displays a single process step with advancement or serial creation UI
- **Job detail page**: `app/pages/jobs/[id].vue` — the tabbed job view with routing, serial numbers, and step navigation via StepTracker
- **Parts View page**: `app/pages/parts/index.vue` — the list of all active parts grouped by job/step
- **`onStepClick`**: The function in `app/pages/jobs/[id].vue` that calls `navigateTo('/parts/step/${stepId}')` when a step is clicked in the StepTracker

## Bug Details

### Bug Condition

The bug manifests when a user clicks a step in the Job detail page's StepTracker component, which navigates them to `/parts/step/:stepId`. The Step View page has a hardcoded `<NuxtLink to="/parts">` back arrow that always points to the Parts list, regardless of where the user navigated from.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { currentRoute: Route, previousRoute: Route | null }
  OUTPUT: boolean
  
  RETURN input.currentRoute.path MATCHES '/parts/step/:stepId'
         AND input.previousRoute IS NOT NULL
         AND input.previousRoute.path MATCHES '/jobs/:id'
         AND backArrowDestination(input.currentRoute) == '/parts'
END FUNCTION
```

### Examples

- User is on `/jobs/JOB-abc123`, clicks step "Milling" in StepTracker → navigates to `/parts/step/STEP-xyz`. Back arrow goes to `/parts` instead of `/jobs/JOB-abc123`. **Expected**: Back arrow goes to `/jobs/JOB-abc123`.
- User is on `/jobs/JOB-def456`, clicks step "Inspection" → navigates to `/parts/step/STEP-uvw`. Back arrow goes to `/parts` instead of `/jobs/JOB-def456`. **Expected**: Back arrow goes to `/jobs/JOB-def456`.
- User is on `/parts` (Parts list), clicks a job group → navigates to `/parts/step/STEP-xyz`. Back arrow goes to `/parts`. **Expected**: Back arrow goes to `/parts` (this case already works correctly).
- User navigates directly to `/parts/step/STEP-xyz` via URL. Back arrow goes to `/parts`. **Expected**: Back arrow goes to `/parts` (sensible default when no referrer context).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Navigation from Parts list (`/parts`) to Step View must continue to show "Back to Parts" linking to `/parts`
- Direct URL access to Step View must default to "Back to Parts" linking to `/parts`
- All Step View functionality: advancement panel, serial creation panel, operator selection, prev/next step navigation, notes display
- All Job detail page functionality: StepTracker clicks, tab switching, path editing, Jira push
- Parts list page: search, job selection, navigation to Step View
- The `handleCancel` function in Step View that navigates to `/parts`

**Scope:**
All inputs that do NOT involve the back arrow navigation on the Step View page should be completely unaffected by this fix. This includes:
- Step advancement and serial creation workflows
- Operator identity selection
- Prev/Next step navigation within Step View
- All Job detail page interactions
- All Parts list page interactions

## Hypothesized Root Cause

Based on the bug description, the root cause is straightforward:

1. **Hardcoded back link in Step View**: The `<NuxtLink to="/parts">` in `app/pages/parts/step/[stepId].vue` is hardcoded to always point to `/parts`. There is no mechanism to detect or remember where the user navigated from.

2. **No referrer context passed during navigation**: The `onStepClick` function in `app/pages/jobs/[id].vue` calls `navigateTo('/parts/step/${stepId}')` without passing any query parameter or state indicating the origin page.

3. **`handleCancel` also hardcoded**: The `handleCancel` function in Step View calls `navigateTo('/parts')`, which should also respect the referrer context.

## Correctness Properties

Property 1: Bug Condition - Back Arrow Returns to Job Detail Page

_For any_ navigation from a Job detail page (`/jobs/:id`) to a Step View page (`/parts/step/:stepId`), the back arrow on the Step View page SHALL navigate the user back to the Job detail page (`/jobs/:id`) they came from, and the back label SHALL read "Back to Job".

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Default Back Navigation to Parts

_For any_ navigation to the Step View page that did NOT originate from a Job detail page (e.g., from Parts list, direct URL, or any other source), the back arrow SHALL continue to navigate to `/parts` with the label "Back to Parts", preserving the existing default behavior.

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `app/pages/jobs/[id].vue`

**Function**: `onStepClick`

**Specific Changes**:
1. **Pass referrer query parameter**: Modify `onStepClick` to include a `from` query parameter with the current job route:
   ```
   navigateTo(`/parts/step/${stepId}?from=${encodeURIComponent(`/jobs/${jobId}`)}`)
   ```

**File**: `app/pages/parts/step/[stepId].vue`

**Specific Changes**:
2. **Read referrer from query**: Extract the `from` query parameter from the route to determine the back navigation target.

3. **Compute back link destination**: Create a computed property that returns the `from` query value if present and valid (starts with `/jobs/`), otherwise defaults to `/parts`.

4. **Compute back link label**: Create a computed property that returns "Back to Job" when the referrer is a job page, or "Back to Parts" otherwise.

5. **Update back arrow NuxtLink**: Replace the hardcoded `to="/parts"` with the computed back destination.

6. **Update handleCancel**: Make `handleCancel` navigate to the computed back destination instead of hardcoded `/parts`.

7. **Propagate `from` on prev/next step navigation**: When the user clicks Prev/Next step buttons, the `from` query parameter should be preserved so the back arrow context is maintained across step-to-step navigation within the same session.

## Testing Strategy

Testing follows the project's existing patterns: Vitest + `fast-check` for property-based tests, pure function unit tests, no component rendering.

### Unit Tests (`tests/unit/composables/`)

Extract the back-navigation logic into a pure helper (e.g., `resolveBackNavigation(fromQuery)`) and test it directly:

- Valid job origin: `resolveBackNavigation('/jobs/JOB-123')` → `{ to: '/jobs/JOB-123', label: 'Back to Job' }`
- No `from` param: `resolveBackNavigation(undefined)` → `{ to: '/parts', label: 'Back to Parts' }`
- Invalid `from` values (e.g., `/settings`, `javascript:alert(1)`, empty string) → fallback to `/parts`
- `onStepClick` builds URL with `?from=` query parameter

### Property-Based Tests (`tests/properties/`)

One property file: `backNavigation.property.test.ts`

**Property 1 — Fix**: For any valid job path (`/jobs/{id}`), `resolveBackNavigation` returns that path with label "Back to Job".

**Property 2 — Preservation**: For any string that does NOT start with `/jobs/`, `resolveBackNavigation` returns `/parts` with label "Back to Parts".

Uses `fast-check` with `fc.string()` / `fc.uuid()` arbitraries, 100+ iterations per property.
