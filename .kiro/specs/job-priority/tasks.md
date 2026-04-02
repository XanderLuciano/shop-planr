# Implementation Plan: Job Page Priority

## Overview

Add a master priority system to the Jobs page. Each job gets a `priority` INTEGER column (1 = highest). Users can enter a priority-editing mode, drag-and-drop to reorder, and save. The feature spans all layers: migration → repository → service → API route → composable → UI.

## Tasks

- [x] 1. Database migration and domain type updates
  - [x] 1.1 Create migration `server/repositories/sqlite/migrations/009_add_job_priority.sql`
    - `ALTER TABLE jobs ADD COLUMN priority INTEGER`
    - Backfill existing jobs with sequential priority based on `created_at` order (oldest = 1)
    - `CREATE INDEX idx_jobs_priority ON jobs(priority)`
    - _Requirements: 1.1, 1.2, 1.5_

  - [x] 1.2 Add `priority: number` field to the `Job` interface in `server/types/domain.ts`
    - Update `JobRow` interface and `rowToDomain` in `server/repositories/sqlite/jobRepository.ts` to include `priority`
    - Update `create()` to persist `priority` column
    - Update `list()` to `ORDER BY priority ASC` instead of `created_at DESC`
    - Update `update()` to persist `priority` column
    - _Requirements: 1.1, 2.1, 2.2_

- [x] 2. Repository layer: bulk priority update
  - [x] 2.1 Extend `JobRepository` interface in `server/repositories/interfaces/jobRepository.ts`
    - Add `bulkUpdatePriority(entries: { id: string; priority: number }[]): void`
    - Add `getMaxPriority(): number`
    - _Requirements: 3.1, 3.8_

  - [x] 2.2 Implement `bulkUpdatePriority` and `getMaxPriority` in `server/repositories/sqlite/jobRepository.ts`
    - `bulkUpdatePriority`: iterate entries in a single `db.transaction()`, run `UPDATE jobs SET priority = ?, updated_at = ? WHERE id = ?` per entry
    - `getMaxPriority`: `SELECT COALESCE(MAX(priority), 0) FROM jobs`
    - _Requirements: 3.8, 3.9, 1.3, 1.4_

- [x] 3. Service layer: priority validation and update
  - [x] 3.1 Add `UpdatePrioritiesInput` type to `server/types/api.ts`
    - `{ priorities: { jobId: string; priority: number }[] }`
    - _Requirements: 3.1_

  - [x] 3.2 Add `updatePriorities(input: UpdatePrioritiesInput): Job[]` method to `jobService`
    - Validate: array not empty
    - Validate: all job IDs exist in DB
    - Validate: no duplicate job IDs
    - Validate: no duplicate priority values
    - Validate: priorities form contiguous sequence 1..N
    - Validate: count matches total job count
    - Call `repos.jobs.bulkUpdatePriority()`
    - Return `repos.jobs.list()` (sorted by priority)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 3.3 Modify `createJob` in `jobService` to assign priority
    - Call `repos.jobs.getMaxPriority()` and set `priority = max + 1` (or 1 if no jobs)
    - _Requirements: 1.3, 1.4_

  - [x] 3.4 Write property test: new job priority assignment (Property 1)
    - **Property 1: New job priority assignment**
    - For any N existing jobs, creating a new job assigns priority N+1, preserving contiguous {1..N+1}
    - File: `tests/properties/jobPriorityAssignment.property.test.ts`
    - **Validates: Requirements 1.3, 1.4**

  - [x] 3.5 Write property test: list sorted by priority (Property 2)
    - **Property 2: List sorted by priority**
    - For any set of jobs, `list()` returns them sorted by priority ascending
    - File: `tests/properties/jobPrioritySorted.property.test.ts`
    - **Validates: Requirement 2.1**

  - [x] 3.6 Write property test: valid priority update (Property 3)
    - **Property 3: Valid priority update persists correctly**
    - For any valid permutation, after `updatePriorities`, each job has the specified priority and the set is exactly {1..N}
    - File: `tests/properties/jobPriorityUpdate.property.test.ts`
    - **Validates: Requirements 3.1, 3.2**

  - [x] 3.7 Write property test: invalid priority list rejection (Property 4)
    - **Property 4: Invalid priority list rejection**
    - Duplicate IDs, duplicate priorities, or non-contiguous sequences are rejected; all priorities remain unchanged
    - File: `tests/properties/jobPriorityInvalidRejection.property.test.ts`
    - **Validates: Requirements 3.3, 3.4, 3.5**

  - [x] 3.8 Write property test: non-existent job ID rejection (Property 5)
    - **Property 5: Non-existent job ID rejection**
    - A priority list referencing a non-existent job ID is rejected; all priorities remain unchanged
    - File: `tests/properties/jobPriorityNotFound.property.test.ts`
    - **Validates: Requirement 3.6**

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. API route: bulk priority update endpoint
  - [x] 5.1 Create `server/api/jobs/priorities.patch.ts`
    - Parse request body, call `jobService.updatePriorities(body)`, return result
    - Catch `ValidationError` → 400, `NotFoundError` → 404
    - Follow thin-handler pattern from coding standards
    - _Requirements: 3.1, 3.8_

  - [x] 5.2 Write unit tests for the `updatePriorities` service method
    - Test valid reorder, duplicate IDs, duplicate priorities, non-sequential, missing jobs, count mismatch
    - File: `tests/unit/services/jobPriority.test.ts`
    - _Requirements: 3.1–3.9_

