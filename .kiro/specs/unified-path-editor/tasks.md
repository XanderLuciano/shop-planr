# Implementation Plan: Unified Path Editor

## Overview

Extract the shared step editing grid from `JobCreationForm.vue` and `PathEditor.vue` into a single `PathStepEditor.vue` component. Refactor `ProcessLocationDropdown.vue` to use a floating overlay. Replace `PathEditor.vue` usage on the job detail page with inline `PathStepEditor`. Both mobile and desktop layouts are handled via `useMobileBreakpoint()`.

## Tasks

- [x] 1. Export createStepDraft and add conversion helpers
  - [x] 1.1 Export `createStepDraft` from `useJobForm.ts`
    - Change `function createStepDraft(...)` to `export function createStepDraft(...)` so PathStepEditor and jobs/[id].vue can import it
    - _Requirements: 1.1, 1.5, 10.2_

  - [x] 1.2 Create `toStepDrafts` and `toStepPayload` helper functions
    - Add `toStepDrafts(steps: ProcessStep[]): StepDraft[]` — sorts by `order`, assigns `_clientId` via nanoid, sets `_existingStepId`, normalizes null/undefined fields to defaults
    - Add `toStepPayload(drafts: StepDraft[]): StepPayload[]` — trims name, converts empty location to undefined, handles assignedTo null/undefined logic, sets id from `_existingStepId`
    - These can live in `useJobForm.ts` as exported functions or in a new `app/utils/stepDraftHelpers.ts` file
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [x] 1.3 Write property tests for toStepDrafts (Property 6, Property 7)
    - **Property 6: toStepDrafts preserves step identity and sorts by order** — For any shuffled ProcessStep[], result is sorted by `order` ascending, each `_existingStepId` maps to original id, each `_clientId` is unique and non-empty
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.5**
    - **Property 7: toStepDrafts round-trip field preservation** — For any ProcessStep with fields, the resulting StepDraft preserves all values with null/undefined → default normalization
    - **Validates: Requirements 10.4**

  - [x] 1.4 Write property tests for toStepPayload (Property 8)
    - **Property 8: toStepPayload conversion correctness** — For any StepDraft[], result has same length, name trimmed, empty location → undefined, id = _existingStepId, assignedTo mapped correctly (truthy → preserved, falsy + existing → null, falsy + new → undefined), optional and dependencyType preserved
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7**

- [x] 2. Refactor ProcessLocationDropdown to floating overlay
  - [x] 2.1 Refactor ProcessLocationDropdown.vue suggestion list to absolute-positioned overlay
    - Wrap component in a `relative` positioned container
    - Render suggestion list as `absolute top-full left-0 w-full z-10 mt-1` with border, rounded, bg, shadow, max-h-48 overflow-y-auto
    - Move "New process/location" button inside the floating overlay
    - Move "New item" input row inside the floating overlay when `showNewInput` is true
    - Add click-outside handler to close the overlay
    - Close overlay on item selection
    - The component's layout height remains constant at UInput sm height (32px)
    - Props interface unchanged: `modelValue`, `update:modelValue`, `type`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 2.2 Write unit tests for ProcessLocationDropdown floating overlay
    - Test that suggestion list renders as absolute-positioned overlay
    - Test that overlay closes on selection
    - Test that overlay closes on click-outside
    - Test that "New" input renders inside the overlay
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create PathStepEditor.vue component
  - [x] 4.1 Implement PathStepEditor.vue with desktop two-zone card layout
    - Create `app/components/PathStepEditor.vue`
    - Accept props: `steps` (StepDraft[]), `assigneeItems`, `dependencyTypeOptions`, optional `getFieldError` and `clearFieldError` callbacks
    - Emit `update:steps` with full updated StepDraft[] on every mutation
    - Use `useMobileBreakpoint()` for viewport detection
    - Desktop layout: column headers row + bordered step cards with Zone 1 (primary flex row, all controls at 32px height) and Zone 2 (conditional validation errors)
    - Zone 1 elements: step badge (w-7), process UInput (flex-1), location UInput (flex-1), assignee USelect (w-36), optional checkbox in h-8 wrapper (w-8), dependency USelect (w-36), move up/down buttons (w-14), remove button (w-7)
    - Use ProcessLocationDropdown for process and location fields
    - Disable remove when only 1 step; disable move-up on first step, move-down on last step
    - "Add Step" button at bottom
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 12.1, 12.2, 12.4, 14.1, 14.2_

  - [x] 4.2 Implement PathStepEditor.vue mobile stacked card layout
    - Mobile layout (< 768px): stacked cards with step number in card header
    - Full-width stacked fields with inline labels: Process, Location, Assignee
    - Compact row for Optional checkbox + Dependency type
    - Footer row with Move up, Move down, Remove buttons
    - Hide column headers on mobile
    - "Add Step" button full-width on mobile
    - Validation errors below the relevant field within the stacked card
    - Same event handling and data flow as desktop
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2, 12.3_

  - [x] 4.3 Write property tests for step add/remove/move operations (Properties 1–5, 9, 10)
    - **Property 1: Step count invariant on add** — For any steps array of length N, addStep produces length N+1, last element has unique _clientId, all existing steps preserved, new step has defaults
    - **Validates: Requirements 2.1, 2.2, 2.3, 14.1**
    - **Property 2: Step count invariant on remove** — For any steps of length N >= 2 and valid clientId, removeStep produces length N-1 without that clientId, all others preserved
    - **Validates: Requirements 3.1**
    - **Property 3: Remove guard for single step** — For any steps of length 1, removeStep returns array unchanged
    - **Validates: Requirements 3.2, 3.3**
    - **Property 4: Move swaps exactly two adjacent steps** — For any valid move, result has swapped steps at i and i+d, all others unchanged, same length and same set of _clientId values
    - **Validates: Requirements 4.1, 4.2, 4.5**
    - **Property 5: Move is self-inverse** — moveStep(+1) then moveStep(-1) returns original order
    - **Validates: Requirements 4.1, 4.2**
    - **Property 9: Field changes emit complete updated array** — For any field change at index i, emitted array has same length, only changed field differs at index i
    - **Validates: Requirements 5.1**
    - **Property 10: _clientId uniqueness across all operations** — For any sequence of add/remove/move, every step has unique non-empty _clientId
    - **Validates: Requirements 14.1, 14.2**

  - [x] 4.4 Write unit tests for PathStepEditor rendering
    - Test correct number of step cards rendered for given steps prop
    - Test desktop column headers visible when isMobile is false
    - Test mobile column headers hidden when isMobile is true
    - Test mobile inline labels present for Process, Location, Assignee
    - Test checkbox wrapper has h-8 class on desktop
    - Test remove button disabled when only 1 step
    - Test move-up disabled on first step, move-down disabled on last step
    - Test "Add Step" button has w-full class on mobile
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.5, 7.6, 8.1_

