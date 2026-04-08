# Implementation Plan: Work Queue Shows First Step + Queue Cleanup

## Overview

Implement first-step visibility in the work queue (first active step shown when `completedCount < goalQuantity`), remove dead endpoint and composable code, migrate `advanceBatch` to a standalone composable, remove `operatorId` from `WorkQueueResponse`, update frontend display, align property tests, and update content documentation.

## Tasks

- [x] 1. Type changes and helper functions
  - [x] 1.1 Add `goalQuantity?: number` and `completedCount?: number` to `WorkQueueJob` in `server/types/computed.ts`
    - Add both optional fields after `jobPriority`
    - _Requirements: 4.1, 4.2_

  - [x] 1.2 Remove `operatorId` from `WorkQueueResponse` in `server/types/computed.ts`
    - Remove the `operatorId: string` field from the interface
    - _Requirements: 9.1_

  - [x] 1.3 Create `findFirstActiveStep` and `shouldIncludeStep` utility functions in `server/utils/workQueueHelpers.ts`
    - `findFirstActiveStep(steps)` returns the first step where `!step.removedAt`, or `undefined`
    - `shouldIncludeStep(step, partCount, isFirstActiveStep, pathGoalQuantity)` returns `true` if `partCount > 0` OR (`isFirstActiveStep` AND `step.completedCount < pathGoalQuantity`)
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.2_

  - [x] 1.4 Add `parseQuery()` utility to `server/utils/validation.ts`
    - Mirrors `parseBody()`: accepts H3 event + Zod schema, parses `getQuery(event)`, throws `ValidationError` on failure
    - _Requirements: 12.1_

  - [x] 1.5 Create `server/schemas/operatorSchemas.ts` with `workQueueQuerySchema`
    - Schema: `z.object({ groupBy: z.enum(['user', 'location', 'step']).default('location') })`
    - _Requirements: 12.2_

  - [x] 1.6 Write unit tests for `findFirstActiveStep` and `shouldIncludeStep`
    - Test: all active steps → returns step with lowest order
    - Test: first step soft-deleted → returns next non-removed step
    - Test: all steps soft-deleted → returns `undefined`
    - Test: `shouldIncludeStep` boundary values (`completedCount` = 0, goalQuantity - 1, goalQuantity, goalQuantity + 1)
    - Test: non-first-active steps never force-included
    - _Requirements: 2.1, 2.2, 2.3, 1.1, 1.2, 1.3_

- [x] 2. Backend: Update API route endpoints with first-step logic
  - [x] 2.1 Update `server/api/operator/work-queue.get.ts` (grouped endpoint)
    - Replace manual `VALID_GROUP_BY` array check with `parseQuery(event, workQueueQuerySchema)` for Zod-validated `groupBy` with default
    - Add soft-delete filtering: skip steps where `step.removedAt` is set
    - Compute `firstActiveStep` per path using `findFirstActiveStep`
    - Replace `if (parts.length === 0) continue` with `if (!shouldIncludeStep(...)) continue`
    - Attach `goalQuantity` and `completedCount` to entries for first-active-step only via spread: `...(isFirstActive && { goalQuantity: path.goalQuantity, completedCount: step.completedCount })`
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 3.1, 4.3, 4.4, 5.1, 12.3_

  - [x] 2.2 Update `server/api/operator/queue/_all.get.ts` (flat endpoint)
    - Add soft-delete filtering: skip steps where `step.removedAt` is set
    - Compute `firstActiveStep` per path using `findFirstActiveStep`
    - Replace `if (parts.length === 0 && step.order !== 0) continue` with `if (!shouldIncludeStep(...)) continue`
    - Attach `goalQuantity` and `completedCount` to entries for first-active-step only
    - Remove `operatorId: '_all'` from the response object
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 3.1, 4.3, 4.4, 5.1, 5.2, 9.2_

  - [x] 2.3 Write property test: First-Step Visibility (CP-WQ-FS1)
    - **Property 1: First-Step Visibility (CP-WQ-FS1)**
    - Generate jobs/paths/steps with random `completedCount` values below `goalQuantity`. Assert the first active step always appears in the response even with `partCount === 0`.
    - **Validates: Requirements 1.1, 2.1**

  - [x] 2.4 Write property test: First-Step Disappearance (CP-WQ-FS2)
    - **Property 2: First-Step Disappearance (CP-WQ-FS2)**
    - Generate paths where the first active step has `completedCount >= goalQuantity` and `partCount = 0`. Assert the step does not appear.
    - **Validates: Requirements 1.2**

  - [x] 2.5 Write property test: Backward Compatibility (CP-WQ-FS3)
    - **Property 3: Backward Compatibility (CP-WQ-FS3)**
    - Generate non-first-active steps with 0 parts. Assert they never appear in the queue.
    - **Validates: Requirements 1.3**

  - [x] 2.6 Write property test: Soft-Delete Respect (CP-WQ-FS6)
    - **Property 6: Soft-Delete Respect (CP-WQ-FS6)**
    - Generate paths with soft-deleted steps. Assert soft-deleted steps never appear and the correct step inherits first-step treatment.
    - **Validates: Requirements 3.1, 3.2, 2.2**

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Dead endpoint removal and composable migration
  - [x] 4.1 Delete `server/api/operator/queue/[userId].get.ts`
    - _Requirements: 7.1_

  - [x] 4.2 Delete `app/composables/useWorkQueue.ts`
    - _Requirements: 8.1_

  - [x] 4.3 Create `app/composables/useAdvanceBatch.ts`
    - Extract `advanceBatch()` from the deleted `useWorkQueue.ts`
    - Add `availablePartCount` parameter for client-side validation: throw if `partIds.length > availablePartCount`
    - Return type is `{ advanced: number }` only — no `nextStepName` echoing
    - _Requirements: 8.2, 8.3_

  - [x] 4.4 Update `app/pages/parts/step/[stepId].vue` to use `useAdvanceBatch`
    - Replace `useWorkQueue().advanceBatch` with `useAdvanceBatch().advanceBatch`
    - Pass `job.value.partCount` as `availablePartCount`
    - Resolve `nextStepName` locally in `handleAdvance`: `const dest = job.value.isFinalStep ? 'Completed' : (job.value.nextStepName ?? 'next step')`
    - _Requirements: 8.4, 8.5_

