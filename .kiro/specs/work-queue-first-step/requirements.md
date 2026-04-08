# Requirements: Work Queue Shows First Step + Queue Cleanup

## Definitions

- **Work_Queue_Page**: The `/queue` page that displays active work entries grouped by a chosen dimension (user, location, step)
- **Parts_View_Page**: The `/parts` page that displays a flat list of all active work entries
- **Work_Queue_Grouped_Endpoint**: `GET /api/operator/work-queue` — returns `WorkQueueGroupedResponse`
- **Work_Queue_All_Endpoint**: `GET /api/operator/queue/_all` — returns `WorkQueueResponse`
- **Work_Queue_User_Endpoint**: `GET /api/operator/queue/[userId]` — returns `WorkQueueResponse` (dead code, to be deleted)
- **First_Active_Step**: The first step in a path's `steps` array where `!step.removedAt` (i.e., the first non-soft-deleted step)
- **CompletedCount**: The `completedCount` field on `ProcessStep` — a write-time counter incremented each time a part advances past that step
- **GoalQuantity**: The `goalQuantity` field on `Path` — the target number of parts to fabricate for that pathway
- **WorkQueueJob**: The computed type representing a single step entry in the work queue response
- **useWorkQueue**: The existing composable at `app/composables/useWorkQueue.ts` containing `fetchQueue()` and `advanceBatch()`
- **useAdvanceBatch**: The new composable to be created at `app/composables/useAdvanceBatch.ts` containing only `advanceBatch()`

## Requirements

### 1. First-Step Inclusion

1.1. WHEN the Work_Queue_Grouped_Endpoint or Work_Queue_All_Endpoint assembles work queue entries, AND a path's First_Active_Step has `completedCount < goalQuantity`, THEN that step MUST be included in the response even if it has zero parts currently present (`partCount === 0`).

1.2. WHEN the First_Active_Step has `completedCount >= goalQuantity`, THEN that step MUST follow the standard inclusion rule: include only if `partCount > 0`.

1.3. FOR all non-first-active steps (any step that is not the First_Active_Step), the inclusion rule MUST remain unchanged: include if and only if `partCount > 0`.

### 2. First Active Step Identification

2.1. THE First_Active_Step MUST be identified as the step with the lowest `order` value among non-soft-deleted steps (`!step.removedAt`) in the path's `steps` array.

2.2. IF step 0 is soft-deleted (`removedAt` is set), THEN the next non-soft-deleted step (e.g., step 1) MUST inherit the first-step treatment.

2.3. IF all steps in a path are soft-deleted, THEN no step receives first-step treatment and the path produces no work queue entries.

### 3. Soft-Delete Filtering

3.1. ALL three work queue entry assembly loops (grouped endpoint, flat `_all` endpoint, and any replicated test logic) MUST skip steps where `step.removedAt` is set. Soft-deleted steps MUST NOT appear in work queue responses.

3.2. Soft-deleted steps MUST NOT be considered when determining the First_Active_Step.

### 4. WorkQueueJob Type Changes

4.1. THE `WorkQueueJob` interface in `server/types/computed.ts` MUST gain an optional `goalQuantity?: number` field.

4.2. THE `WorkQueueJob` interface MUST gain an optional `completedCount?: number` field.

4.3. FOR WorkQueueJob entries representing the First_Active_Step, `goalQuantity` MUST be set to the parent path's `goalQuantity` and `completedCount` MUST be set to the step's `completedCount`.

4.4. FOR all other WorkQueueJob entries (non-first-active steps), `goalQuantity` and `completedCount` MUST be `undefined`.

### 5. Endpoint Consistency

5.1. THE Work_Queue_Grouped_Endpoint and Work_Queue_All_Endpoint MUST produce identical first-step inclusion decisions for the same job/path/step data.

5.2. THE Work_Queue_All_Endpoint's existing hardcoded `step.order !== 0` check MUST be replaced with the First_Active_Step predicate using `completedCount`.

### 6. Frontend Display

6.1. THE Work_Queue_Page (`queue.vue`) and Parts_View_Page (`parts/index.vue` via `WorkQueueList`) MUST display the existing `partCount` badge for ALL entries, including first-active-step entries.

