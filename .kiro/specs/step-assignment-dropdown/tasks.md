# Implementation Plan: Step Assignment Dropdown Bugfix

## Overview

Fix the `handleSelection` type mismatch in `StepAssignmentDropdown.vue` where `USelectMenu` with `value-key="value"` emits a raw string but the handler expects a `SelectMenuItem` object. Move the dropdown into `StepTracker` and widen step columns. Uses the bug condition methodology: explore the bug with a failing test, write preservation tests, then implement the fix and verify.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - handleSelection Sends Correct userId
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: any non-null string userId passed to handleSelection's value extraction logic
  - Test file: `tests/properties/stepAssignmentBugCondition.property.test.ts`
  - Duplicate the value extraction logic from `handleSelection` in `StepAssignmentDropdown.vue` (the unfixed version: `const userId = item?.value ?? null` where `item` is typed as `SelectMenuItem | null`)
  - Generate random non-null string userIds via `fast-check` and pass them through the UNFIXED extraction logic
  - Assert that the extracted userId equals the input string (this will FAIL because `"someString"?.value` is `undefined`, falling through to `null`)
  - Also test with `null` input — assert extracted value is `null` (this passes by coincidence on unfixed code)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS for non-null string inputs (this proves the bug exists)
  - Document counterexamples found (e.g., `extractUserId("user_abc")` returns `null` instead of `"user_abc"`)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Assignment Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `tests/properties/stepAssignmentPreservation.property.test.ts`
  - Observe on UNFIXED code: `filterDropdownOptions` continues to return "Unassigned" first, then active users matching search (already validated by existing `dropdownFilter.property.test.ts`)
  - Observe on UNFIXED code: null input to extraction logic returns `null` (unassign behavior preserved)
  - Write property-based test: for all `null` inputs, the extraction logic returns `null` (preservation of unassign behavior)
  - Write property-based test: for all user lists and search strings, `filterDropdownOptions` returns "Unassigned" first + matching active users (preservation of dropdown filter behavior — mirrors existing Property 4 but scoped to preservation context)
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix for handleSelection type mismatch and StepTracker integration

  - [x] 3.1 Fix handleSelection parameter type in StepAssignmentDropdown.vue
    - Change `handleSelection(item: SelectMenuItem | null)` to `handleSelection(value: string | null)`
    - Change `const userId = item?.value ?? null` to `const userId = value`
    - The `SelectMenuItem` import stays because it's used by `filterDropdownOptions` return type and `menuItems` computed
    - _Bug_Condition: isBugCondition(input) where typeof input.handlerReceives === 'string' AND input.handlerReceives.value === undefined_
    - _Expected_Behavior: handleSelection(value) sends value directly as userId to PATCH /api/steps/{id}/assign_
    - _Preservation: filterDropdownOptions, optimistic update/revert, error toast, assigned event emission unchanged_
    - _Requirements: 1.1, 1.2, 2.1, 2.2_

  - [x] 3.2 Move StepAssignmentDropdown into StepTracker component
    - Add new props to StepTracker: `users` (`ShopUser[]`, default `[]`) and `stepAssignments` (`Record<string, string | undefined>`, optional)
    - Add `assigned` emit to StepTracker: `assigned: [stepId: string, userId: string | null]`
    - Inside each step column `<div>` (the `v-for` over `distribution`), render `<StepAssignmentDropdown>` below existing step data
    - Pass `:step-id="step.stepId"`, `:current-assignee="getProcessStep(step.stepId)?.assignedTo"`, `:users="users"` to each dropdown
    - Wire `@assigned` to bubble up via `emit('assigned', stepId, userId)`
    - Add `click.stop` on the dropdown wrapper to prevent step click navigation when interacting with the dropdown
    - _Requirements: 2.3_

  - [x] 3.3 Widen step columns in StepTracker
    - Change `min-w-[80px]` to `min-w-[120px]` on step column divs (both the step columns in the `v-for` and the "Done" completed column)
    - _Requirements: 2.4_

  - [x] 3.4 Update jobs/[id].vue to use integrated StepTracker
    - Remove the separate `<div v-if="activeUsers.length || p.steps.length">` block that renders StepAssignmentDropdown below StepTracker
    - Add `:users="activeUsers"` prop to the `<StepTracker>` component
    - Add `@assigned="onStepAssigned"` event handler to StepTracker (replacing the per-dropdown handler)
    - _Requirements: 2.3, 3.6_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - handleSelection Sends Correct userId
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Update the test to use the FIXED extraction logic (`const userId = value` instead of `item?.value ?? null`)
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Assignment Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run `npx vitest run` to verify all tests pass
  - Ensure the existing `dropdownFilter.property.test.ts` (Property 4) still passes
  - Ensure all other property, unit, and integration tests are unaffected
  - Ask the user if questions arise
