# Implementation Plan: Step-ID-Based Part Tracking

## Overview

Replace integer `currentStepIndex` with `currentStepId` (TEXT FK to `process_steps`) across the entire stack. Add full routing history with sequence numbers, soft-delete for process steps, write-time completion counters, ID-based step reconciliation, and a Full Route API. Migration 007 comes first, then domain types, repositories, services, API routes, frontend, and finally AI documentation updates. Each task builds on the previous so the codebase compiles at every step.

## Tasks

- [x] 1. Database migration
  - [x] 1.1 Create migration `server/repositories/sqlite/migrations/007_step_id_tracking.sql`
    - Add `current_step_id TEXT REFERENCES process_steps(id)` to `parts`
    - Backfill `current_step_id` from `current_step_index` by joining `process_steps` on `path_id` and `step_order`
    - Set `current_step_id = NULL` for completed parts (`current_step_index = -1`)
    - Log warning for orphaned step indexes (set `current_step_id = NULL`)
    - Add `removed_at TEXT` and `completed_count INTEGER NOT NULL DEFAULT 0` to `process_steps`
    - Backfill `completed_count` from existing `part_step_statuses` where `status = 'completed'`
    - Rebuild `parts` table without `current_step_index` using create-copy-drop-rename pattern (preserve all other columns: scrap fields, force-complete fields, etc.)
    - Recreate indexes: `idx_parts_job_id`, `idx_parts_path_id`, new `idx_parts_current_step_id`
    - Rebuild `part_step_statuses`: remove `UNIQUE(part_id, step_id)`, remove `step_index`, add `sequence_number INTEGER NOT NULL DEFAULT 1`, add `entered_at TEXT NOT NULL`, add `completed_at TEXT`; backfill `sequence_number = 1`, `entered_at = updated_at`
    - Recreate indexes: `idx_part_step_statuses_part`, `idx_part_step_statuses_step`, new composite `idx_part_step_statuses_part_step` on `(part_id, step_id, sequence_number)`
    - Entire migration runs in a single transaction
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 6.1, 6.2, 6.4, 15.6_


- [x] 2. Domain types and interfaces
  - [x] 2.1 Update `server/types/domain.ts`
    - `Part.currentStepIndex: number` → `Part.currentStepId: string | null` (null = completed)
    - `PartStepStatus`: remove `stepIndex`, add `sequenceNumber: number`, `enteredAt: string`, `completedAt?: string`
    - `ProcessStep`: add `removedAt?: string`, `completedCount: number`
    - Add `StepInput.id?: string` (optional existing step ID for reconciliation)
    - _Requirements: 1.1, 1.3, 6.2, 7.8, 8.5, 14.8, 15.1_

  - [x] 2.2 Update `server/types/api.ts`
    - `AdvanceToStepInput.targetStepIndex` → `AdvanceToStepInput.targetStepId: string`
    - Update `UpdatePathInput.steps` type to include optional `id` field
    - _Requirements: 2.3, 8.5_

  - [x] 2.3 Update `server/types/computed.ts`
    - `EnrichedPart.currentStepIndex` → `EnrichedPart.currentStepId: string | null`
    - Add `FullRouteResponse` and `FullRouteEntry` interfaces
    - _Requirements: 7a.6, 11.2_

  - [x] 2.4 Update `app/types/` re-exports
    - Ensure `app/types/domain.ts`, `app/types/api.ts`, `app/types/computed.ts` re-export the updated types
    - _Requirements: 1.1, 7a.6_

