# Implementation Plan: Bulk API Endpoints

## Overview

Introduce five new bulk API endpoints with Zod validation to replace N+1 HTTP call patterns in the frontend. Update all frontend callers to use the new endpoints. Each task group handles one endpoint end-to-end (schema → service changes → route → frontend swap → tests).

## Tasks

- [ ] 1. Bulk Path Distributions Endpoint (read-only, lowest risk — start here)
  - [ ] 1.1 Add `batchDistributionsSchema` to `server/schemas/pathSchemas.ts`
    - Add Zod schema: `pathIds` string array, min 1, max 100
    - Export as `batchDistributionsSchema`
    - _Requirements: 5.2_

  - [ ] 1.2 Create `POST /api/paths/distributions.post.ts` route
    - Validate body with `parseBody(event, batchDistributionsSchema)`
    - Loop over `pathIds`, call `pathService.getStepDistribution()` and `pathService.getPathCompletedCount()` per path
    - Omit missing paths (try/catch per path)
    - Return `Record<string, { distribution, completedCount }>`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 1.3 Update `JobExpandableRow.vue` to use bulk distributions endpoint
    - Replace the batched `Promise.allSettled` loop (CONCURRENCY=3) with a single `POST /api/paths/distributions` call
    - Populate `pathDistributions` and `pathCompletedCounts` from the bulk response
    - Remove the `loadingPathIds` per-path tracking (all load at once now)
    - _Requirements: 10.1, 10.3_

  - [ ] 1.4 Update `jobs/[id].vue` `loadAllDistributions()` to use bulk distributions endpoint
    - Replace `Promise.allSettled` with individual `fetchPathDetail` calls with a single `POST /api/paths/distributions` call
    - Populate `distributions` and `pathCompletedCounts` from the bulk response
    - _Requirements: 10.2, 10.3_

  - [ ] 1.5 Write unit tests for `batchDistributionsSchema` and the distributions route
    - Test schema accepts valid pathIds array
    - Test schema rejects empty array, missing field, exceeding max 100
    - Test route returns correct distribution data for valid paths
    - Test route omits missing paths from result
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 2. Bulk Notes by Path Endpoint (read-only, simple)
  - [ ] 2.1 Add `listByPathId()` to `NoteRepository` interface and SQLite implementation
    - Add method signature to `server/repositories/interfaces/noteRepository.ts`
    - Implement in SQLite repository: `SELECT * FROM step_notes WHERE path_id = ? ORDER BY created_at DESC`
    - _Requirements: 3.1, 3.2_

  - [ ] 2.2 Add `getNotesForPath()` to `noteService`
    - Add method that calls `repos.notes.listByPathId(pathId)`
    - _Requirements: 3.1, 3.2_

  - [ ] 2.3 Create `GET /api/notes/path/[id].get.ts` route
    - Get pathId from route param
    - Verify path exists via `pathService.getPath(pathId)` — throws NotFoundError → 404
    - Return `noteService.getNotesForPath(pathId)`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 2.4 Update `jobs/[id].vue` `loadPathNotes()` to use bulk notes endpoint
    - Replace the `for (const step of path.steps)` loop with a single `GET /api/notes/path/:pathId` call
    - Remove the per-step try/catch loop
    - _Requirements: 8.1, 8.2_

  - [ ] 2.5 Write unit tests for `getNotesForPath` and the notes route
    - Test service returns notes sorted by createdAt desc
    - Test route returns 404 for non-existent path
    - Test route returns empty array for path with no notes
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. Bulk Step Statuses Endpoint (read-only)
  - [ ] 3.1 Add `batchStepStatusesSchema` to `server/schemas/partSchemas.ts`
    - Add Zod schema: `partIds` string array, min 1, max 500
    - Export as `batchStepStatusesSchema`
    - _Requirements: 4.2_

  - [ ] 3.2 Create `POST /api/parts/step-statuses/batch.post.ts` route
    - Validate body with `parseBody(event, batchStepStatusesSchema)`
    - Loop over `partIds`, call `lifecycleService.getStepStatuses()` per part
    - Omit missing parts (try/catch per part)
    - Return `Record<string, PartStepStatusView[]>`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 3.3 Update `parts/step/[stepId].vue` `fetchDeferredSteps()` to use bulk endpoint
    - Replace `Promise.allSettled` with individual `getStepStatuses` calls with a single `POST /api/parts/step-statuses/batch` call
    - Filter the returned map for parts with deferred steps
    - _Requirements: 9.1, 9.2_

  - [ ] 3.4 Write unit tests for `batchStepStatusesSchema` and the step statuses route
    - Test schema accepts valid partIds array
    - Test schema rejects empty array, exceeding max 500
    - Test route returns correct statuses for valid parts
    - Test route omits missing parts from result
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 4. Checkpoint — Ensure all tests pass for read-only endpoints
  - Run `npm run test` and `npm run lint` to verify all read-only bulk endpoints work correctly before moving to write endpoints.

