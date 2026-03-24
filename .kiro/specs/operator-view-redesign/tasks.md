# Implementation Plan: Operator View Redesign

## Overview

Split the monolithic `operator.vue` into three properly-routed pages (Parts View, Step View, Operator Work Queue), add three new API endpoints, three new composables, new computed types, and update sidebar navigation. Delete `operator.vue` and `assignees.vue`. Tech stack: Vue 3 / TypeScript / Nuxt 4 / Nuxt UI 4.

## Tasks

- [x] 1. Add new computed types and create API endpoints
  - [x] 1.1 Add new computed types to `server/types/computed.ts`
    - Add `OperatorGroup` interface (`operatorId: string | null`, `operatorName: string`, `jobs: WorkQueueJob[]`, `totalParts: number`)
    - Add `WorkQueueGroupedResponse` interface (`groups: OperatorGroup[]`, `totalParts: number`)
    - Add `StepViewResponse` interface (`job: WorkQueueJob`, `notes: StepNote[]`)
    - _Requirements: 4.2, 4.6_

  - [x] 1.2 Create `GET /api/operator/queue/_all` endpoint
    - Create `server/api/operator/queue/_all.get.ts`
    - Reuse the same aggregation logic as `[userId].get.ts` but without operator filtering
    - Return `WorkQueueResponse` with `operatorId: "_all"`
    - Iterate all jobs → paths → steps → serials, build `WorkQueueJob` entries for steps with active serials
    - Follow thin-handler error pattern from `.ai/architecture.md`
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 1.3 Create `GET /api/operator/step/[stepId]` endpoint
    - Create `server/api/operator/step/[stepId].get.ts`
    - Parse `stepId` from route params, validate non-empty
    - Find the step across all jobs → paths, resolve parent path and job
    - Return 404 if step not found or has zero active serials
    - Return `StepViewResponse` with the `WorkQueueJob` data and step notes
    - Fetch notes via `noteService.getNotesForStep(jobId, pathId, stepId)`
    - _Requirements: 2.3, 2.6, 3.1, 3.5_

  - [x] 1.4 Create `GET /api/operator/work-queue` endpoint
    - Create `server/api/operator/work-queue.get.ts`
    - Iterate all jobs → paths → steps (same pattern as existing queue endpoint)
    - Group resulting `WorkQueueJob` entries by `step.assignedTo`
    - Resolve operator names from `userService.listUsers()` for assigned steps
    - Place steps with no `assignedTo` into group with `operatorId: null`, `operatorName: "Unassigned"`
    - Return `WorkQueueGroupedResponse`
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 2. Checkpoint — Ensure API endpoints work and all existing tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create composables for the three new pages
  - [x] 3.1 Create `app/composables/usePartsView.ts`
    - Fetch all active work via `GET /api/operator/queue/_all`
    - Expose: `jobs`, `loading`, `error`, `searchQuery`, `filteredJobs`, `totalParts`, `filteredParts`, `fetchAllWork`
    - `filteredJobs` computed: filter by `jobName`, `pathName`, or `stepName` using case-insensitive partial match
    - `totalParts` computed: sum of `partCount` across all jobs
    - `filteredParts` computed: sum of `partCount` across filtered jobs
    - _Requirements: 1.2, 1.4, 1.6, 1.7_

  - [x] 3.2 Create `app/composables/useStepView.ts`
    - Accept `stepId: string` parameter
    - Fetch step data via `GET /api/operator/step/{stepId}`
    - Expose: `job` (`WorkQueueJob | null`), `notes`, `loading`, `error`, `notFound`, `fetchStep`
    - Set `notFound = true` on 404 response
    - _Requirements: 2.3, 3.1, 3.5_

  - [x] 3.3 Create `app/composables/useOperatorWorkQueue.ts`
    - Fetch grouped work via `GET /api/operator/work-queue`
    - Expose: `response`, `groups`, `loading`, `error`, `searchQuery`, `filteredGroups`, `totalParts`, `fetchGroupedWork`
    - `filteredGroups` computed: filter entries within each group by `jobName`, `pathName`, `stepName`, or `operatorName` using case-insensitive partial match; exclude groups with zero matching entries
    - _Requirements: 4.2, 4.5, 4.6, 5.7_