- [ ] 3. Repository layer changes
  - [x] 3.1 Update `server/repositories/interfaces/partRepository.ts`
    - Remove `listByStepIndex(pathId, stepIndex)` method
    - Add `listByCurrentStepId(stepId: string): Part[]` method
    - Update `countCompletedByJobId` doc to note it uses `current_step_id IS NULL`
    - _Requirements: 1.5, 9.2, 7a.1, 7a.4_

  - [x] 3.2 Update `server/repositories/sqlite/partRepository.ts`
    - Update `PartRow` interface: `current_step_index` → `current_step_id`
    - Update `rowToDomain`: map `current_step_id` → `currentStepId`
    - Update all SQL in `create`, `createBatch`, `update`: `current_step_index` → `current_step_id`
    - Replace `listByStepIndex` with `listByCurrentStepId(stepId)`: `WHERE current_step_id = ? AND status != 'scrapped'`
    - Update `countCompletedByJobId`: `WHERE current_step_id IS NULL AND status = 'completed'` instead of `current_step_index = -1`
    - _Requirements: 1.5, 9.2, 7a.1, 7a.4_

  - [x] 3.3 Update `server/repositories/interfaces/partStepStatusRepository.ts`
    - Add `getLatestByPartAndStep(partId, stepId): PartStepStatus | null`
    - Add `updateLatestByPartAndStep(partId, stepId, partial): PartStepStatus`
    - Add `getNextSequenceNumber(partId): number`
    - Update `listByPartId` doc: ordered by `sequence_number ASC`
    - _Requirements: 6.3, 3.1, 3.2_

  - [x] 3.4 Update `server/repositories/sqlite/partStepStatusRepository.ts`
    - Update `PartStepStatusRow`: `step_index` → `sequence_number`, add `entered_at`, `completed_at`
    - Update `rowToDomain`: map new columns
    - Update all SQL: column names, insert/update statements
    - Implement `getLatestByPartAndStep`: `ORDER BY sequence_number DESC LIMIT 1`
    - Implement `updateLatestByPartAndStep`: find latest by sequence_number, then update
    - Implement `getNextSequenceNumber`: `SELECT COALESCE(MAX(sequence_number), 0) + 1`
    - Update `listByPartId`: `ORDER BY sequence_number ASC`
    - Update `updateByPartAndStep` to update the latest entry (highest sequence_number)
    - _Requirements: 6.2, 6.3, 3.1, 3.2_

  - [x] 3.5 Update `server/repositories/sqlite/pathRepository.ts`
    - Update `StepRow` and `stepRowToDomain` to include `removed_at` and `completed_count`
    - Filter active steps: `WHERE removed_at IS NULL` in `getById` and `listByJobId` step queries
    - Add method to get step including soft-deleted: `getStepByIdIncludeRemoved`
    - Update `updateStep` to handle `removedAt` and `completedCount` fields
    - _Requirements: 14.3, 14.8, 15.1_

  - [x] 3.6 Write property test for Part repository round-trip with currentStepId
    - **Property 1: Part creation sets currentStepId to first step**
    - Test file: `tests/properties/stepIdPartCreation.property.test.ts`
    - **Validates: Requirements 1.2**

  - [x] 3.7 Write property test for query by currentStepId
    - **Property 5: Query by currentStepId returns correct parts**
    - Test file: `tests/properties/stepIdQuery.property.test.ts`
    - **Validates: Requirements 1.5, 9.1, 9.2**


