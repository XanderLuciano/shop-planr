# Requirements Document

## Introduction

The Shop Planr frontend currently has several pages and components that make N sequential or parallel HTTP calls where a single bulk endpoint would suffice. This causes unnecessary latency, partial-failure risk on writes, and excessive server load. This feature introduces five new bulk API endpoints (with Zod validation) and updates the frontend callers to use them, collapsing N HTTP round-trips into one per operation.

## Glossary

- **Bulk Endpoint**: A single API route that accepts an array of items or IDs and performs the operation in one request/response cycle.
- **N+1 Pattern**: A frontend or server-side pattern where one initial query is followed by N additional queries, one per result item.
- **Batch Path Operations**: Creating, updating, and deleting multiple paths for a job in a single API call.
- **Batch Advance-To-Step**: Advancing multiple parts to a specific target step (with skip/complete semantics) in a single API call.
- **Bulk Notes Fetch**: Retrieving all notes for all steps in a path in a single API call.
- **Bulk Step Statuses Fetch**: Retrieving step statuses for multiple parts in a single API call.
- **Bulk Path Distributions Fetch**: Retrieving step distributions for multiple paths in a single API call.

## Requirements

### Requirement 1: Batch Path Operations Endpoint

**User Story:** As a user creating or editing a job, I want all path creates, updates, and deletes to happen in a single request, so that the operation is atomic and faster.

#### Acceptance Criteria

1. THE system SHALL expose `POST /api/jobs/:id/paths/batch` accepting a JSON body with `create`, `update`, and `delete` arrays
2. THE `create` array items SHALL each contain `name` (string, required), `goalQuantity` (positive integer, required), `advancementMode` (optional enum), and `steps` (array, min 1)
3. THE `update` array items SHALL each contain `pathId` (string, required) and any of `name`, `goalQuantity`, `advancementMode`, `steps`
4. THE `delete` array items SHALL each be a `pathId` string
5. THE endpoint SHALL validate the request body with a Zod schema and return 400 on validation failure
6. THE endpoint SHALL process deletes first, then updates, then creates (same order as the current sequential logic)
7. THE endpoint SHALL return an object with `created` (Path[]), `updated` (Path[]), and `deleted` (string[]) arrays
8. IF any individual operation fails, THE endpoint SHALL stop processing and return the error (no partial commits for writes)

### Requirement 2: Batch Advance-To-Step Endpoint

**User Story:** As an operator skipping or advancing multiple parts to a specific step, I want all parts advanced in a single request, so that the UI doesn't loop over individual calls.

#### Acceptance Criteria

1. THE system SHALL expose `POST /api/parts/advance-to` accepting a JSON body with `partIds` (string[], 1–100), `targetStepId` (string, required), and optional `skip` (boolean)
2. THE endpoint SHALL validate the request body with a Zod schema and return 400 on validation failure
3. THE endpoint SHALL process each part and collect results (partId, success, error) similar to the existing `POST /api/parts/advance` pattern
4. THE endpoint SHALL return `{ advanced: number, failed: number, results: { partId, success, error? }[] }`
5. THE endpoint SHALL NOT stop on individual part failures — it SHALL process all parts and report per-part results

### Requirement 3: Bulk Notes by Path Endpoint

**User Story:** As a user viewing a job's path notes, I want all notes for every step in a path fetched in one call, so that the UI doesn't loop over each step individually.

#### Acceptance Criteria

1. THE system SHALL expose `GET /api/notes/path/:pathId` returning all notes for all steps belonging to that path
2. THE endpoint SHALL return a flat `StepNote[]` array sorted by `createdAt` descending
3. IF the path does not exist, THE endpoint SHALL return 404
4. IF the path has no notes, THE endpoint SHALL return an empty array (200)

### Requirement 4: Bulk Step Statuses Endpoint

**User Story:** As a user viewing the step view page, I want step statuses for all parts fetched in one call, so that the UI doesn't fire N parallel requests.

#### Acceptance Criteria

1. THE system SHALL expose `POST /api/parts/batch-step-statuses` accepting a JSON body with `partIds` (string[], 1–500)
2. THE endpoint SHALL validate the request body with a Zod schema and return 400 on validation failure
3. THE endpoint SHALL return a `Record<string, PartStepStatusView[]>` mapping each partId to its step statuses
4. IF a partId does not exist, THE endpoint SHALL omit it from the result (no error for missing parts)
5. THE endpoint SHALL use the existing `lifecycleService.getStepStatuses()` per part internally (correctness over optimization)

