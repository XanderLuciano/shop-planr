# Implementation Plan: Step Overflow UX

## Overview

Fix the StepTracker horizontal overflow by switching from `overflow-x-auto` to `flex-wrap`, compacting step card sizing, condensing serial counts to a single line, adding `title` attributes for truncated text, making StepAssignmentDropdown width responsive (`w-full`), and removing `overflow-hidden` from the Path_Card container. All changes are CSS/template-level in three files: `StepTracker.vue`, `StepAssignmentDropdown.vue`, and `jobs/[id].vue`.

## Tasks

- [x] 1. Update StepTracker layout and step card sizing
  - [x] 1.1 Replace overflow-x-auto with flex-wrap layout in StepTracker.vue
    - Change outer container from `flex justify-center gap-1.5 items-stretch overflow-x-auto py-1` to `flex flex-wrap justify-start gap-x-1 gap-y-2 items-stretch py-1`
    - This enables step cards to wrap onto additional rows instead of scrolling horizontally
    - _Requirements: 1.1, 1.3, 1.5, 4.1_

  - [x] 1.2 Compact step card dimensions
    - Change step card classes from `min-w-[120px] px-2 py-1.5` to `min-w-[110px] max-w-[150px] flex-1 px-1.5 py-1`
    - Add responsive small-screen minimum: `sm:min-w-[110px] min-w-[90px]`
    - Change "Done" column from `min-w-[120px] px-2 py-1.5` to `min-w-[110px] max-w-[150px] flex-1 px-1.5 py-1`
    - `flex-1` with `min-w` and `max-w` lets cards grow evenly while capping width
    - _Requirements: 1.4, 2.1, 4.2_

  - [x] 1.3 Condense serial counts to single-line format
    - Replace the stacked `serialCount` / `completedCount` display with a single line: `"N at · M done"` format
    - Remove the separate `<span>` for completed count and merge into the count `<div>`
    - _Requirements: 2.3_

  - [x] 1.4 Add title attributes for truncated text accessibility
    - Add `:title="step.stepName"` to the step name `<span>` element
    - Add `:title="step.location"` to the location `<span>` element (when location exists)
    - Ensures full text is accessible on hover when CSS truncation clips the display
    - _Requirements: 2.2_

  - [x] 1.5 Add shrink-0 to arrow indicators
    - Add `shrink-0` class to the arrow `<div>` wrappers between steps to prevent arrow compression during flex-wrap
    - Arrows remain between every consecutive step pair, maintaining sequence clarity across wrapped rows
    - _Requirements: 1.2_

  - [ ]* 1.6 Write property test: Arrow count equals step count
    - **Property 1: Arrow count equals step count minus one**
    - **Validates: Requirements 1.2**
    - Test file: `tests/properties/stepTrackerArrowCount.property.test.ts`
    - Generate random `StepDistribution[]` arrays of length 1–20 using `fast-check`
    - Mount StepTracker with generated distribution and a matching Path
    - Assert the rendered output contains exactly N chevron-right icons (N-1 between steps + 1 before Done)
    - Minimum 100 iterations

  - [x] 1.7 Write property test: Truncated text has accessible full text
    - **Property 2: Truncated text has accessible full text**
    - **Validates: Requirements 2.2**
    - Test file: `tests/properties/stepTrackerTitleAttr.property.test.ts`
    - Generate random step names (including long strings, unicode, special characters) using `fast-check`
    - Mount StepTracker with generated steps
    - Assert each step card includes a `title` attribute containing the exact full step name
    - Minimum 100 iterations

- [x] 2. Update StepAssignmentDropdown width
  - [x] 2.1 Replace fixed w-44 with w-full on USelectMenu
    - In `StepAssignmentDropdown.vue`, change `class="w-44"` to `class="w-full"` on the `USelectMenu` component
    - The trigger already has `truncate text-xs` on the display label, which will now truncate within the card width
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Remove overflow-hidden from Path_Card container
  - [x] 3.1 Update Path_Card in jobs/[id].vue
    - Change `class="border border-(--ui-border) rounded-md overflow-hidden"` to `class="border border-(--ui-border) rounded-md"`
    - Remove `overflow-hidden` entirely so portaled popovers aren't clipped during transition animations
    - _Requirements: 4.3_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run `npx vitest run` to verify all existing tests still pass
  - Verify property tests from tasks 1.6 and 1.7 pass (if implemented)
  - Ensure no regressions in existing StepTracker or StepAssignmentDropdown tests
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All changes are purely CSS/template-level — no backend, service, or data model changes
- Property tests use `fast-check` with `happy-dom` environment (existing project conventions)
- Manual visual testing recommended: seed a job with 8+ steps, resize browser from wide to narrow to verify wrapping, arrow visibility, and dropdown behavior