- [x] 4. Checkpoint — Ensure migration and repository layer compile
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Service layer changes
  - [x] 5.1 Update `server/services/partService.ts`
    - `batchCreateParts`: set `currentStepId` to first step's ID instead of `currentStepIndex: 0`
    - `advancePart`: find current step by `part.currentStepId`, find next step by `order + 1`, set `currentStepId` to next step ID or `null` for completion; atomically increment origin step's `completedCount`; create routing history entry for new step
    - Replace `listPartsByStepIndex` with `listPartsByCurrentStepId(stepId)`
    - `listAllPartsEnriched`: use `currentStepId === null` for completed status, resolve `currentStepName` from step lookup by ID
    - _Requirements: 1.2, 2.1, 2.2, 7a.2, 7a.5, 7a.6, 9.2, 10.1, 10.2, 10.3, 15.2_

  - [x] 5.2 Update `server/services/lifecycleService.ts`
    - `initializeStepStatuses`: use `sequenceNumber: 1`, `enteredAt: now` for first step, `status: 'pending'` for rest
    - `advanceToStep`: accept `targetStepId` instead of `targetStepIndex`; look up current step by `part.currentStepId`; validate target step exists and is forward by `order`; classify bypassed steps between current and target by order; create routing history entries with incrementing sequence numbers; update `part.currentStepId`; increment `completedCount` on origin step
    - `scrapPart`: resolve current step from `part.currentStepId` instead of `path.steps[part.currentStepIndex]`
    - `forceComplete`: set `currentStepId: null` instead of `currentStepIndex: -1`
    - `canComplete`: update to work with step-ID-based status queries
    - `getStepStatuses`: update ordering to use `sequenceNumber`
    - _Requirements: 2.3, 2.4, 3.2, 3.3, 3.4, 4.2, 4.3, 5.1, 7a.2, 15.2_

  - [x] 5.3 Update `server/services/pathService.ts`
    - `reconcileSteps`: change from position-based to ID-based matching; inputs with `id` → match existing step by ID → `toUpdate`; inputs without `id` → generate new ID → `toInsert`; existing steps not in input → soft-delete (set `removed_at`) with active-part guard → `toSoftDelete`; all output steps get `order = position in input array`
    - `updatePath`: pass step IDs through to reconcileSteps, handle soft-delete instead of hard-delete
    - `getStepDistribution`: group parts by `currentStepId` instead of `currentStepIndex`; read `completedCount` from step directly instead of suffix-sum calculation; completed parts have `currentStepId === null`
    - `getPathCompletedCount`: count parts where `currentStepId IS NULL` instead of `listByStepIndex(pathId, -1)`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.3, 14.1, 14.2, 14.3, 15.3, 15.4, 7a.5_

  - [x] 5.4 Write property tests for advancement
    - **Property 2: Advancement past final step completes part**
    - **Property 4: Next-step resolution by order**
    - Test file: `tests/properties/stepIdAdvancement.property.test.ts`
    - **Validates: Requirements 1.3, 2.1, 2.2, 10.2, 10.4**

  - [x] 5.5 Write property test for step reorder invariance
    - **Property 3: Step reorder preserves currentStepId**
    - Test file: `tests/properties/stepIdReorderInvariance.property.test.ts`
    - **Validates: Requirements 1.4**

  - [x] 5.6 Write property test for routing history
    - **Property 6: Routing history is ordered and complete**
    - **Property 7: Step entry creates routing entry with incrementing sequence number**
    - **Property 8: Step completion updates the correct routing entry**
    - Test file: `tests/properties/routingHistory.property.test.ts`
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.6, 4.2, 4.3, 11.1, 11.4**

  - [x] 5.7 Write property test for bypassed/recycled steps
    - **Property 9: Bypassed steps get "skipped" routing entries**
    - **Property 10: Multiple visits produce distinct routing entries**
    - Test file: `tests/properties/routingHistorySkipRecycle.property.test.ts`
    - **Validates: Requirements 3.4, 3.5, 4.4, 5.1, 5.3**

  - [x] 5.8 Write property test for latest sequence query
    - **Property 11: Latest sequence number query returns most recent visit**
    - Test file: `tests/properties/latestSequenceQuery.property.test.ts`
    - **Validates: Requirements 6.3**

  - [x] 5.9 Write property test for reconcileSteps by ID
    - **Property 12: Reconcile steps by ID preserves step identity**
    - Test file: `tests/properties/reconcileStepsById.property.test.ts`
    - **Validates: Requirements 8.1, 8.2**

  - [x] 5.10 Write property test for step delete guard
    - **Property 13: Delete guard for steps with active parts**
    - **Property 19: Soft-deleted step blocks removal when active parts present**
    - Test file: `tests/properties/stepDeleteGuard.property.test.ts`
    - **Validates: Requirements 8.4, 14.2**

  - [x] 5.11 Write property test for step distribution
    - **Property 14: Step distribution groups by currentStepId**
    - Test file: `tests/properties/stepDistributionById.property.test.ts`
    - **Validates: Requirements 9.3**

  - [x] 5.12 Write property test for completed count
    - **Property 22: Completed count increments atomically on advancement**
    - **Property 23: Completed count survives reordering**
    - **Property 24: Reconciliation restores correct completed count**
    - Test file: `tests/properties/completedCountInvariant.property.test.ts`
    - **Validates: Requirements 15.1, 15.2, 15.4, 15.5, 15.7**