- [x] 5. Integrate PathStepEditor into JobCreationForm
  - [x] 5.1 Replace inline step grid in JobCreationForm.vue with PathStepEditor
    - Remove the inline step grid template (column headers div + step rows v-for)
    - Import and render `<PathStepEditor>` inside each path card
    - Pass `path.steps`, `assigneeItems`, `dependencyTypeOptions`, `getFieldError` (mapped to path index), `clearFieldError` (mapped to path index)
    - Handle `@update:steps` by assigning to `path.steps`
    - Keep all path-level fields (name, goal qty, advancement mode, template selector) in JobCreationForm
    - Keep path card header with action button area
    - _Requirements: 1.4, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 5.2 Write unit tests for JobCreationForm with PathStepEditor integration
    - Test that PathStepEditor is rendered for each path draft
    - Test that step mutations via PathStepEditor update the path draft's steps array
    - _Requirements: 1.4_

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Integrate PathStepEditor into job detail page and remove PathEditor
  - [x] 7.1 Replace PathEditor usage in jobs/[id].vue with inline PathStepEditor
    - Remove PathEditor import/usage
    - Add editing state: `editingPathId`, `editPathName`, `editGoalQty`, `editSteps` (StepDraft[])
    - When editing a path: convert `Path.steps` to `StepDraft[]` via `toStepDrafts()`
    - Render path name/goal qty inputs + `<PathStepEditor>` + Save/Cancel buttons inline
    - On save: call `updatePath()` with `toStepPayload()` conversion
    - For new paths: same pattern with empty initial state and `createPath()` call
    - Handle save errors by displaying to user and keeping editing state intact
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 1.5_

  - [x] 7.2 Delete PathEditor.vue
    - Remove `app/components/PathEditor.vue` — its functionality is fully replaced by PathStepEditor + inline editing in jobs/[id].vue
    - _Requirements: 13.1_

  - [x] 7.3 Write unit tests for job detail page PathStepEditor integration
    - Test that editing a path populates PathStepEditor with converted StepDraft[]
    - Test that save calls updatePath with correctly converted payload
    - Test that new path creation calls createPath with correct payload
    - Test that save error keeps editing state intact
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The design uses TypeScript/Vue — no language selection needed
- `createStepDraft` is currently a module-level function in `useJobForm.ts` (not exported) — task 1.1 exports it
- `useMobileBreakpoint()` composable already exists at `app/composables/useMobileBreakpoint.ts`
- `SELECT_UNASSIGNED` sentinel is auto-imported from `app/utils/`
