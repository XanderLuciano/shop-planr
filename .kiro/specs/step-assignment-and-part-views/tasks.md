# Implementation Plan: Step Assignment and Part Views

## Overview

This feature adds four interconnected capabilities: (1) step assignment via a new `assigned_to` column on `process_steps` with migration 003, an `assignStep` method on `pathService`, and a `StepAssignmentDropdown` component; (2) a part detail page at `/serials/[id]` with Routing and Serials tabs; (3) clickable steps in `StepTracker` that navigate to the operator page with query params for auto-selection; (4) a serial number browser at `/serials` with search, filter, sort, and navigation. Implementation uses TypeScript throughout, following the existing layered architecture.

## Tasks

- [x] 1. Database migration and domain type updates
  - [x] 1.1 Create migration `server/repositories/sqlite/migrations/003_add_step_assignment.sql`
    - `ALTER TABLE process_steps ADD COLUMN assigned_to TEXT REFERENCES users(id)`
    - `CREATE INDEX IF NOT EXISTS idx_process_steps_assigned_to ON process_steps(assigned_to)`
    - _Requirements: 1.1, 1.2, 1.5_
  - [x] 1.2 Add `assignedTo?: string` to `ProcessStep` in `server/types/domain.ts`
    - _Requirements: 1.4_
  - [x] 1.3 Add `EnrichedSerial` interface to `server/types/computed.ts`
    - Fields: `id`, `jobId`, `jobName`, `pathId`, `pathName`, `currentStepIndex`, `currentStepName`, `assignedTo?`, `status: 'in-progress' | 'completed'`, `createdAt`
    - _Requirements: 7.3, 11.2_
  - [x] 1.4 Add `AssignStepInput` to `server/types/api.ts`
    - `{ userId: string | null }`
    - _Requirements: 2.1, 2.2_

- [x] 2. Repository and service layer for step assignment
  - [x] 2.1 Add `updateStepAssignment(stepId: string, userId: string | null): ProcessStep` and `getStepById(stepId: string): ProcessStep | null` to `PathRepository` interface in `server/repositories/interfaces/pathRepository.ts`
    - _Requirements: 2.1, 2.2_
  - [x] 2.2 Implement `updateStepAssignment` and `getStepById` in `server/repositories/sqlite/pathRepository.ts`
    - Update `assigned_to` column; return the full ProcessStep with `assignedTo` mapped
    - Ensure existing step row-to-object mapping includes `assigned_to` → `assignedTo`
    - _Requirements: 2.1, 2.2, 2.5_
  - [x] 2.3 Add `assignStep(stepId: string, userId: string | null): ProcessStep` to `pathService`
    - Validate step exists (NotFoundError if not)
    - If userId is not null, validate user exists and is active (ValidationError if not)
    - Call `repos.paths.updateStepAssignment(stepId, userId)`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 2.4 Write property test for step assignment round-trip (P1)
    - **Property 1: Step assignment round-trip**
    - For any ProcessStep and active ShopUser, assigning and reading back returns matching `assignedTo`; assigning null returns undefined
    - Create `tests/properties/stepAssignment.property.test.ts`
    - **Validates: Requirements 1.5, 2.1, 2.2, 2.5**
  - [x] 2.5 Write property test for invalid assignment rejection (P2)
    - **Property 2: Invalid assignment rejection**
    - For any non-existent or inactive user ID, `assignStep` throws ValidationError; step remains unchanged
    - Add to `tests/properties/stepAssignment.property.test.ts`
    - **Validates: Requirements 1.2, 1.3, 2.3**
  - [x] 2.6 Write property test for non-existent step error (P3)
    - **Property 3: Non-existent step assignment error**
    - For any non-existent step ID, `assignStep` throws NotFoundError
    - Add to `tests/properties/stepAssignment.property.test.ts`
    - **Validates: Requirements 2.4**

