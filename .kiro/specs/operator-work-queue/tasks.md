# Implementation Plan: Operator Work Queue

## Overview

Replace the step-name-based operator view with a user-centric work queue. The implementation adds new computed types, a new API endpoint for queue aggregation, two new composables (`useOperatorIdentity`, `useWorkQueue`), two new components (`WorkQueueList`, `ProcessAdvancementPanel`), and rewrites `operator.vue` to use the new work queue UI. Existing backend services (`serialService`, `noteService`, `userService`) are reused — no new services or DB migrations needed.

## Tasks

- [x] 1. Add computed types for work queue
  - [x] 1.1 Add `WorkQueueJob` and `WorkQueueResponse` interfaces to `server/types/computed.ts`
    - Add `WorkQueueJob` with fields: `jobId`, `jobName`, `pathId`, `pathName`, `stepId`, `stepName`, `stepOrder`, `stepLocation`, `totalSteps`, `serialIds`, `partCount`, `nextStepName`, `nextStepLocation`, `isFinalStep`
    - Add `WorkQueueResponse` with fields: `operatorId`, `jobs: WorkQueueJob[]`, `totalParts`
    - _Requirements: 1.2, 1.3, 3.2, 3.6_

- [x] 2. Implement work queue API endpoint
  - [x] 2.1 Create `server/api/operator/queue/[userId].get.ts`
    - Aggregate all active serials (`currentStepIndex >= 0`) across all jobs/paths
    - Group by `jobId + pathId + stepOrder` into `WorkQueueJob` entries
    - Resolve step names, locations, next step info from path steps
    - Compute `isFinalStep` and `totalSteps` per group
    - Return `WorkQueueResponse` with `totalParts` sum
    - Follow existing thin-handler pattern with `getServices()` and error handling
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.2, 3.6_
  - [x] 2.2 Write property test for queue aggregation correctness (P1)
    - **Property 1: Queue aggregation correctness**
    - Test that for any set of active serials, the endpoint returns `WorkQueueJob` entries whose `serialIds` collectively contain exactly all active serial IDs, each in exactly one group matching its `pathId` and `currentStepIndex`
    - Create `tests/properties/workQueueAggregation.property.test.ts`
    - **Validates: Requirements 1.1, 3.2**
  - [x] 2.3 Write property test for queue structural invariants (P2)
    - **Property 2: Queue structural invariants**
    - Test that `partCount === serialIds.length`, `stepName` and `stepId` are non-empty, `totalParts === sum(partCount)`, and jobs are grouped by `jobId + pathId + stepOrder`
    - Add to `tests/properties/workQueueAggregation.property.test.ts`
    - **Validates: Requirements 1.2, 1.3, 1.4**

- [x] 3. Implement `useOperatorIdentity` composable
  - [x] 3.1 Create `app/composables/useOperatorIdentity.ts`
    - Expose `operatorId`, `operatorName`, `activeUsers`, `loading` as readonly refs
    - Implement `fetchActiveUsers()` calling `GET /api/users?active=true`
    - Implement `selectOperator(userId)` that saves to `localStorage` under key `shop_erp_operator_id` and sets reactive state
    - Implement `clearOperator()` that removes from `localStorage` and clears state
    - On init, restore operator from `localStorage` and validate against active users list
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 3.2 Write property test for operator selection localStorage round-trip (P8)
    - **Property 8: Operator selection localStorage round-trip**
    - Test that for any valid ShopUser ID, `selectOperator(id)` followed by localStorage read returns the same ID
    - Create `tests/properties/workQueueIdentity.property.test.ts`
    - **Validates: Requirements 6.3, 6.4**

