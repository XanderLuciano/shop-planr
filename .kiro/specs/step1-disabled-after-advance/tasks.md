# Implementation Plan: Step 1 Disabled After Advance Bugfix

## Overview

Fix the `GET /api/operator/step/[stepId]` endpoint and `GET /api/operator/queue/_all` endpoint so that valid process steps with zero active serials return proper responses instead of 404. The first step (step_order = 0) must always be accessible for serial creation, and non-first steps with zero serials should show a "waiting for prior step" state with the previous step's WIP count. Uses the bug condition methodology: explore the bug with failing tests, write preservation tests, then implement the fix and verify.

## Tasks

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** — First Step Always Accessible
  - **Property 2: Bug Condition** — Non-First Step Returns WIP Context
  - **Property 3: Bug Condition** — First Step Included in Parts View
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - Test file: `tests/properties/step1DisabledBugCondition.property.test.ts`
  - Duplicate the step lookup logic from `server/api/operator/step/[stepId].get.ts` and the `_all` aggregation logic from `server/api/operator/queue/_all.get.ts` as pure functions (UNFIXED versions)
  - **Test 1 — First step with zero serials**: Generate random job configs with 1–5 steps and 1–8 serials. Advance ALL serials past step 0. Call the unfixed `lookupStep` for step 0. Assert it returns a non-null result with `partCount: 0`. This will FAIL because unfixed code returns null (404) when `serials.length === 0`.
  - **Test 2 — Non-first step waiting for upstream**: Generate random job configs with 2+ steps. Create serials at step 0 (don't advance any). Call the unfixed `lookupStep` for step 1. Assert it returns a non-null result with `partCount: 0`. This will FAIL because unfixed code returns null (404).
  - **Test 3 — Parts View includes first step**: Generate random job configs, advance all serials past step 0. Call the unfixed `aggregateAllWork`. Assert step 0 appears in the response. This will FAIL because unfixed code skips steps with zero serials.
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: All three tests FAIL (this proves the bug exists)
  - Document counterexamples found
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 2.1, 2.3, 2.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 4: Preservation** — Steps With Active Serials Unchanged
  - **Property 5: Preservation** — Invalid Step IDs Still 404
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `tests/properties/step1DisabledPreservation.property.test.ts`
  - **Test 1 — Active serial steps unchanged**: Generate random job/path/serial configs where steps have active serials. Call the unfixed `lookupStep`. Record the response shape and values. Assert `partCount > 0`, `serialIds` matches expected serials, and all metadata fields are correct. Verify tests pass on UNFIXED code.
  - **Test 2 — Invalid step IDs return null**: Generate random non-existent step IDs (e.g., `step_XXXXXXXXX`). Call the unfixed `lookupStep`. Assert it returns null (404). Verify tests pass on UNFIXED code.
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 3. Implement the fix
  - [x] 3.1 Update types in `server/types/computed.ts`
    - Add optional `previousStepWipCount?: number` field to the `StepViewResponse` interface
    - Add optional `previousStepId?: string` and `previousStepName?: string` fields to `WorkQueueJob`
    - Add optional `nextStepId?: string` field to `WorkQueueJob` (note: `nextStepName` already exists)
    - _Requirements: 2.4, 2.5, 2.7, 2.8_

  - [x] 3.2 Fix `[stepId].get.ts` to return 200 for valid steps with zero serials
    - File: `server/api/operator/step/[stepId].get.ts`
    - Remove the `if (serials.length === 0) { throw new NotFoundError('No active parts at this step') }` block
    - Always build the `WorkQueueJob` response with `serialIds: serials.map(s => s.id)` and `partCount: serials.length` (which will be `[]` and `0` when no serials exist)
    - When `step.order > 0` and `serials.length === 0`, look up the previous step (`path.steps[step.order - 1]`) and count its serials via `serialService.listSerialsByStepIndex(path.id, step.order - 1)`. Include this count as `previousStepWipCount` in the `StepViewResponse`.
    - Populate `previousStepId` and `previousStepName` from `path.steps[step.order - 1]` when `step.order > 0`
    - Populate `nextStepId` from `path.steps[step.order + 1]` when not the final step
    - Keep the final `if (!foundJob) { throw new NotFoundError('ProcessStep not found') }` for truly invalid step IDs
    - _Requirements: 2.1, 2.4, 2.7, 3.1_

  - [x] 3.3 Fix `_all.get.ts` to include first steps with zero serials
    - File: `server/api/operator/queue/_all.get.ts`
    - Change `if (serials.length === 0) continue` to `if (serials.length === 0 && step.order !== 0) continue`
    - This ensures first steps always appear in the Parts View, even with zero serials
    - _Requirements: 2.3_

  - [x] 3.4 Update `[stepId].vue` to handle zero-serial states and deduplicate header
    - File: `app/pages/parts/step/[stepId].vue`
    - Remove the duplicate step header that appears inside the panel components — the page-level header is the single source of truth
    - Add "Step X of Y" indicator next to the step name in the page header
    - Add prev/next step navigation buttons below the header: "← Prev" links to `previousStepId` (disabled when `stepOrder === 0`), "Next →" links to `nextStepId` (disabled when `isFinalStep`)
    - Modify the "all advanced" empty state condition: when `job.stepOrder === 0` and `job.partCount === 0`, show the `SerialCreationPanel` instead of the "All parts advanced" empty state
    - Add a new "waiting for prior step" state: when `job.stepOrder > 0` and `job.partCount === 0`, show a message with the previous step name and WIP count (from `StepViewResponse.previousStepWipCount`)
    - _Requirements: 2.2, 2.5, 2.6, 2.7, 2.8_

  - [x] 3.5 Remove duplicate header from `SerialCreationPanel.vue`
    - File: `app/components/SerialCreationPanel.vue`
    - Remove the header `<div>` that renders step name, job name, path name, location, and the close button — this info is now owned by the parent page
    - _Requirements: 2.6_

  - [x] 3.6 Remove duplicate header from `ProcessAdvancementPanel.vue`
    - File: `app/components/ProcessAdvancementPanel.vue`
    - Remove the header `<div>` that renders step name, job name, path name, location, and the close button — this info is now owned by the parent page
    - _Requirements: 2.6_

  - [x] 3.7 Update `useStepView.ts` to expose new fields
    - File: `app/composables/useStepView.ts`
    - Add `previousStepWipCount`, `previousStepId`, `previousStepName`, and `nextStepId` refs to the composable
    - Populate them from the API response when present
    - Return them as readonly refs
    - _Requirements: 2.5, 2.7_

  - [x] 3.8 Verify bug condition exploration tests now pass
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - Update the replicated `lookupStep` and `aggregateAllWork` functions in the test file to match the FIXED logic
    - Run bug condition exploration tests from task 1
    - **EXPECTED OUTCOME**: All three tests PASS (confirms bug is fixed)
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 3.9 Verify preservation tests still pass
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from task 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - _Requirements: 3.1, 3.2, 3.4_

- [x] 4. Update existing tests that replicate the old (buggy) logic
  - Update `tests/properties/stepEndpoint.property.test.ts`: the replicated `lookupStep` function returns `null` for zero serials — update it to match the fixed behavior (return valid response with `partCount: 0`)
  - Update `tests/properties/invalidStepRejection.property.test.ts`: if it asserts that zero-serial steps return null, update to match fixed behavior
  - Update `tests/unit/services/workQueue.test.ts`: the replicated `lookupStep` and `aggregateAllWork` functions need to match the fixed logic
  - Update `tests/integration/operatorViewRedesign.test.ts`: the replicated functions need to match the fixed logic
  - Run all updated tests to verify they pass
  - _Requirements: 3.2, 3.3, 3.4_

- [x] 5. Checkpoint — Ensure all tests pass
  - Run `npx vitest run` to verify all tests pass
  - Ensure the existing property tests (stepEndpoint, invalidStepRejection, allWorkEndpoint, etc.) still pass
  - Ensure all unit and integration tests are unaffected
  - Ask the user if questions arise