- [x] 3. Step assignment API route
  - [x] 3.1 Create `server/api/steps/[id]/assign.patch.ts`
    - Parse `{ userId }` from body
    - Call `getServices().pathService.assignStep(stepId, userId)`
    - Follow thin-handler pattern with ValidationError → 400, NotFoundError → 404
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4. Serial enrichment — repository and service
  - [x] 4.1 Add `listAll(): SerialNumber[]` to `SerialRepository` interface in `server/repositories/interfaces/serialRepository.ts`
    - _Requirements: 7.2_
  - [x] 4.2 Implement `listAll()` in `server/repositories/sqlite/serialRepository.ts`
    - _Requirements: 7.2_
  - [x] 4.3 Add `listAllSerialsEnriched(): EnrichedSerial[]` to `serialService`
    - Fetch all serials, join with job names, path names, step names, and step assignments
    - Derive `status` from `currentStepIndex` (-1 → completed, else in-progress)
    - Derive `currentStepName` from path steps (or "Completed" when -1)
    - _Requirements: 7.2, 7.3_
  - [x] 4.4 Write property test for serial status derivation (P5)
    - **Property 5: Serial status derivation**
    - For any SerialNumber, `currentStepIndex === -1` → status `'completed'`, else `'in-progress'`
    - Create `tests/properties/serialEnrichment.property.test.ts`
    - **Validates: Requirements 4.7, 5.4**
  - [x] 4.5 Write property test for enrichment completeness (P7)
    - **Property 7: Serial enrichment completeness**
    - For any SerialNumber with associated Job/Path/Steps, enriched object has non-empty `id`, `jobName`, `pathName`, `currentStepName`, valid `status`, non-empty `createdAt`
    - Add to `tests/properties/serialEnrichment.property.test.ts`
    - **Validates: Requirements 7.3, 11.2**

- [x] 5. Serial listing API route
  - [x] 5.1 Create `server/api/serials/index.get.ts`
    - Call `getServices().serialService.listAllSerialsEnriched()`
    - Return `EnrichedSerial[]`
    - _Requirements: 7.2, 7.3_

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Step assignment dropdown component
  - [x] 7.1 Create `app/components/StepAssignmentDropdown.vue`
    - Props: `stepId: string`, `currentAssignee?: string`, `users: ShopUser[]`
    - Emit `assigned(stepId, userId | null)`
    - Display searchable dropdown with "Unassigned" as first option, then active users
    - Type-ahead search filtering (case-insensitive partial match on user name); "Unassigned" always visible
    - On selection, call `PATCH /api/steps/:id/assign` with `{ userId }`
    - Optimistic UI: update display immediately, revert on API failure with error toast
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  - [x] 7.2 Write property test for dropdown filter logic (P4)
    - **Property 4: Dropdown option list with search filtering**
    - For any list of active users and search string, filtered options = "Unassigned" + users whose name contains search (case-insensitive); empty search returns all
    - Create `tests/properties/dropdownFilter.property.test.ts`
    - **Validates: Requirements 3.2, 3.3**

- [x] 8. Integrate step assignment into job detail page
  - [x] 8.1 Update `app/pages/jobs/[id].vue` to render `StepAssignmentDropdown` per step
    - Fetch active users via `GET /api/users?active=true`
    - Pass each step's `assignedTo` and the users list to the dropdown
    - Handle `assigned` event to refresh path data
    - _Requirements: 3.1, 3.4, 3.5, 3.6_

- [x] 9. Clickable step navigation
  - [x] 9.1 Update `app/components/StepTracker.vue` to emit `step-click` event
    - Add click handler on each step div
    - Emit `step-click` with `{ stepId, stepName, stepOrder }` payload
    - Add `cursor-pointer` styling and hover state
    - _Requirements: 6.1_
  - [x] 9.2 Update `app/pages/jobs/[id].vue` to handle `step-click` and navigate
    - On `step-click`, navigate to `/operator?jobId=X&pathId=Y&stepId=Z`
    - _Requirements: 6.1, 6.2_
  - [x] 9.3 Update `app/pages/operator.vue` to read query params and auto-select
    - On mount, read `jobId`, `pathId`, `stepId` from `route.query`
    - After fetching queue, find matching `WorkQueueJob` entry and auto-open `ProcessAdvancementPanel`
    - If no match found, show queue normally (graceful degradation)
    - _Requirements: 6.2, 6.3, 6.4_
  - [x] 9.4 Write property test for step navigation URL round-trip (P6)
    - **Property 6: Step navigation URL round-trip**
    - For any jobId, pathId, stepId: constructing URL with query params and parsing back yields original values; matching logic finds the correct queue entry
    - Create `tests/properties/stepNavigation.property.test.ts`
    - **Validates: Requirements 6.2, 6.3**

