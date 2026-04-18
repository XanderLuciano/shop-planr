# Implementation Plan: Skip Step Completion Toggle

## Overview

Add a "Mark this step as complete?" checkbox to the Advanced options section of `ProcessAdvancementPanel.vue`. The checkbox controls the `skip` flag passed to `advanceToStep()`, allowing admins to mark the origin step as completed (instead of skipped/deferred) when advancing parts to a non-adjacent step. All changes are confined to a single Vue component — no server-side work needed.

## Tasks

- [x] 1. Add markComplete state and wire skip flag
  - [x] 1.1 Add `markComplete` ref and reset logic in ProcessAdvancementPanel.vue
    - Add `const markComplete = ref(false)` to the `<script setup>` block
    - Add `markComplete.value = false` to the existing `watch(() => props.job.stepId)` watcher alongside the `advancedOpen` and `selectedTargetStepId` resets
    - _Requirements: 2.1, 2.2, 7.1_

  - [x] 1.2 Update `handleSkipSelectedParts` to use `markComplete` for the skip flag
    - Change `skip: true` to `skip: !markComplete.value` in the `advanceToStep()` call
    - _Requirements: 3.1, 3.2_

  - [x] 1.3 Update toast messages to reflect completion mode
    - When `markComplete` is `true`: title "Parts advanced", description "completed and advanced"
    - When `markComplete` is `false`: title "Parts skipped", description "skipped forward" (existing behavior)
    - _Requirements: 5.1, 5.2_

- [x] 2. Add checkbox UI and contextual help text
  - [x] 2.1 Add UCheckbox with conditional visibility in the Advanced options template
    - Insert a `<div v-if="hasTargetSelected">` block between the bypass preview and the "Skip Selected Parts" button
    - Render `<UCheckbox v-model="markComplete" label="Mark this step as complete?" />`
    - Add contextual help `<p>` that shows "The current step will be marked as completed before advancing." when checked, or "The current step will be marked as skipped or deferred." when unchecked
    - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 6.1_

- [x] 3. Checkpoint — Verify implementation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add tests for skip step completion toggle
  - [x] 4.1 Write property test: skip flag inversion (Property 1)
    - **Property 1: Skip flag inversion**
    - For any boolean state of `markComplete`, the `skip` parameter passed to `advanceToStep` is `!markComplete`
    - **Validates: Requirements 3.1, 3.2**

  - [x] 4.2 Write property test: default and reset state (Property 2)
    - **Property 2: Default and reset state**
    - For any initial render or step change, `markComplete` is always `false`
    - **Validates: Requirements 2.1, 2.2, 7.1**

  - [x] 4.3 Write unit tests for checkbox visibility and help text
    - Verify checkbox is hidden when `hasTargetSelected` is `false`
    - Verify checkbox is visible when `hasTargetSelected` is `true`
    - Verify help text changes based on `markComplete` state
    - **Validates: Requirements 1.1, 1.2, 4.1, 4.2**

  - [x] 4.4 Write unit tests for toast message variants
    - Verify toast title is "Parts advanced" and description contains "completed and advanced" when `markComplete` is `true`
    - Verify toast title is "Parts skipped" and description contains "skipped forward" when `markComplete` is `false`
    - **Validates: Requirements 5.1, 5.2**

- [x] 5. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All changes are in `app/components/ProcessAdvancementPanel.vue` — no server-side modifications
- The checkbox is inside the existing `v-if="isAdmin"` block, so admin gating (Requirement 6.1) is automatic
- Property tests use fast-check per project convention
