# Implementation Plan: Filter Clear Buttons

## Overview

Add per-input X clear buttons to the three text filter inputs (Job name, Priority, Step) in `ViewFilters.vue` using UInput's `#trailing` slot. Each button appears only when the input has a non-empty value and clears that single filter field on click. No new components, composables, or backend changes needed.

## Tasks

- [x] 1. Add trailing-slot clear buttons to ViewFilters.vue
  - [x] 1.1 Add `#trailing` slot with conditional UButton to the Job name UInput
    - Render `UButton` with `v-if="filters.jobName"` inside `<template #trailing>`
    - Use `icon="i-lucide-x"`, `color="neutral"`, `variant="link"`, `size="xs"`, `:padded="false"`
    - On click call `update('jobName', undefined)`
    - Set `aria-label="Clear job name filter"`
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 4.1, 4.2, 4.3, 5.1, 5.2_

  - [x] 1.2 Add `#trailing` slot with conditional UButton to the Priority UInput
    - Same pattern as 1.1 with `v-if="filters.priority"`, `update('priority', undefined)`, `aria-label="Clear priority filter"`
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 4.1, 4.2, 4.3, 5.1, 5.2_

  - [x] 1.3 Add `#trailing` slot with conditional UButton to the Step UInput
    - Same pattern as 1.1 with `v-if="filters.stepName"`, `update('stepName', undefined)`, `aria-label="Clear step filter"`
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 4.1, 4.2, 4.3, 5.1, 5.2_

  - [x] 1.4 Verify global Clear button is unchanged
    - Confirm the existing `clearAll()` UButton still renders and calls `emit('change', { status: 'all' })`
    - _Requirements: 3.1, 3.2_

- [x] 2. Write component tests for clear button behavior
  - [x] 2.1 Create `tests/unit/components/ViewFiltersClearButton.test.ts`
    - Test clear button renders when filter value is non-empty
    - Test clear button does not render when filter value is empty/undefined
    - Test clicking clear button emits change event with that field set to undefined and other fields preserved
    - Test each clear button has correct aria-label
    - Test global Clear button still emits `{ status: 'all' }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2, 4.3, 5.1, 6.1, 6.3_

  - [x] 2.2 Write property test: Clear button visibility invariant
    - **Property 1: Clear button visibility invariant**
    - For any filter field in {jobName, priority, stepName} and any FilterState, the clear button is rendered iff the field value is a non-empty string
    - Create `tests/properties/filterClearVisibility.property.test.ts`
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [x] 2.3 Write property test: Single-field clear isolation
    - **Property 2: Single-field clear isolation**
    - For any FilterState and any clearable field, clearing that field produces a FilterState where only that field is undefined and all others retain original values
    - Create `tests/properties/filterClearIsolation.property.test.ts`
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [x] 2.4 Write property test: Manual delete and button click equivalence
    - **Property 5: Manual delete and button click equivalence**
    - For any clearable field with a non-empty value, manually deleting all text (empty string coerced to undefined) produces the same FilterState as clicking the clear button
    - Add to `tests/properties/filterClearIsolation.property.test.ts`
    - **Validates: Requirement 6.3**

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The implementation reuses the existing `update()` function — no new logic needed
- UInput's `#trailing` slot automatically handles input text padding so text won't overlap the button
- The USelect for status is excluded (already has a meaningful "All" default)
- Property tests use fast-check with the project's standard pattern (100 iterations minimum)