- [ ] 5. Batch Advance-To-Step Endpoint (write, medium risk)
  - [ ] 5.1 Add `batchAdvanceToSchema` to `server/schemas/partSchemas.ts`
    - Add Zod schema: `partIds` string array (1–100), `targetStepId` string (required), `skip` boolean (optional)
    - Export as `batchAdvanceToSchema`
    - _Requirements: 2.1, 2.2_

  - [ ] 5.2 Create `POST /api/parts/advance-to.post.ts` route
    - Validate body with `parseBody(event, batchAdvanceToSchema)`
    - Get userId from `getAuthUserId(event)`
    - Loop over `partIds`, call `lifecycleService.advanceToStep()` per part with try/catch
    - Collect per-part results: `{ partId, success, error? }`
    - Return `{ advanced, failed, results }`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 5.3 Add `batchAdvanceToStep()` to `useLifecycle.ts` composable
    - New method that calls `POST /api/parts/advance-to` with `{ partIds, targetStepId, skip }`
    - Returns `{ advanced, failed, results }` response
    - Manages `loading` and `error` refs like other methods
    - _Requirements: 7.3_

  - [ ] 5.4 Update `ProcessAdvancementPanel.vue` to use `batchAdvanceToStep()`
    - Replace the `for (const partId of ids)` loop in `handleSkipSelectedParts()` with a single `batchAdvanceToStep()` call
    - Update toast message to show advanced/failed counts from the response
    - _Requirements: 7.1, 7.4_

  - [ ] 5.5 Update `skipStep.ts` to use `batchAdvanceToStep()`
    - Change `SkipStepParams` interface: replace `advanceToStep` (single-part fn) with `batchAdvanceToStep` (bulk fn)
    - Update `executeSkip()` to make a single bulk call instead of a loop
    - Update all callers of `executeSkip()` to pass the new parameter
    - _Requirements: 7.2_

  - [ ] 5.6 Write unit tests for `batchAdvanceToSchema` and the advance-to route
    - Test schema accepts valid input with partIds, targetStepId, optional skip
    - Test schema rejects missing targetStepId, empty partIds, exceeding max 100
    - Test route collects per-part results (success and failure)
    - Test `advanced + failed === partIds.length` invariant
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 6. Batch Path Operations Endpoint (write, highest risk)
  - [ ] 6.1 Add `batchPathOperationsSchema` to `server/schemas/pathSchemas.ts`
    - Add Zod schema with `create` (array of path create objects), `update` (array with pathId + update fields), `delete` (array of pathId strings), all defaulting to empty arrays
    - Add `.refine()` to ensure at least one operation is present
    - Reuse existing `stepInputSchema` and `advancementModeEnum`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 6.2 Create `POST /api/jobs/[id]/paths/batch.post.ts` route
    - Validate body with `parseBody(event, batchPathOperationsSchema)`
    - Get jobId from route param, verify job exists
    - Get userId from `getAuthUserId(event)`
    - Process in order: deletes → updates → creates (calling existing pathService methods)
    - Return `{ created: Path[], updated: Path[], deleted: string[] }`
    - If any operation fails, the error propagates (no partial results)
    - _Requirements: 1.1, 1.5, 1.6, 1.7, 1.8_

  - [ ] 6.3 Update `useJobForm.ts` `submitCreate()` to use batch endpoint
    - Replace the `for (const draft of pathDrafts.value)` loop with a single `POST /api/jobs/:id/paths/batch` call with all paths in the `create` array
    - _Requirements: 6.1, 6.3_

  - [ ] 6.4 Update `useJobForm.ts` `submitEdit()` to use batch endpoint
    - Replace the three sequential loops (delete, update, create) with a single `POST /api/jobs/:id/paths/batch` call
    - Map `changes.toDelete`, `changes.toUpdate`, and `changes.toCreate` to the batch schema format
    - _Requirements: 6.2, 6.3_

  - [ ] 6.5 Write unit tests for `batchPathOperationsSchema` and the batch route
    - Test schema accepts valid create/update/delete combinations
    - Test schema rejects when all arrays are empty
    - Test schema validates step structures within create/update
    - Test route processes deletes before updates before creates
    - Test route returns correct created/updated/deleted arrays
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [ ] 7. Final checkpoint — Ensure all tests pass
  - Run `npm run test`, `npm run lint`, and `npx nuxt typecheck` to verify everything works end-to-end.

- [ ] 8. Update AI-MAP.md
  - Add the 5 new bulk endpoints to the Routes → Services Map table
  - Note the frontend callers that were updated
  - Update any relevant sections about API patterns

## Notes

- Read-only endpoints (tasks 1–3) are done first since they're zero-risk and provide immediate latency improvements
- Write endpoints (tasks 5–6) are done after the read-only checkpoint passes
- The batch path operations endpoint (task 6) is highest risk because it orchestrates multiple write operations — it's done last
- All new routes use `defineApiHandler` (not `defineEventHandler`) per coding standards
- All request bodies are validated with Zod schemas via `parseBody()` per coding standards
- No database migrations are needed — all bulk endpoints compose existing service methods
- The `skipStep.ts` interface change (task 5.5) is a breaking change to `SkipStepParams` — all callers must be updated in the same task