- [x] 6. Checkpoint — Ensure service layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. API route changes
  - [x] 7.1 Update `server/api/operator/step/[stepId].get.ts`
    - Replace `partService.listPartsByStepIndex(path.id, step.order)` with `partService.listPartsByCurrentStepId(step.id)`
    - Replace previous step WIP lookup to use `listPartsByCurrentStepId`
    - _Requirements: 9.1, 1.5_

  - [x] 7.2 Update `server/api/operator/work-queue.get.ts`
    - Replace `partService.listPartsByStepIndex(path.id, step.order)` with `partService.listPartsByCurrentStepId(step.id)`
    - _Requirements: 9.1_

  - [x] 7.3 Update `server/api/parts/[partId]/advance-to.post.ts` (or equivalent)
    - Accept `targetStepId` instead of `targetStepIndex` in request body
    - Pass `targetStepId` to `lifecycleService.advanceToStep`
    - _Requirements: 2.3_

  - [x] 7.4 Create Full Route API endpoint `server/api/parts/[partId]/full-route.get.ts`
    - New `GET /api/parts/:partId/full-route` endpoint
    - Fetch part, path (including soft-deleted steps for history), and all routing history entries
    - Build historical section: routing entries ordered by sequence_number
    - Build current section: entry with `isCurrent: true`
    - Build planned section: path steps with `order > current step order` that have no routing entry → status `'pending'`, `isPlanned: true`
    - Handle N/A steps: path steps with `order < current step order` and no routing entry → status `'na'`
    - Handle completed parts: all entries historical, no current/planned
    - Mark removed steps with `isRemoved: true`
    - Return `FullRouteResponse` shape
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 13.3, 13.4, 14.5_

  - [x] 7.5 Write property test for full route sections
    - **Property 15: Full route contains history, current, and planned sections**
    - **Property 16: Completed part full route has no planned entries**
    - Test file: `tests/properties/routingHistoryResponse.property.test.ts`
    - **Validates: Requirements 11.1, 11.4, 11.5, 11.6, 11.8, 12.1, 12.7**

  - [x] 7.6 Write property test for N/A steps
    - **Property 17: New step behind active part shows as na**
    - **Property 18: N/A steps do not block completion**
    - Test file: `tests/properties/naStepHandling.property.test.ts`
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6**

  - [x] 7.7 Write property test for soft-delete
    - **Property 20: Soft-deleted step preserves routing history**
    - **Property 21: Soft-deleted step excluded from active routing**
    - Test file: `tests/properties/stepSoftDelete.property.test.ts`
    - **Validates: Requirements 14.3, 14.4, 14.5, 14.7**

- [x] 8. Checkpoint — Ensure API layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Update existing tests referencing currentStepIndex
  - [x] 9.1 Update property tests
    - `tests/properties/stepAdvancement.property.test.ts`: update pure validation logic from index-based to step-ID-based
    - `tests/properties/countConservation.property.test.ts`: update step count logic for `currentStepId`
    - `tests/properties/partEnrichment.property.test.ts`: update `currentStepIndex === -1` checks to `currentStepId === null`
    - `tests/properties/roundTrip.property.test.ts`: update Part arbitrary to use `currentStepId` instead of `currentStepIndex`
    - `tests/properties/readonlyRoundTrip.property.test.ts`: update Part arbitrary
    - `tests/properties/malformedJson.property.test.ts`: update Part arbitrary and field references
    - `tests/properties/strictModeEnforcement.property.test.ts`: update validation logic to use step IDs
    - `tests/properties/backwardAdvancementRejection.property.test.ts`: update validation logic to use step IDs
    - `tests/properties/physicalDependencyBlock.property.test.ts`: update validation logic to use step IDs
    - _Requirements: 7a.1, 7a.2, 7a.3_

  - [x] 9.2 Update integration tests
    - `tests/integration/jobLifecycle.test.ts`: replace `currentStepIndex` assertions with `currentStepId` checks
    - `tests/integration/operatorView.test.ts`: update step query expectations
    - `tests/integration/flexibleAdvancement.test.ts`: replace `currentStepIndex` assertions with `currentStepId`
    - `tests/integration/forceComplete.test.ts`: replace `currentStepIndex: -1` with `currentStepId: null`
    - `tests/integration/progressTracking.test.ts`: update step position comments and assertions
    - `tests/integration/helpers.ts`: update `createTestContext` if needed for new repository methods
    - _Requirements: 7a.1, 7a.2, 7a.3_

  - [x] 9.3 Update unit tests
    - `tests/unit/services/partService.test.ts`: update all `currentStepIndex` references to `currentStepId`
    - Any other unit tests referencing the old field
    - _Requirements: 7a.1, 7a.2_