- [x] 10. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Part detail page — composable and routing tab
  - [x] 11.1 Create `app/composables/usePartDetail.ts`
    - Expose `serial`, `job`, `path`, `distribution`, `siblingSerials`, `loading`, `error` as readonly refs
    - Implement `fetchDetail()`: fetch serial, then job and path+distribution in parallel
    - Implement `fetchSiblings()`: fetch serials by path via `GET /api/serials?pathId=X` or existing `listSerialsByPath`
    - Implement `refreshAfterAdvance()`: re-fetch serial and distribution
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 4.7, 4.8, 4.9, 5.1, 5.3, 11.1_
  - [x] 11.2 Create `app/pages/serials/[id].vue` — Part detail page
    - Display serial identifier, job name, path name in header
    - Tab bar with "Routing" (default) and "Serials" tabs
    - Routing tab: step list with order, name, location, assigned user, distribution counts
    - Visually highlight the current step; show "Completed" state when `currentStepIndex === -1`
    - Show `ProcessAdvancementPanel` for in-progress serials (construct `WorkQueueJob`-shaped object)
    - Hide advancement panel for completed serials
    - On advance, call `refreshAfterAdvance()` to update the view
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5.1, 5.2, 5.3, 5.4_

- [x] 12. Part detail page — serials tab
  - [x] 12.1 Implement Serials tab in `app/pages/serials/[id].vue`
    - Lazy-load siblings on tab switch via `fetchSiblings()`
    - Table columns: identifier, current step name, status, created date
    - Highlight the row for the currently viewed serial
    - Click a row to navigate to that serial's detail page
    - Support sorting by identifier, step, status, created date
    - Summary row: total count, completed count, in-progress count
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  - [x] 12.2 Write property test for sibling serial filtering (P11)
    - **Property 11: Sibling serial filtering**
    - For any serial, siblings list contains exactly serials sharing the same jobId and pathId, including itself
    - Create `tests/properties/siblingSerials.property.test.ts`
    - **Validates: Requirements 11.1**
  - [x] 12.3 Write property test for serial summary counts (P12)
    - **Property 12: Serial summary counts**
    - `totalCount === list.length`, `completedCount === count where index === -1`, `inProgressCount === count where index >= 0`, `completedCount + inProgressCount === totalCount`
    - Add to `tests/properties/serialEnrichment.property.test.ts`
    - **Validates: Requirements 11.6**

- [x] 13. Serial number browser page
  - [x] 13.1 Create `app/composables/useSerialBrowser.ts`
    - Expose `serials`, `loading`, `error`, `searchQuery`, `filters`, `sortColumn`, `sortDirection`, `filteredSerials`, `totalCount`, `filteredCount`
    - Implement `fetchSerials()` calling `GET /api/serials`
    - Client-side search: case-insensitive partial match on serial `id`
    - Client-side filters: AND logic across jobName, pathName, stepName, status, assignee (including "Unassigned")
    - Client-side sort: ascending/descending by any column; toggle direction on same column click
    - _Requirements: 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4_
  - [x] 13.2 Create `app/pages/serials/index.vue` — Serial browser page
    - Search input with 300ms debounce
    - Filter controls for job, path, step, status, assignee
    - Sortable column headers with visual indicator
    - Display filtered vs total count when filters active
    - Click row to navigate to `/serials/[id]`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4_
  - [x] 13.3 Write property test for serial search filter (P8)
    - **Property 8: Serial search filter correctness**
    - For any search query and list of EnrichedSerials, filtered result contains exactly serials whose `id` contains query (case-insensitive); empty query returns all
    - Create `tests/properties/serialBrowser.property.test.ts`
    - **Validates: Requirements 8.2**
  - [x] 13.4 Write property test for multi-filter AND logic (P9)
    - **Property 9: Serial multi-filter AND logic**
    - For any combination of filters, result contains exactly serials matching ALL active criteria; "Unassigned" filter matches undefined/null `assignedTo`; all empty returns all
    - Add to `tests/properties/serialBrowser.property.test.ts`
    - **Validates: Requirements 9.2, 9.3**
  - [x] 13.5 Write property test for sort correctness (P10)
    - **Property 10: Serial sort correctness**
    - For any list and valid sort column, ascending order produces elements ≤ next; descending reverses; toggling same column reverses order
    - Add to `tests/properties/serialBrowser.property.test.ts`
    - **Validates: Requirements 10.1, 10.2, 10.3, 11.5**

- [x] 14. Add serials link to sidebar navigation
  - [x] 14.1 Update `app/app.vue` sidebar to include a "Serials" nav item linking to `/serials`
    - _Requirements: 7.1_

- [x] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use `fast-check` with minimum 100 iterations per project conventions
- The `ProcessAdvancementPanel` component is reused on the part detail page by constructing a `WorkQueueJob`-shaped object from the serial's context
- Client-side filtering/sorting for the serial browser is appropriate given the expected dataset size (hundreds to low thousands)
- Migration 003 uses `ALTER TABLE ADD COLUMN` which defaults existing rows to NULL (= Unassigned) — no data backfill needed