- [x] 4. Implement `useWorkQueue` composable
  - [x] 4.1 Create `app/composables/useWorkQueue.ts`
    - Expose `queue`, `loading`, `error`, `searchQuery`, `filteredJobs`, `totalParts`, `filteredParts` refs
    - Implement `fetchQueue(userId)` calling `GET /api/operator/queue/:userId`
    - Implement client-side `filteredJobs` computed: case-insensitive partial match on `jobName`, `pathName`, or `stepName` against `searchQuery`; return all jobs when `searchQuery` is empty
    - Implement `totalParts` and `filteredParts` computed from queue/filtered data
    - Implement `advanceBatch(params)` that calls `POST /api/serials/:id/advance` for each serial, optionally creates a note via `POST /api/notes`, then re-fetches the queue
    - Validate quantity does not exceed available parts before submission
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.2, 5.3_
  - [x] 4.2 Write property test for search filter correctness (P3)
    - **Property 3: Search filter correctness**
    - Test that for any query `q` and list of `WorkQueueJob` items, filtered result contains exactly items where `jobName`, `pathName`, or `stepName` contains `q` case-insensitively; empty `q` returns all
    - Create `tests/properties/workQueueFilter.property.test.ts`
    - **Validates: Requirements 2.2, 2.3, 2.5**
  - [x] 4.3 Write property test for quantity validation (P5)
    - **Property 5: Quantity validation rejects over-limit**
    - Test that for any `Q > N` validation rejects, and for `1 <= Q <= N` validation accepts
    - Create `tests/properties/workQueueAdvancement.property.test.ts`
    - **Validates: Requirements 4.2, 4.3**
  - [x] 4.4 Write property test for note length validation (P7)
    - **Property 7: Note length validation**
    - Test that strings > 1000 chars are rejected/truncated, strings ≤ 1000 chars are accepted
    - Create `tests/properties/workQueueNotes.property.test.ts`
    - **Validates: Requirements 5.4**

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement `WorkQueueList` component
  - [x] 6.1 Create `app/components/WorkQueueList.vue`
    - Accept `jobs: WorkQueueJob[]`, `totalParts`, `filteredParts`, `searchActive` props
    - Display jobs grouped by job name with part counts per job
    - Show current step name and location for each job group
    - Show total parts awaiting action across all jobs
    - Display filtered vs total count when search is active
    - Display empty state message when no jobs are assigned
    - Emit `select-job` event when operator clicks a job group
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.5_

- [x] 7. Implement `ProcessAdvancementPanel` component
  - [x] 7.1 Create `app/components/ProcessAdvancementPanel.vue`
    - Accept `job: WorkQueueJob`, `loading` props
    - Display all serial numbers at the active step with checkboxes for selection
    - Provide quantity input for batch completion with validation (cannot exceed available)
    - Show inline validation error when quantity exceeds available parts
    - Display next step name and location (or "Completed" for final step)
    - Provide optional textarea for completion notes with `maxlength="1000"`
    - Display previously created notes for the current step
    - Show success confirmation after advancement with count and destination
    - Emit `advance` event with `{ serialIds, note? }` and `cancel` event
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 8. Rewrite `operator.vue` to use work queue
  - [x] 8.1 Replace the current step-name-based UI in `app/pages/operator.vue`
    - Use `useOperatorIdentity` for operator selection dropdown (from active ShopUsers)
    - Use `useWorkQueue` for queue data, search, filtering, and advancement
    - Show operator selector when no operator is selected; persist selection in localStorage
    - Provide a way to switch operators without leaving the page
    - Show search input with debounced filtering (300ms)
    - Render `WorkQueueList` with queue data
    - Render `ProcessAdvancementPanel` when a job is selected
    - Handle errors with retry buttons and toast notifications
    - _Requirements: 1.1, 1.5, 2.1, 2.4, 3.1, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Write property test for batch advancement order (P4)
  - **Property 4: Batch advancement by quantity in creation order**
  - Test that advancing `Q` serials advances exactly the first `Q` in creation order to next step (or `-1` for final step), leaving remaining unchanged
  - Add to `tests/properties/workQueueAdvancement.property.test.ts`
  - **Validates: Requirements 3.4, 4.4**

- [x] 11. Write property test for note creation on advancement (P6)
  - **Property 6: Note creation on advancement with non-empty text**
  - Test that non-empty note (≤ 1000 chars) creates a `StepNote` with matching `serialIds` and `text`; empty/absent note creates no `StepNote`
  - Add to `tests/properties/workQueueNotes.property.test.ts`
  - **Validates: Requirements 5.2, 5.3**

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The existing `GET /api/operator/:stepName` route is preserved for backward compatibility
- The existing `OperatorView.vue` component is not deleted — it may still be useful for the step-name view; the page just stops using it
- All property tests use `fast-check` with minimum 100 iterations per the project's testing conventions
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
