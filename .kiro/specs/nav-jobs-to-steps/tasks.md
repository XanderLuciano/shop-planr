# Implementation Plan: Nav Jobs-to-Steps Back Arrow Bugfix

## Overview

Fix the back-arrow navigation on the Step View page so it returns to the Job detail page when the user navigated from there, instead of always going to `/parts`. The approach uses a `from` query parameter to pass referrer context, a pure helper function to resolve the back destination, and propagation of the `from` param across prev/next step navigation.

## Tasks

- [x] 1. Create the `resolveBackNavigation` helper and its tests
  - [x] 1.1 Create `app/utils/resolveBackNavigation.ts` with a pure function that accepts a `from` query value and returns `{ to: string, label: string }`
    - If `from` starts with `/jobs/`, return `{ to: from, label: 'Back to Job' }`
    - Otherwise (undefined, empty, invalid, external URLs, `javascript:` URIs), return `{ to: '/parts', label: 'Back to Parts' }`
    - _Requirements: 2.3, 3.3, 6.1, 6.2_

  - [x] 1.2 Write property test `tests/properties/backNavigation.property.test.ts`
    - **Property 1: Bug Condition — Back Arrow Returns to Job Detail Page**
    - For any valid job path (`/jobs/{id}`), `resolveBackNavigation` returns that path with label "Back to Job"
    - **Validates: Requirements 2.1, 2.2**

  - [x] 1.3 Write property test for default fallback in `tests/properties/backNavigation.property.test.ts`
    - **Property 2: Preservation — Default Back Navigation to Parts**
    - For any string that does NOT start with `/jobs/`, `resolveBackNavigation` returns `/parts` with label "Back to Parts"
    - **Validates: Requirements 3.1, 3.2, 3.3, 6.1, 6.2**

  - [x] 1.4 Write unit test `tests/unit/utils/resolveBackNavigation.test.ts`
    - Test specific examples: valid job path, undefined, empty string, external URL, `javascript:alert(1)`, `/settings`, `/parts`
    - _Requirements: 2.3, 3.3, 6.1, 6.2_

- [x] 2. Update Step View page to use context-aware back navigation
  - [x] 2.1 Update `app/pages/parts/step/[stepId].vue` to read the `from` query parameter and use `resolveBackNavigation` to compute the back-arrow destination and label
    - Replace the hardcoded `<NuxtLink to="/parts">` back arrow with the computed destination and label
    - Update `handleCancel` to navigate to the computed destination instead of hardcoded `/parts`
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 4.1_

  - [x] 2.2 Propagate the `from` query parameter on Prev/Next step navigation in `app/pages/parts/step/[stepId].vue`
    - Update the Prev and Next `<UButton>` `:to` bindings to append `?from=...` when the `from` query param is present
    - Also propagate `from` on the 404 "Back to Parts" button when a `from` param exists
    - _Requirements: 5.1, 5.2_

- [x] 3. Update Job detail page to pass referrer context
  - [x] 3.1 Update `onStepClick` in `app/pages/jobs/[id].vue` to append `?from=/jobs/:id` to the Step View URL
    - Use `encodeURIComponent` for the `from` value
    - _Requirements: 1.1, 1.2_

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- `resolveBackNavigation` is placed in `app/utils/` so it is auto-imported by Nuxt (no explicit import needed in Vue files)
- Property tests use `fast-check` with 100+ iterations per property, following existing project patterns
- Each task references specific requirements for traceability