- [x] 10. Checkpoint — Ensure all existing tests pass with updated references
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Frontend changes
  - [x] 11.1 Update `app/composables/useLifecycle.ts`
    - `advanceToStep`: send `targetStepId` instead of `targetStepIndex` in request body
    - _Requirements: 2.3_

  - [x] 11.2 Create `app/composables/useFullRoute.ts`
    - New composable that fetches `GET /api/parts/:partId/full-route`
    - Returns reactive `entries`, `isCompleted`, `loading`, `error` refs
    - _Requirements: 11.1, 12.1_

  - [x] 11.3 Update `app/pages/parts-browser/[id].vue` — Part detail routing card
    - Replace index-based step iteration with Full Route API data
    - Use `useFullRoute` composable to fetch route entries on mount
    - Render historical entries with status badges (completed/skipped/deferred/waived), timestamps
    - Highlight current entry with primary color border and "In Progress" badge
    - Render planned entries with muted styling and "Pending" badge
    - Show "N/A" badge for steps added behind the part (status `'na'`)
    - Show `isRemoved` steps with strikethrough or "Removed" label
    - Show recycled steps as multiple entries
    - Show step order number for each entry
    - Replace `part.currentStepIndex === -1` checks with `part.currentStepId === null`
    - Replace `part.currentStepIndex === index` checks with `part.currentStepId === step.id`
    - Update `isCompleted` computed: `part.currentStepId === null`
    - Update `isInProgress` computed: `part.currentStepId !== null`
    - Update `currentStep` computed: find step by `part.currentStepId` instead of array index
    - Update `workQueueJob` computed: use `currentStepId`-based step lookup
    - Update sibling status checks: `currentStepId === null` for completed
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 13.3, 13.4, 14.5, 14.6, 7a.3, 7a.6_

  - [x] 11.4 Update `app/pages/parts/step/[stepId].vue`
    - No major changes needed (already uses step ID for routing)
    - Verify no `currentStepIndex` references remain
    - _Requirements: 9.1_

  - [x] 11.5 Update `app/pages/parts/index.vue`
    - Verify no `currentStepIndex` references remain (uses `usePartsView` which calls work queue API)
    - _Requirements: 9.1_

  - [x] 11.6 Update remaining frontend files referencing `currentStepIndex`
    - Search all `app/` files for `currentStepIndex` and update to `currentStepId`
    - Update `app/composables/usePartDetail.ts` if it references `currentStepIndex`
    - Update `app/composables/usePartsView.ts` if it references `currentStepIndex`
    - Update any components that check `currentStepIndex === -1` for completed status
    - _Requirements: 7a.3, 7a.6_

- [x] 12. Checkpoint — Ensure frontend compiles and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Update AI agent documentation
  - [x] 13.1 Update `.ai/architecture.md`
    - Document step-ID-based part tracking as canonical position tracking method
    - Document routing history model with append-only entries and sequence numbers
    - Document write-time counters as preferred pattern for derived counts
    - Document reconcileSteps ID-based matching strategy
    - Document soft-delete preference for entities with historical references
    - _Requirements: 16.1_

  - [x] 13.2 Update `.ai/data-model.md`
    - Update `parts` table: `current_step_id` replaces `current_step_index`
    - Update `process_steps` table: add `removed_at`, `completed_count`
    - Update `part_step_statuses` table: `sequence_number` replaces `step_index`, add `entered_at`, `completed_at`, no UNIQUE constraint
    - Update domain type descriptions
    - _Requirements: 16.2_

  - [x] 13.3 Verify `.kiro/steering/separation-of-concerns.md` is up to date
    - Confirm soft-delete preference is documented (already present)
    - Confirm write-time counter preference is documented (already present)
    - Confirm step-ID-based tracking is documented (already present)
    - Confirm append-only routing history is documented (already present)
    - _Requirements: 16.3_

- [x] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm run test` and verify all tests pass with zero failures.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The implementation proceeds bottom-up: migration → types → repos → services → API → frontend → docs
- The completed sentinel changes from `-1` to `NULL` — this touches ~15+ files across all layers
- Migration 007 uses create-copy-drop-rename for SQLite table rebuilds (production-safe)
- `reconcileSteps` changes from position-based to ID-based matching — this is a significant logic change
- Step distribution "done" count changes from suffix-sum to write-time counter read
- The Full Route API is a new endpoint that merges routing history + path steps
- Frontend routing card on part detail page switches from index-based iteration to Full Route API
- AI documentation updates are last because they describe the final state of the system