- [x] 6. Composable: useJobPriority
  - [x] 6.1 Create `app/composables/useJobPriority.ts`
    - Expose: `isEditingPriority`, `orderedJobs`, `saving`
    - Implement: `enterEditMode(jobs)` — snapshot current order, set editing true
    - Implement: `cancelEdit()` — restore snapshot, set editing false
    - Implement: `reorder(fromIndex, toIndex)` — splice-based array move
    - Implement: `savePriorities()` — build priority list from array indices, `$fetch` PATCH `/api/jobs/priorities`, refresh on success
    - _Requirements: 4.1, 4.4, 4.5, 5.2, 5.3_

  - [x] 6.2 Write property test: cancel restores snapshot (Property 6)
    - **Property 6: Cancel restores snapshot**
    - For any sequence of reorder operations, `cancelEdit` restores the exact original order
    - File: `tests/properties/jobPriorityCancelRestore.property.test.ts`
    - **Validates: Requirement 4.4**

  - [x] 6.3 Write property test: reorder conservation (Property 7)
    - **Property 7: Reorder conservation and correctness**
    - For any valid (fromIndex, toIndex), reorder preserves the same set of job IDs and total count
    - File: `tests/properties/jobPriorityReorderConservation.property.test.ts`
    - **Validates: Requirements 5.2, 5.3**

- [x] 7. Jobs page UI: priority editing mode
  - [x] 7.1 Update `app/pages/jobs/index.vue` for priority edit mode
    - Add "Edit Priority" button next to "New Job" in the header
    - When in edit mode: show "Save" and "Cancel" buttons, hide "Edit Priority" and "New Job"
    - Add priority column to the table showing numeric priority value
    - Replace the existing `jiraPriority` column with the new `priority` field (or add alongside)
    - Disable row-click navigation while in edit mode
    - Show loading indicator on Save button while saving
    - Display error toast if save fails, remain in edit mode
    - Wire drag handles on each row for drag-and-drop reorder (native HTML5 drag events)
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 5.1, 5.4, 6.1, 6.2, 7.1, 7.2_

  - [x] 7.2 Update `app/components/JobMobileCard.vue` for mobile priority editing
    - Enable drag-and-drop reordering on mobile card list when in edit mode
    - Show drag handle and priority number on each card during edit mode
    - _Requirements: 8.1_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The design uses native HTML5 drag-and-drop — no new dependencies needed
- The existing `jiraPriority` string field is unrelated and remains unchanged
