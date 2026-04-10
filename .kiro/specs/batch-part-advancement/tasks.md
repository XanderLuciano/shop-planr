# Implementation Plan: Batch Part Advancement

## Overview

Replace the N-sequential-HTTP-call advancement pattern with a single batch endpoint, fix race conditions, add double-click prevention, correct skip-step origin status tracking, introduce admin-only advanced options UI, and wire DeferredStepsList into Step View. All advancement flows converge on `POST /api/parts/advance`.

## Tasks

- [x] 1. Batch advance schema, service method, and API route
  - [x] 1.1 Add `batchAdvanceSchema` to `server/schemas/partSchemas.ts`
    - Zod schema: `partIds` array of 1–100 non-empty strings
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 1.2 Add `batchAdvanceParts` method to `server/services/partService.ts`
    - Iterate `partIds`, call `advancePart(id, userId)` in try/catch per part
    - Return `{ advanced, failed, results }` with one entry per input ID
    - Validate non-empty array and ≤100 size limit
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.3 Create `server/api/parts/advance.post.ts` API route
    - Use `parseBody(event, batchAdvanceSchema)` and `getAuthUserId(event)`
    - Delegate to `partService.batchAdvanceParts(partIds, userId)`
    - _Requirements: 1.1, 1.5_

  - [x] 1.4 Write unit tests for `batchAdvanceParts` in `tests/unit/services/partService.test.ts`
    - All succeed, partial failure, empty array → ValidationError, >100 → ValidationError
    - Results length always equals input length, advanced + failed = total
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.5 Write unit tests for `batchAdvanceSchema` in `tests/unit/schemas/partSchemas.test.ts`
    - Valid arrays pass, empty array rejected, empty strings rejected, >100 rejected
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 1.6 Write property test: batch result completeness
    - **Property 1: Batch result completeness**
    - For any array of part IDs, `results.length === partIds.length` and `advanced + failed === partIds.length`
    - **Validates: Requirements 2.1, 2.2**

  - [x] 1.7 Write property test: independent failure isolation
    - **Property 2: Independent failure isolation**
    - For any batch with mix of valid/invalid IDs, valid parts advance regardless of failures
    - **Validates: Requirements 2.4, 2.5**

  - [x] 1.8 Write property test: schema boundary enforcement
    - **Property 3: Schema boundary enforcement**
    - batchAdvanceSchema accepts 1–100 non-empty strings, rejects empty/oversized/empty-string arrays
    - **Validates: Requirements 1.2, 1.3, 1.4**

- [x] 2. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Client composable update and useGuardedAction
  - [x] 3.1 Rewrite `app/composables/useAdvanceBatch.ts` to make a single POST to `/api/parts/advance`
    - Replace the per-part loop with one `$api('/api/parts/advance', { method: 'POST', body: { partIds } })` call
    - Keep client-side `partIds.length > availablePartCount` guard
    - Keep note creation as separate POST after advancement succeeds
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Create `app/composables/useGuardedAction.ts`
    - ~15 lines: wraps async fn, `loading` ref, `execute()` returns `undefined` if already loading
    - Set `loading = true` synchronously, reset in `finally`, re-throw errors
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 3.3 Write property test: guarded action concurrent rejection
    - **Property 6: Guarded action concurrent rejection**
    - Calling execute while loading is true returns undefined without invoking fn
    - Loading set synchronously before fn, reset after completion, errors re-thrown
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