6.2. FOR first-active-step entries (where `goalQuantity` is defined), the UI MUST additionally display progress text showing `completedCount / goalQuantity completed` alongside the part count badge. Both indicators MUST be visible simultaneously.

6.3. FOR normal steps (where `goalQuantity` is undefined), the existing `partCount` badge display MUST remain unchanged with no additional progress text.

### 7. Dead Endpoint Removal

7.1. THE file `server/api/operator/queue/[userId].get.ts` MUST be deleted.

7.2. THE file `content/api-docs/operator/queue-user.md` MUST be deleted.

7.3. THE file `content/api-docs/operator/index.md` MUST be updated to remove the "User queue" entry from the endpoint table.

7.4. THE files `content/api-docs/operator/queue-all.md` and `content/api-docs/operator/work-queue.md` MUST be updated to remove references to the deleted user queue endpoint.

### 8. Composable Migration

8.1. THE file `app/composables/useWorkQueue.ts` MUST be deleted.

8.2. A new file `app/composables/useAdvanceBatch.ts` MUST be created containing only the `advanceBatch()` function extracted from `useWorkQueue.ts`.

8.3. THE `advanceBatch()` function MUST accept an `availablePartCount` parameter so callers can provide the known part count for client-side validation. WHEN `partIds.length > availablePartCount`, the function MUST throw an error with a user-friendly message (e.g., "Cannot advance N parts — only M available") before making any API calls.

8.4. THE file `app/pages/parts/step/[stepId].vue` MUST be updated to use `useAdvanceBatch().advanceBatch` instead of `useWorkQueue().advanceBatch`, passing `job.partCount` as the `availablePartCount` parameter. The `handleAdvance` function MUST resolve `nextStepName` locally from `job.value` (which it already has in scope) instead of reading it from the `advanceBatch` return value. The new `advanceBatch` returns `{ advanced: number }` only — it does not echo back job metadata the caller already owns.

8.5. AFTER cleanup, no file in `app/` or `server/` SHALL import from `useWorkQueue` or reference `GET /api/operator/queue/[userId]`.

### 9. WorkQueueResponse operatorId Removal

9.1. THE `operatorId` field MUST be removed from the `WorkQueueResponse` interface in `server/types/computed.ts`. After the `[userId]` endpoint deletion, this field is always `"_all"` and carries no information.

9.2. THE Work_Queue_All_Endpoint (`_all.get.ts`) MUST stop including `operatorId` in its response object.

9.3. ALL property tests and integration tests that construct or assert on `WorkQueueResponse` MUST be updated to remove `operatorId` references.

9.4. THE `usePartsView` composable and any other frontend consumers of `WorkQueueResponse` MUST NOT break from this removal (verified: `usePartsView` does not read `operatorId`).

9.5. THE content documentation for the `_all` endpoint (`content/api-docs/operator/queue-all.md`) MUST be updated to remove `operatorId` from the documented response shape.

### 10. Test Alignment

10.1. THE file `tests/properties/workQueueAggregation.property.test.ts` MUST be updated to replicate the `_all` endpoint logic (not the deleted `[userId]` endpoint), including first-step inclusion and soft-delete filtering.

10.2. THE file `tests/properties/allWorkEndpoint.property.test.ts` MUST be updated to include the first-step inclusion behavior in its replicated logic.

10.3. THE file `tests/properties/assigneeGrouping.property.test.ts` MUST be updated to include soft-delete filtering and first-step inclusion in its replicated logic.

### 11. Content Documentation

11.1. THE file `content/api-docs/operator/queue-all.md` MUST be updated to document the new first-step behavior (first active step included when `completedCount < goalQuantity`, with `goalQuantity` and `completedCount` fields) and to remove `operatorId` from the documented response shape.

11.2. THE file `content/api-docs/operator/work-queue.md` MUST be updated to document the new first-step behavior and the new `goalQuantity`/`completedCount` fields on `WorkQueueJob`.

### 12. AI Map Updates

12.1. AFTER implementation, `AI-MAP.md` MUST be updated to reflect the removal of the `[userId]` queue endpoint, the removal of `operatorId` from `WorkQueueResponse`, the new `useAdvanceBatch` composable, and the first-step visibility feature.