### Requirement 5: Bulk Path Distributions Endpoint

**User Story:** As a user expanding jobs to see path progress, I want distributions for multiple paths fetched in one call, so that the UI doesn't fire N parallel requests per job.

#### Acceptance Criteria

1. THE system SHALL expose `POST /api/paths/batch-distributions` accepting a JSON body with `pathIds` (string[], 1–100)
2. THE endpoint SHALL validate the request body with a Zod schema and return 400 on validation failure
3. THE endpoint SHALL return a `Record<string, { distribution: StepDistribution[], completedCount: number }>` mapping each pathId to its distribution data
4. IF a pathId does not exist, THE endpoint SHALL omit it from the result (no error for missing paths)

### Requirement 6: Frontend — Job Form Uses Batch Path Operations

**User Story:** As a developer, I want the job creation and edit forms to use the batch path endpoint, so that all path mutations happen in one HTTP call.

#### Acceptance Criteria

1. THE `useJobForm.ts` `submitCreate()` function SHALL call `POST /api/jobs/:id/paths/batch` with all paths in the `create` array instead of looping `POST /api/paths`
2. THE `useJobForm.ts` `submitEdit()` function SHALL call `POST /api/jobs/:id/paths/batch` with the computed `toDelete`, `toUpdate`, and `toCreate` arrays instead of three sequential loops
3. THE composable SHALL handle errors from the batch endpoint and surface them to the UI

### Requirement 7: Frontend — Skip/Advance-To Uses Batch Endpoint

**User Story:** As a developer, I want the skip and advance-to-step UI to use the batch endpoint, so that multiple parts are processed in one HTTP call.

#### Acceptance Criteria

1. THE `ProcessAdvancementPanel.vue` `handleSkipSelectedParts()` SHALL call `POST /api/parts/advance-to` with all selected part IDs instead of looping `advanceToStep()` per part
2. THE `skipStep.ts` `executeSkip()` SHALL call `POST /api/parts/advance-to` with all part IDs instead of looping `advanceToStep()` per part
3. THE `useLifecycle.ts` composable SHALL expose a new `batchAdvanceToStep()` method that calls the bulk endpoint
4. THE UI SHALL report the count of advanced and failed parts from the batch response
5. THE `AdvanceToStepDropdown.vue` `handleAdvance()` SHALL call `batchAdvanceToStep()` with a single-item `partIds` array instead of the single-part `advanceToStep()`

### Requirement 8: Frontend — Path Notes Uses Bulk Endpoint

**User Story:** As a developer, I want the job detail page to fetch all path notes in one call, so that it doesn't loop over each step.

#### Acceptance Criteria

1. THE `jobs/[id].vue` `loadPathNotes()` function SHALL call `GET /api/notes/path/:pathId` instead of looping `GET /api/notes/step/:stepId` per step
2. THE function SHALL sort the returned notes by `createdAt` descending (server already returns sorted)

### Requirement 9: Frontend — Step Statuses Uses Bulk Endpoint

**User Story:** As a developer, I want the step view page to fetch all part step statuses in one call, so that it doesn't fire N parallel requests.

#### Acceptance Criteria

1. THE `parts/step/[stepId].vue` `fetchDeferredSteps()` function SHALL call `POST /api/parts/batch-step-statuses` with all part IDs instead of `Promise.allSettled` with individual calls
2. THE function SHALL filter the returned map for parts with deferred steps, same as current logic

### Requirement 10: Frontend — Path Distributions Uses Bulk Endpoint

**User Story:** As a developer, I want the job expandable row and job detail page to fetch all path distributions in one call, so that they don't fire N parallel requests.

#### Acceptance Criteria

1. THE `JobExpandableRow.vue` bulk expand logic SHALL call `POST /api/paths/batch-distributions` with all uncached path IDs instead of batched `Promise.allSettled` with individual `GET /api/paths/:id` calls
2. THE `jobs/[id].vue` `loadAllDistributions()` SHALL call `POST /api/paths/batch-distributions` with all path IDs instead of `Promise.allSettled` with individual calls
3. THE callers SHALL populate their local distribution caches from the bulk response