- [x] 4. Create the Parts View page
  - [x] 4.1 Create `app/pages/parts/index.vue`
    - Use `usePartsView` composable to fetch and display all active work
    - Render `WorkQueueList` component for the job/step listing
    - Add search input that binds to `searchQuery` with debounce
    - Show total active parts count in summary bar
    - Show empty state when no active parts exist
    - On step row click (`select-job` event), call `navigateTo('/parts/step/{stepId}')` instead of opening inline panel
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 7.1, 7.2_

- [x] 5. Create the Step View page
  - [x] 5.1 Create `app/pages/parts/step/[stepId].vue`
    - Read `stepId` from route params via `useRoute()`
    - Use `useStepView(stepId)` composable to fetch step data
    - Render `SerialCreationPanel` if `job.stepOrder === 0`, otherwise render `ProcessAdvancementPanel`
    - Show breadcrumb/back link: "← Back to Parts" linking to `/parts`
    - Display job name, path name, step name, step location, destination info
    - Pass `notes` to `ProcessAdvancementPanel`
    - On successful advancement, call `fetchStep()` to refresh; if no parts remain, show empty state with link back to `/parts`
    - Show 404 error state when `notFound` is true, with link back to Parts View
    - Show loading spinner while fetching
    - Wire `handleAdvance` using existing `useWorkQueue().advanceBatch()` pattern from `operator.vue`
    - Wire `handleCreated` for serial creation at first step
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 7.3, 7.4_

- [x] 6. Create the Operator Work Queue page
  - [x] 6.1 Create `app/pages/queue.vue`
    - Use `useOperatorWorkQueue` composable to fetch grouped work
    - Use `useOperatorIdentity` composable for operator selector
    - Render operator sections: each section shows operator name, total parts badge, and list of step entries
    - "Unassigned" section for steps with no `assignedTo`
    - Operator identity selector dropdown (reuse pattern from `operator.vue`)
    - Sync selected operator to URL query param `?operator=userId` via `useRoute`/`useRouter`
    - On page load: read `operator` from URL query → fall back to localStorage via `useOperatorIdentity.init()`
    - When operator selected: highlight/prioritize their section (show first), update URL
    - When operator cleared: remove query param, show all work
    - Add search input filtering by job name, path name, step name, or operator name
    - On step entry click, call `navigateTo('/parts/step/{stepId}')`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 7. Checkpoint — Ensure all three pages render and navigate correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Update sidebar navigation and remove old pages
  - [x] 8.1 Update `app/layouts/default.vue` sidebar navigation
    - Replace `{ label: 'Operator', icon: 'i-lucide-wrench', to: '/operator' }` with `{ label: 'Parts', icon: 'i-lucide-wrench', to: '/parts' }`
    - Replace `{ label: 'Assignees', icon: 'i-lucide-users', to: '/assignees' }` with `{ label: 'Work Queue', icon: 'i-lucide-hard-hat', to: '/queue' }`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 8.2 Delete `app/pages/operator.vue`
    - Remove the old monolithic operator page
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 8.3 Delete `app/pages/assignees.vue`
    - Remove the assignees page (subsumed by Work Queue)
    - _Requirements: 6.1_

  - [x] 8.4 Update any external links pointing to `/operator` with query params
    - Search for references to `/operator?jobId=` or `to: '/operator'` in the codebase
    - Update job detail page links to point to `/parts/step/{stepId}` instead
    - _Requirements: 7.4_

