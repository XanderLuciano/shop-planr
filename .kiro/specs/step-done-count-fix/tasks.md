# Implementation Plan: Step Done Count Fix

## Overview

Fix GitHub Issue #50 — the per-step "Done" count always shows 0 because `getStepDistribution()` in `pathService.ts` hardcodes `completedCount: 0`. The fix computes the actual count: for each step at order N, count non-scrapped parts where `currentStepIndex > N` OR `currentStepIndex === -1`. Uses a single `listByPathId` query with in-memory filtering (also a performance improvement over the current N per-step queries). No schema changes, no new API routes, no frontend modifications — the UI already renders `step.completedCount`.

## Tasks

- [x] 1. Fix getStepDistribution() in pathService
  - [x] 1.1 Replace per-step `listByStepIndex` calls with a single `listByPathId` call and in-memory scrap filter
    - Fetch all parts once via `repos.parts.listByPathId(pathId)`
    - Filter out scrapped parts (`status !== 'scrapped'`) in-memory
    - _Requirements: 1.1, 1.2, 2.1_
  - [x] 1.2 Compute `completedCount` for each step as count of non-scrapped parts where `currentStepIndex > step.order` OR `currentStepIndex === -1`
    - Note: `-1 > N` is false in JS, so completed parts (`-1`) must be checked with an explicit `=== -1` condition
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 1.3 Compute `partCount` for each step from the same in-memory filtered array instead of `listByStepIndex`
    - Count parts where `currentStepIndex === step.order`
    - _Requirements: 1.1, 2.1_

- [x] 2. Update unit tests in pathService.test.ts
  - [x] 2.1 Update `getStepDistribution` test assertions from `completedCount === 0` to correct computed values
    - _Requirements: 3.3_
  - [x] 2.2 Update `has completedCount 0 on all entries even when completed parts exist` test to verify correct non-zero done counts
    - _Requirements: 3.3_
  - [x] 2.3 Add test case: parts at various stages produce correct per-step done counts with monotonicity
    - _Requirements: 3.3_

- [x] 3. Update property tests in pathDoneCount.property.test.ts
  - [x] 3.1 Update CP-DONE-2 to verify step done counts match the formula (parts past step OR completed) instead of asserting 0
    - _Requirements: 3.3, CP-STEP-DONE-1_
  - [x] 3.2 [PBT] Add CP-STEP-DONE-2 property: monotonic non-increasing done counts across steps
    - **Property CP-STEP-DONE-2**: For any path, `completedCount(s_0) >= completedCount(s_1) >= ... >= completedCount(s_N)`
    - **Validates: Requirements 1.3**
  - [x] 3.3 [PBT] Add CP-STEP-DONE-3 property: last step done count equals getPathCompletedCount
    - **Property CP-STEP-DONE-3**: Last step's `completedCount` equals `getPathCompletedCount(pathId)`
    - **Validates: Requirements 1.4**
  - [x] 3.4 [PBT] Add CP-STEP-DONE-4 property: count conservation (sum of partCount + pathCompleted = total non-scrapped parts)
    - **Property CP-STEP-DONE-4**: `sum(partCount) + getPathCompletedCount === count(non-scrapped parts)`
    - **Validates: Requirements 1.5**

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update integration test in progressTracking.test.ts
  - [x] 5.1 Update `completedCount matches actual completed parts` test to assert correct per-step done counts instead of all zeros
    - _Requirements: 3.3_
  - [x] 5.2 Update the multiplication bug regression check to verify step done counts are correct but distinct from path-level total
    - Ensure the old Issue #24 bug (N × completedCount) is still prevented
    - _Requirements: 3.3_

- [x] 6. Final checkpoint — Ensure all tests pass and typecheck succeeds
  - Run `npm run test` and verify all 878+ tests pass
  - Run `npm run typecheck` and verify no new type errors
  - _Requirements: 3.3, 3.4_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with the project's existing patterns in `tests/properties/`
- Integration tests use the project's `createTestContext()` helper from `tests/integration/helpers.ts`
- The `completedCount` field on `StepDistribution` already exists — only the computed value changes from hardcoded 0 to the correct count
- This is a follow-up to the Path "Done" total fix (GitHub Issue #24) which intentionally zeroed out per-step counts to stop a multiplication bug
