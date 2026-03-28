# Implementation Plan: Job Edit Functionality

## Overview

Fix the non-functional edit button on the Job detail page (`/jobs/:id`). The root cause is a Nuxt nested routing conflict — `app/pages/jobs/[id]/edit.vue` is a child of `app/pages/jobs/[id].vue`, but the parent has no `<NuxtPage />`, so the child never mounts. The fix moves the edit page to `app/pages/jobs/edit/[id].vue` (a sibling route) and updates all navigation references. No backend changes needed. Fixes **GitHub Issue #3**.

## Tasks

- [x] 1. Restructure edit page route
  - [x] 1.1 Create `app/pages/jobs/edit/[id].vue` with the same component code from `app/pages/jobs/[id]/edit.vue`
    - _Requirements: 1.1, 1.2, 1.4, 3.1, 3.2, 3.3, 3.4_
  - [x] 1.2 Delete `app/pages/jobs/[id]/edit.vue` and remove the empty `app/pages/jobs/[id]/` directory
    - _Requirements: 1.2, 1.3_
  - [x] 1.3 Update the "Back to Jobs" link in the edit page to point to `/jobs` (verify it's correct after move)
    - _Requirements: 5.2_

- [x] 2. Update navigation references
  - [x] 2.1 Update the Edit button `@click` handler in `app/pages/jobs/[id].vue` to navigate to `/jobs/edit/${encodeURIComponent(jobId)}`
    - _Requirements: 2.1, 2.2_
  - [x] 2.2 Search codebase for any other references to the old `/jobs/:id/edit` route pattern and update them
    - _Requirements: 2.1_

- [x] 3. Verify page toggle compatibility
  - [x] 3.1 Verify that `isPageEnabled()` correctly handles `/jobs/edit/:id` routes via the existing `/jobs` prefix in `ROUTE_TOGGLE_MAP` (no code changes expected — just verification)
    - _Requirements: 6.1, 6.2_

- [x] 4. Checkpoint — Ensure all existing tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Write property test — edit route inherits jobs toggle
  - [x] 5.1 Create `tests/properties/editRouteToggle.property.test.ts`
    - **Property 1: Edit route toggle inheritance**
    - Test that `∀ toggles ∈ PageToggles, id ∈ AlphanumericStrings: isPageEnabled(toggles, '/jobs/edit/' + id) === toggles.jobs` — the new `/jobs/edit/:id` route inherits the `jobs` toggle, matching the existing detail route behavior
    - Use the same `arbPageToggles` pattern from `pageToggleRouteAccess.property.test.ts`, 200 runs
    - **Validates: Requirements 6.1, 6.2**

- [x] 6. Write unit test — edit page navigation wiring
  - [x] 6.1 Create `tests/unit/components/JobEditNavigation.test.ts`
    - Test that the Edit button click handler produces the correct `/jobs/edit/:id` URL (not the old `/jobs/:id/edit` pattern)
    - Test that the edit page's `onSaved` callback navigates to `/jobs/:id` and `onCancel` navigates to `/jobs/:id`
    - **Validates: Requirements 2.1, 2.2, 4.1, 5.1**

- [ ] 7. Final checkpoint — Ensure all tests pass
  - Ensure all existing + new tests pass, verify no regressions in `jobFormEditRoundTrip`, `pageToggleRouteAccess`, or `pageToggleMerge` property tests.

## Notes

- This is a frontend-only change — no backend routes, services, or DB migrations needed
- The existing `JobCreationForm` component and `useJobForm` composable are reused unchanged
- The existing `PUT /api/jobs/:id` endpoint handles the save — no API changes
- All property tests use `fast-check` with minimum 100–200 iterations per the project's testing conventions
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
