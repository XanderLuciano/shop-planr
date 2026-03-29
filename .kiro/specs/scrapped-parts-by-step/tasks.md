# Implementation Plan: Scrapped Parts by Step

## Overview

Add visibility into scrapped serial numbers at step-level (within a path) and job-level (across all paths). Extends `listByStepIndex` with an optional status filter, adds two new API endpoints, a shared composable, and frontend UI in both the operator view and job detail page. All code is TypeScript/Vue 3 (Nuxt 4). Ordered: types → repository → service → API routes → tests → frontend.

## Tasks

- [ ] 1. Add computed types for scrapped parts
  - [ ] 1.1 Add `ScrappedSerialInfo`, `ScrappedSerialGroup`, `PathScrappedGroup`, and `JobScrappedResponse` to `server/types/computed.ts`
    - `ScrappedSerialInfo`: serialId, scrapReason?, scrapExplanation?, scrappedAt?, scrappedBy?
    - `ScrappedSerialGroup`: stepId, stepName, stepOrder, serials: ScrappedSerialInfo[]
    - `PathScrappedGroup`: pathId, pathName, steps: ScrappedSerialGroup[]
    - `JobScrappedResponse`: jobId, paths: PathScrappedGroup[], totalScrapped: number
    - _Requirements: 4.2, 7.2, 7.3_

- [ ] 2. Extend repository with status filter
  - [ ] 2.1 Update `SerialRepository` interface in `server/repositories/interfaces/serialRepository.ts`
    - Add optional third parameter `status?: 'in_progress' | 'scrapped' | 'all'` to `listByStepIndex`
    - _Requirements: 1.1, 6.1_

  - [ ] 2.2 Update `SQLiteSerialRepository.listByStepIndex` in `server/repositories/sqlite/serialRepository.ts`
    - No status / `'in_progress'`: current query — `WHERE path_id = ? AND current_step_index = ? AND status != 'scrapped'`
    - `'scrapped'`: `WHERE path_id = ? AND status = 'scrapped' AND scrap_step_id = (SELECT id FROM process_steps WHERE path_id = ? AND step_order = ?)`
    - `'all'`: `WHERE path_id = ? AND current_step_index = ?` (no status filter)
    - All branches order by `created_at ASC`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 3. Extend service layer
  - [ ] 3.1 Update `listSerialsByStepIndex` in `server/services/serialService.ts`
    - Add optional `status?: 'in_progress' | 'scrapped' | 'all'` parameter, pass through to repository
    - Validate status value — throw `ValidationError` for invalid strings
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.2 Add `getScrappedByPath(pathId)` to `serialService`
    - Fetch path via `repos.paths.getById` (throw NotFoundError if missing)
    - Iterate each step, call `listByStepIndex(pathId, step.order, 'scrapped')`
    - Build `ScrappedSerialGroup[]`, omitting steps with zero scrapped serials
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 3.3 Add `getScrappedByJob(jobId)` to `serialService`
    - Fetch all serials via `repos.serials.listByJobId(jobId)`, filter to `status === 'scrapped'`
    - Fetch paths via `repos.paths.listByJobId(jobId)` for step metadata
    - Group by pathId then scrapStepId, resolve step name/order from path steps
    - Return `JobScrappedResponse` with totalScrapped count
    - Omit serials whose scrapStepId doesn't match any step (data integrity edge case)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ] 4. Add API routes
  - [ ] 4.1 Create `server/api/paths/[id]/scrapped.get.ts`
    - Thin handler: parse `event.context.params.id`, call `serialService.getScrappedByPath(id)`, return result
    - Standard error handling (ValidationError → 400, NotFoundError → 404)
    - _Requirements: 4.1, 4.3, 4.4_

  - [ ] 4.2 Create `server/api/jobs/[id]/scrapped.get.ts`
    - Thin handler: parse `event.context.params.id`, call `serialService.getScrappedByJob(id)`, return result
    - Standard error handling (ValidationError → 400, NotFoundError → 404)
    - _Requirements: 7.1, 7.4, 7.5_

