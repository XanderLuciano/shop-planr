# Implementation Plan: Path "Done" Total Fix

## Overview

Fix GitHub Issue #24 — the Path "Done" total incorrectly sums `completedCount` across all `StepDistribution` entries (multiplying the true count by the number of steps). The fix removes the completed-count loop from `getStepDistribution()`, adds a new `getPathCompletedCount()` method, returns `completedCount` as a top-level field from the API, and updates frontend components to use it directly.

## Tasks

- [x] 1. Fix pathService: remove buggy completed-count loop and add getPathCompletedCount
  - [x] 1.1 Remove the completed-count loop from `getStepDistribution()` in `server/services/pathService.ts`
    - Delete the block that queries `repos.parts.listByStepIndex(pathId, -1)` and copies `completedCount` onto every distribution entry
    - Each `StepDistribution` entry should have `completedCount: 0` (already initialized to 0 in the map)
    - Bottleneck detection, `partCount`, and all other fields remain unchanged
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 1.2 Add `getPathCompletedCount(pathId)` method to `pathService`
    - Returns `repos.parts.listByStepIndex(pathId, -1).length`
    - Throws `NotFoundError` if path does not exist
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.3 Update existing `getStepDistribution` unit tests in `tests/unit/services/pathService.test.ts`
    - Change the assertion `expect(dist[0].completedCount).toBe(1)` → `expect(dist[0].completedCount).toBe(0)` (and similar)
    - Add assertion that all entries have `completedCount === 0` even when completed parts exist
    - _Requirements: 2.2_

  - [x] 1.4 Add unit tests for `getPathCompletedCount` in `tests/unit/services/pathService.test.ts`
    - Test: returns correct count of parts with `currentStepIndex === -1`
    - Test: returns 0 when no parts are completed
    - Test: throws `NotFoundError` for missing path
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.5 Write property test: Done count equals parts with stepIndex -1 (CP-DONE-1)
    - **Property CP-DONE-1: Path completed count equals parts with currentStepIndex === -1**
    - Create `tests/properties/pathDoneCount.property.test.ts`
    - Generate arbitrary paths with random parts at various step indices (including -1)
    - Assert `getPathCompletedCount(pathId) === parts.filter(p => p.currentStepIndex === -1).length`
    - **Validates: Requirements 1.1, 1.2**

  - [x] 1.6 Write property test: Distribution completedCount entries are always 0 (CP-DONE-2)
    - **Property CP-DONE-2: Distribution completedCount entries are always 0**
    - Add to `tests/properties/pathDoneCount.property.test.ts`
    - Generate arbitrary paths with completed parts
    - Assert `getStepDistribution(pathId).every(d => d.completedCount === 0)`
    - **Validates: Requirements 2.2**

- [x] 2. Update API route and composable to include completedCount
  - [x] 2.1 Update `server/api/paths/[id].get.ts` to include `completedCount` in response
    - Call `pathService.getPathCompletedCount(id)` and spread into response: `{ ...path, distribution, completedCount }`
    - Existing error handling (404, 400) remains unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.2 Update `usePaths` composable return type in `app/composables/usePaths.ts`
    - Change `getPath` return type to include `completedCount: number` alongside `distribution`
    - _Requirements: 3.1_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update frontend components to use path-level completedCount
  - [x] 4.1 Update `StepTracker.vue` to accept and use `completedCount` prop
    - Add `completedCount: number` to props (with default 0)
    - Replace `distribution.reduce((s, d) => s + d.completedCount, 0)` in the "Done" card with `completedCount`
    - Per-step `completedCount` display (`{{ step.completedCount }} done`) will now show `0` — this is correct per the design
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 4.2 Update `app/pages/jobs/[id].vue` to pass `completedCount` to `StepTracker`
    - Store `completedCount` per path alongside distributions in `loadAllDistributions()`
    - Pass `:completed-count="pathCompletedCounts[p.id] ?? 0"` to `<StepTracker>`
    - _Requirements: 6.1, 6.2_

  - [x] 4.3 Update `JobExpandableRow.vue` to use path-level `completedCount` for ProgressBar
    - Store `completedCount` from API response per path (new `pathCompletedCounts` ref)
    - Replace `:completed="pathDistributions[path.id]!.reduce(...)"`  with `:completed="pathCompletedCounts[path.id] ?? 0"`
    - The expanded step table "Completed" column will show `0` per step (correct per design)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 5. Update integration test for end-to-end Done count correctness
  - [x] 5.1 Add integration test in `tests/integration/progressTracking.test.ts`
    - Create a multi-step path, advance some parts to completion (stepIndex -1)
    - Call `getStepDistribution()` and `getPathCompletedCount()` separately
    - Assert `completedCount` matches actual completed parts
    - Assert all distribution entries have `completedCount === 0`
    - Assert the old bug (N × completedCount) no longer occurs
    - _Requirements: 1.2, 2.2, 3.2_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The design uses TypeScript throughout — no language selection needed
- Property tests use `fast-check` with the project's existing patterns in `tests/properties/`
- The `completedCount` field on `StepDistribution` is set to `0` rather than removed, preserving the interface shape