- [x] 9. Checkpoint — Ensure navigation works, old pages removed, no broken links
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Write property-based tests
  - [x] 10.1 Write property test for all-work endpoint completeness
    - **Property 1: All-Work Endpoint Completeness**
    - **Validates: Requirements 1.2, 1.3**
    - Test file: `tests/properties/allWorkEndpoint.property.test.ts`
    - Generate random jobs with paths, steps, and serials; verify response contains a `WorkQueueJob` for every step with active serials, with correct metadata

  - [x] 10.2 Write property test for totalParts invariant
    - **Property 2: TotalParts Invariant**
    - **Validates: Requirements 1.4, 4.6**
    - Test file: `tests/properties/totalPartsInvariant.property.test.ts`
    - Generate random `WorkQueueResponse` and `WorkQueueGroupedResponse` objects; verify `totalParts` equals sum of `partCount` across all entries, and per-group totals are consistent

  - [x] 10.3 Write property test for search filter correctness
    - **Property 3: Search Filter Correctness**
    - **Validates: Requirements 1.6, 1.7, 5.7**
    - Test file: `tests/properties/workQueueSearch.property.test.ts`
    - Generate random `WorkQueueJob` arrays and search strings; verify filter returns exactly entries where `jobName`, `pathName`, or `stepName` contains the search string case-insensitively

  - [x] 10.4 Write property test for step endpoint correctness
    - **Property 4: Step Endpoint Correctness**
    - **Validates: Requirements 2.3, 3.1, 3.5**
    - Test file: `tests/properties/stepEndpoint.property.test.ts`
    - Generate random job/path/step/serial configurations; verify step endpoint returns correct `WorkQueueJob` with matching data

  - [x] 10.5 Write property test for invalid step rejection
    - **Property 5: Invalid Step Rejection**
    - **Validates: Requirements 2.6**
    - Test file: `tests/properties/invalidStepRejection.property.test.ts`
    - Generate random non-existent step IDs and steps with zero active serials; verify 404 response

  - [x] 10.6 Write property test for assignee grouping correctness
    - **Property 6: Assignee Grouping Correctness**
    - **Validates: Requirements 4.2, 4.3, 4.4**
    - Test file: `tests/properties/assigneeGrouping.property.test.ts`
    - Generate random steps with mixed `assignedTo` values and user records; verify grouping, name resolution, and unassigned handling

- [x] 11. Write unit tests
  - [x] 11.1 Write unit tests for API endpoints
    - Test file: `tests/unit/services/workQueue.test.ts`
    - Test all-work empty state (no active serials → empty jobs array)
    - Test step endpoint 404 for non-existent step ID
    - Test step endpoint 404 for step with zero active serials
    - Test grouped endpoint empty state (no work → empty groups)
    - Test unassigned group naming (`operatorId: null`, `operatorName: "Unassigned"`)
    - _Requirements: 1.5, 2.6, 4.4_

  - [x] 11.2 Write unit tests for search filter composable logic
    - Test file: `tests/unit/composables/workQueueSearch.test.ts`
    - Test empty search returns all entries
    - Test case-insensitive matching ("mill" matches "Milling")
    - _Requirements: 1.6, 1.7, 5.7_

- [x] 12. Write integration tests
  - [x] 12.1 Write integration tests for operator view redesign
    - Test file: `tests/integration/operatorViewRedesign.test.ts`
    - Test full parts view flow: create jobs → paths → serials → verify all-work endpoint returns correct groups
    - Test step view navigation: create job → path → serials → fetch step by ID → verify correct data
    - Test grouped work queue: create jobs with assigned/unassigned steps → verify grouping
    - Test step advancement from step view: fetch step → advance serials → re-fetch → verify updated counts
    - _Requirements: 1.2, 2.3, 3.3, 4.2, 4.3, 4.4_

- [x] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — no language selection needed
- Existing components (`WorkQueueList`, `ProcessAdvancementPanel`, `SerialCreationPanel`) are reused with minimal changes
- The `_all` literal route takes precedence over the `[userId]` dynamic route in Nuxt file-based routing