- [x] 5. Frontend: Display first-step progress
  - [x] 5.1 Update `app/pages/queue.vue` to show progress on first-step entries
    - For entries where `job.goalQuantity != null`, display `{{ job.completedCount }} / {{ job.goalQuantity }} completed` alongside the existing part count badge
    - Both the part count badge and progress text must be visible simultaneously
    - Normal steps (no `goalQuantity`) remain unchanged
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 5.2 Update `app/components/WorkQueueList.vue` to show progress on first-step entries
    - Same display logic as queue.vue: show `completedCount / goalQuantity completed` when `goalQuantity` is defined
    - Both indicators visible simultaneously
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 6. Align property tests with new endpoint behavior
  - [x] 6.1 Update `tests/properties/allWorkEndpoint.property.test.ts`
    - Update `aggregateAllWork` replicated logic to include first-step inclusion (`shouldIncludeStep` predicate) and soft-delete filtering
    - Remove `operatorId` from the constructed `WorkQueueResponse`
    - Update assertions to account for first-step entries with `partCount === 0`
    - _Requirements: 10.2, 9.3_

  - [x] 6.2 Update `tests/properties/workQueueAggregation.property.test.ts`
    - Update replicated logic to match `_all` endpoint behavior (not the deleted `[userId]` endpoint)
    - Add first-step inclusion and soft-delete filtering
    - Remove `operatorId` references
    - _Requirements: 10.1, 9.3_

  - [x] 6.3 Update `tests/properties/assigneeGrouping.property.test.ts`
    - Add soft-delete filtering and first-step inclusion to the replicated grouping logic
    - _Requirements: 10.3_

- [x] 7. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Content documentation updates
  - [x] 8.1 Delete `content/api-docs/operator/queue-user.md`
    - _Requirements: 7.2_

  - [x] 8.2 Update `content/api-docs/operator/index.md`
    - Remove the "User queue" entry from the endpoint table
    - _Requirements: 7.3_

  - [x] 8.3 Update `content/api-docs/operator/queue-all.md`
    - Document first-step behavior (first active step included when `completedCount < goalQuantity`)
    - Document new `goalQuantity` and `completedCount` fields on `WorkQueueJob`
    - Remove `operatorId` from the documented response shape
    - Remove references to the deleted user queue endpoint
    - _Requirements: 11.1, 7.4, 9.5_

  - [x] 8.4 Update `content/api-docs/operator/work-queue.md`
    - Document first-step behavior and new `goalQuantity`/`completedCount` fields
    - Remove references to the deleted user queue endpoint
    - _Requirements: 11.2, 7.4_

- [x] 9. AI-MAP updates
  - [x] 9.1 Update `AI-MAP.md` to reflect changes
    - Remove `[userId]` queue endpoint from route table
    - Remove `operatorId` from `WorkQueueResponse` description
    - Add `useAdvanceBatch` composable
    - Add `parseQuery` utility to server/utils description
    - Note first-step visibility feature
    - _Requirements: 13.1_

- [x] 10. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (CP-WQ-FS1 through CP-WQ-FS7)
- The implementation language is TypeScript (Nuxt 3 / Vue 3 stack)
- `useAdvanceBatch` returns `{ advanced: number }` only — the caller resolves `nextStepName` locally from `job.value`