- [ ] 5. Checkpoint — Ensure backend compiles and existing tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Property-based tests
  - [ ]\* 6.1 Write property test: Status Filter Correctness
    - **Property 1: Status Filter Correctness**
    - **Validates: Requirements 1.2, 1.3, 1.5, 6.1, 6.3**
    - Test file: `tests/properties/statusFilterCorrectness.property.test.ts`
    - Generate random serial sets with mixed statuses at various steps; verify each filter returns correct subset

  - [ ]\* 6.2 Write property test: ScrapStepId-Based Grouping
    - **Property 2: ScrapStepId-Based Grouping**
    - **Validates: Requirements 1.4, 4.5, 7.7**
    - Test file: `tests/properties/scrapStepGrouping.property.test.ts`
    - Generate paths with multiple steps, serials scrapped at different steps; verify grouping by scrapStepId

  - [ ]\* 6.3 Write property test: Result Ordering
    - **Property 3: Result Ordering**
    - **Validates: Requirements 1.6**
    - Test file: `tests/properties/statusFilterOrdering.property.test.ts`
    - Generate serial sets with varying createdAt timestamps; verify ASC ordering for all filter values

  - [ ]\* 6.4 Write property test: Operator Queue Preservation
    - **Property 4: Operator Queue Preservation**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Test file: `tests/properties/operatorQueuePreservation.property.test.ts`
    - Generate job/path/serial configs with scrapped serials; verify queue excludes them

  - [ ]\* 6.5 Write property test: Invalid Status Rejection
    - **Property 5: Invalid Status Rejection**
    - **Validates: Requirements 2.4**
    - Test file: `tests/properties/invalidStatusRejection.property.test.ts`
    - Generate random strings that aren't valid status values; verify ValidationError

  - [ ]\* 6.6 Write property test: listByPathId/listByJobId Preservation
    - **Property 6: listByPathId/listByJobId Preservation**
    - **Validates: Requirements 6.4**
    - Test file: `tests/properties/listByPreservation.property.test.ts`
    - Generate serial sets including scrapped; verify these methods return all serials

  - [ ]\* 6.7 Write property test: Scrapped Group Metadata Completeness
    - **Property 7: Scrapped Group Metadata Completeness**
    - **Validates: Requirements 4.2, 7.2, 7.3**
    - Test file: `tests/properties/scrappedGroupMetadata.property.test.ts`
    - Generate paths with scrapped serials; verify response metadata matches path steps and serial scrap fields

- [ ] 7. Integration tests
  - [ ]\* 7.1 Write integration tests in `tests/integration/scrappedParts.test.ts`
    - Full scrapped-by-path flow: create job → path → serials → scrap some → verify grouped response
    - Full scrapped-by-job flow: create job → multiple paths → scrap across paths → verify job-level grouping
    - Operator queue unchanged: scrap serials → verify operator queue still excludes them
    - API 404 for missing path and missing job
    - Backward compatibility: existing 2-arg calls to `listSerialsByStepIndex` still work
    - _Requirements: 3.1, 3.2, 4.1, 4.3, 4.4, 6.1, 6.2, 6.3, 7.1, 7.4, 7.5_

- [ ] 8. Checkpoint — Ensure all backend and test code passes
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Create frontend composable
  - [ ] 9.1 Create `app/composables/useScrappedParts.ts`
    - `fetchScrappedByPath(pathId: string)` → calls `GET /api/paths/:id/scrapped`, returns `ScrappedSerialGroup[]`
    - `fetchScrappedByJob(jobId: string)` → calls `GET /api/jobs/:id/scrapped`, returns `JobScrappedResponse`
    - Expose `loading` and `error` refs
    - _Requirements: 5.1, 5.5, 5.6, 8.1, 8.6, 8.7_

- [ ] 10. Add scrapped parts toggle to operator view
  - [ ] 10.1 Update `app/pages/operator.vue`
    - Add a toggle/tab to switch between the active work queue and a scrapped-parts view
    - When scrapped view is active, use `useScrappedParts` to fetch scrapped data for the operator's assigned paths
    - Display scrapped serials grouped by step: step name header, serial ID, scrap reason, scrap explanation
    - Omit steps with no scrapped serials
    - Show loading indicator while fetching, error message with retry on failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 11. Add scrapped parts tab to job detail page
  - [ ] 11.1 Update `app/pages/jobs/[id].vue`
    - Add a "Scrapped Parts" tab alongside existing "Job Routing" and "Serial Numbers" tabs
    - When activated, use `useScrappedParts.fetchScrappedByJob(jobId)` to fetch data
    - Display scrapped serials grouped by path then by step: path name header, step name sub-header, serial details (ID, reason, explanation, timestamp, user)
    - Show empty-state message when no scrapped serials exist
    - Show loading indicator while fetching, error message with retry on failure
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- No database migrations needed — existing schema already has all required columns
- The design uses TypeScript throughout, so no language selection was needed
- Backend changes (tasks 1–5) are independent of frontend and should be completed first
- The `useScrappedParts` composable (task 9) is a thin API client per architecture rules
