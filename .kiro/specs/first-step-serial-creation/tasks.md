# Implementation Plan: First Step Serial Creation

## Overview

Add a `SerialCreationPanel` component for the first step (stepOrder === 0) in the operator work queue. The operator page conditionally renders this panel instead of `ProcessAdvancementPanel` when viewing a first step. The panel lets operators spawn batches of serial numbers, view accumulated serials, select and advance them, and use a combined "Create & Advance" shortcut. No backend changes — reuses existing `useSerials().batchCreateSerials()` and `useWorkQueue().advanceBatch()`. Tech stack: Vue 3 / TypeScript / Nuxt UI 4.

## Tasks

- [x] 1. Create the `SerialCreationPanel` component
  - [x] 1.1 Create `app/components/SerialCreationPanel.vue`
    - Accept props: `job: WorkQueueJob`, `loading: boolean`
    - Emit events: `advance` (payload: `{ serialIds: string[], note?: string }`), `cancel`, `created` (count: number)
    - Internal state: `quantity` (default 1), `creating`, `selectedSerials`, `note`, `validationError`, `successMessage`, `errorMessage`
    - Template sections (top to bottom):
      1. Header — job name, path name, step name, step location
      2. Destination info — next step name + location, or "Completed" if final step
      3. Creation form — numeric quantity input (min 1, default 1), "Create" button, "Create & Advance" button
      4. Success/error messages (transient inline banners)
      5. Accumulated serials list — checkboxes per serial ID (from `job.serialIds`), Select All / Select None controls, total count display
      6. Empty state — message when no accumulated serials exist
      7. Note input — optional textarea with 1000 char max and character counter
      8. Advance action — button showing selected count, disabled when none selected
    - "Create" action: call `useSerials().batchCreateSerials()` with `{ jobId, pathId, quantity, userId }`, then `useWorkQueue().fetchQueue(userId)` to refresh, emit `created`
    - "Create & Advance" action: create batch, then emit `advance` with newly created serial IDs
    - Quantity validation: values < 1 show inline error and disable submit controls
    - Loading states: `creating` disables creation controls; `loading` prop disables advance controls
    - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.8, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 10.1, 10.2_

  - [x] 1.2 Write unit tests for `SerialCreationPanel`
    - Test default quantity is 1 (Req 2.6)
    - Test create button calls batchCreateSerials with correct parameters (Req 2.3)
    - Test success message appears after creation (Req 2.4)
    - Test error message appears on creation failure (Req 2.5)
    - Test empty state shown when no serials exist (Req 3.5)
    - Test Select All selects all serials (Req 4.2)
    - Test Select None deselects all serials (Req 4.3)
    - Test Create & Advance button triggers both operations (Req 6.1, 6.2)
    - Test Create & Advance success message includes count and destination (Req 6.3)
    - Test partial failure during Create & Advance shows error (Req 6.4)
    - Test note textarea exists with placeholder (Req 8.1)
    - Test creation form remains available after batch creation (Req 5.2)
    - Test file: `tests/unit/components/SerialCreationPanel.test.ts`
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 3.5, 4.2, 4.3, 5.2, 6.1, 6.2, 6.3, 6.4, 8.1_

- [x] 2. Checkpoint — Ensure new component compiles and unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Modify `operator.vue` to conditionally render panels
  - [x] 3.1 Add conditional rendering in `app/pages/operator.vue`
    - When `selectedJob.stepOrder === 0`, render `SerialCreationPanel` instead of `ProcessAdvancementPanel`
    - Pass `:job="selectedJob"`, `:loading="advanceLoading"` to `SerialCreationPanel`
    - Wire `@advance="handleAdvance"`, `@cancel="handleCancelJob"`, `@created="handleCreated"` events
    - Add `handleCreated(count: number)` function that shows a success toast with the created count
    - Keep existing `ProcessAdvancementPanel` rendering for `stepOrder !== 0` with `v-else-if`
    - _Requirements: 1.1, 1.2, 1.3, 4.5, 4.6, 4.7, 5.4_

- [x] 4. Checkpoint — Ensure operator page renders both panels correctly and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Write property-based tests for first step serial creation
  - [x] 5.1 Write property test: Panel type selection based on step order
    - **Property 1: Panel type selection based on step order**
    - Generate random `WorkQueueJob` with varying `stepOrder`; assert `SerialCreationPanel` rendered when `stepOrder === 0`, `ProcessAdvancementPanel` otherwise
    - **Validates: Requirements 1.1, 1.2, 1.3**
    - Test file: `tests/properties/firstStepSerialCreation.property.test.ts`

  - [x] 5.2 Write property test: Context display contains job, path, and step names
    - **Property 2: Context display contains job, path, and step names**
    - Generate random job/path/step name strings; assert all appear in rendered output
    - **Validates: Requirements 2.2**
    - Test file: `tests/properties/firstStepSerialCreation.property.test.ts`

  - [x] 5.3 Write property test: Accumulated serials rendering and count
    - **Property 3: Accumulated serials rendering and count**
    - Generate random `serialIds` arrays (0 to N); assert all IDs rendered and count matches; empty state when N = 0
    - **Validates: Requirements 3.1, 3.3, 3.4, 3.5**
    - Test file: `tests/properties/firstStepSerialCreation.property.test.ts`

  - [x] 5.4 Write property test: Invalid quantity rejection
    - **Property 4: Invalid quantity rejection**
    - Generate random integers < 1; assert validation error shown and submit disabled
    - **Validates: Requirements 2.7**
    - Test file: `tests/properties/firstStepSerialCreation.property.test.ts`

  - [x] 5.5 Write property test: Selection state drives advance payload and button state
    - **Property 5: Selection state drives advance payload and button state**
    - Generate random `serialIds` and random subsets; assert advance payload matches selection, count display correct, button disabled when K = 0
    - **Validates: Requirements 4.4, 4.5, 4.8**
    - Test file: `tests/properties/firstStepSerialCreation.property.test.ts`

  - [x] 5.6 Write property test: Destination display matches WorkQueueJob fields
    - **Property 6: Destination display matches WorkQueueJob fields**
    - Generate random `WorkQueueJob` with varying `isFinalStep`/`nextStepName`/`nextStepLocation`; assert destination text
    - **Validates: Requirements 7.1, 7.2, 7.3**
    - Test file: `tests/properties/firstStepSerialCreation.property.test.ts`

  - [x] 5.7 Write property test: Note character count and limit enforcement
    - **Property 7: Note character count and limit enforcement**
    - Generate random strings of varying length; assert character count display equals string length, max 1000
    - **Validates: Requirements 8.3, 8.4**
    - Test file: `tests/properties/firstStepSerialCreation.property.test.ts`

  - [x] 5.8 Write property test: Loading states disable corresponding controls
    - **Property 8: Loading states disable corresponding controls**
    - Generate random boolean states for `creating`/`loading`; assert button disabled states match
    - **Validates: Requirements 10.1, 10.2**
    - Test file: `tests/properties/firstStepSerialCreation.property.test.ts`

- [x] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- No backend changes — all work is in the UI layer
- The `SerialCreationPanel` component (task 1.1) is the foundation — build it first, then wire it into the operator page
- All eight property tests go in a single file (`firstStepSerialCreation.property.test.ts`)
- The serial detail page (`serials/[id].vue`) is NOT modified — it continues using `ProcessAdvancementPanel` at step 0 (Requirement 9)