- [x] 4. Fix PartCreationPanel race condition
  - [x] 4.1 Fix `handleCreateAndAdvance` in `app/components/PartCreationPanel.vue`
    - Add `if (creating.value) return` guard at top of both `handleCreate` and `handleCreateAndAdvance`
    - Ensure `creating.value = true` is set synchronously before any async work
    - Emit `created` then `advance` sequentially (already the case, but verify `finally` block resets `creating`)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. Migrate Part Detail Page and Job Parts Tab to batch endpoint
  - [x] 5.1 Update `handleAdvance` in `app/pages/parts-browser/[id].vue`
    - Replace `for (const sid of payload.partIds) { await advancePart(sid) }` loop with single `POST /api/parts/advance`
    - Remove `useParts().advancePart` usage
    - _Requirements: 5.1, 5.2_

  - [x] 5.2 Update `handleQuickAdvance` in `app/components/JobPartsTab.vue`
    - Replace `useParts().advancePart(partId)` with `$api('/api/parts/advance', { method: 'POST', body: { partIds: [partId] } })`
    - Remove `useParts()` import
    - _Requirements: 6.1, 6.2_

  - [x] 5.3 Remove `advancePart` from `app/composables/useParts.ts`
    - Delete the function and its export; all callers now use the batch endpoint
    - _Requirements: 7.1_

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Skip-step origin status fix
  - [x] 7.1 Add optional `skip?: boolean` to `AdvanceToStepInput` in `server/types/api.ts`
    - _Requirements: 10.1, 10.2_

  - [x] 7.2 Update `advanceToStep` in `server/services/lifecycleService.ts` step 8
    - When `skip: true` and origin is optional/overridden → mark origin as `'skipped'`, do NOT increment `completedCount`
    - When `skip: true` and origin is required → mark origin as `'deferred'`, do NOT increment `completedCount`
    - When `skip` is false/omitted → existing behavior (mark `'completed'`, increment `completedCount`)
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 7.3 Update `executeSkip` in `app/utils/skipStep.ts` to pass `skip: true`
    - Change `advanceToStep(partId, { targetStepId })` to `advanceToStep(partId, { targetStepId, skip: true })`
    - _Requirements: 11.1_

  - [x] 7.4 Write property test: skip origin status classification
    - **Property 7: Skip origin status classification**
    - advanceToStep with skip:true → origin marked 'skipped' (optional/overridden) or 'deferred' (required)
    - advanceToStep with skip:false/omitted → origin marked 'completed'
    - **Validates: Requirements 9.1, 9.2, 9.4, 10.2**

  - [x] 7.5 Write property test: skip completedCount invariant
    - **Property 8: Skip completedCount invariant**
    - skip:true → completedCount unchanged; skip:false/omitted → completedCount +1
    - **Validates: Requirements 9.3, 9.4**

  - [x] 7.6 Write property test: canComplete ignores optional steps
    - **Property 9: canComplete ignores optional steps and blocks on deferred required steps**
    - Optional steps excluded regardless of status; required 'deferred' blocks; required 'waived' does not block
    - **Validates: Requirements 12.1, 12.2, 12.3**

- [x] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. WorkQueueJob type extension and Step View endpoint
  - [x] 9.1 Add `pathAdvancementMode` and `pathSteps` fields to `WorkQueueJob` in `server/types/computed.ts`
    - `pathAdvancementMode?: 'strict' | 'flexible' | 'per_step'`
    - `pathSteps?: readonly { id: string, name: string, order: number, location?: string, optional: boolean }[]`
    - _Requirements: 15.1, 15.2_

  - [x] 9.2 Populate the new fields in the step view endpoint and work queue assembly
    - Include path advancement mode and step list when building `WorkQueueJob` objects
    - _Requirements: 15.1, 15.2_

- [x] 10. Admin-only Advanced Options UI in ProcessAdvancementPanel
  - [x] 10.1 Remove the standalone "Skip" button from `app/components/ProcessAdvancementPanel.vue`
    - Remove the `v-if="shouldShowSkip(...)"` button and the `handleSkip` function
    - _Requirements: 13.1_

  - [x] 10.2 Add collapsible "Advanced options" section to `ProcessAdvancementPanel.vue`
    - Disclosure toggle below main action buttons, collapsed by default
    - Only visible to admin users via `useAuth().isAdmin`
    - Contains skip-to-step `USelect` dropdown populated from `job.pathSteps`
    - Shows bypass preview with Skip/Defer badges for intermediate steps
    - "Skip Selected Parts" button calls `advanceToStep` with `skip: true` for each selected part
    - Collapse and reset when step changes
    - In strict mode, only show the immediate next step in the dropdown
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [x] 10.3 Write property test: bypass preview classification
    - **Property 10: Bypass preview classification**
    - Each intermediate step classified as 'Skip' (optional/overridden) or 'Defer' (required)
    - **Validates: Requirement 13.4**

- [x] 11. DeferredStepsList on Step View
  - [x] 11.1 Wire `DeferredStepsList` into `app/pages/parts/step/[stepId].vue`
    - Fetch step statuses for parts at the current step
    - Display DeferredStepsList below the advancement panel when deferred steps exist
    - Refresh step data when a deferred step is completed or waived
    - _Requirements: 14.1, 14.2_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The existing single-part `POST /api/parts/:id/advance` route is kept for backward compatibility but is no longer called by the frontend
- All code follows project coding standards: `defineApiHandler`, `parseBody`, `useAuthFetch`, no `any`, single quotes, 2-space indent
