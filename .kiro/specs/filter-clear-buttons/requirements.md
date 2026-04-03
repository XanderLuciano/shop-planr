# Requirements Document

## Introduction

The Jobs page filter bar (ViewFilters component) provides text inputs for Job name, Priority, and Step filters. Currently, users must either use the global "Clear" link to reset all filters at once or manually select and delete text in each input. This feature adds an inline X icon button inside each text input that appears only when the input has a value, enabling one-click clearing of individual filters without affecting other active filters.

This is a purely frontend change scoped to the `ViewFilters.vue` component. The USelect for status is excluded since it already has a meaningful default ("All").

## Glossary

- **ViewFilters**: The Vue component (`ViewFilters.vue`) that renders the filter bar on the Jobs page, containing text inputs and a status select
- **FilterState**: The TypeScript interface representing the current state of all filter fields (jobName, priority, stepName, status, etc.)
- **Clear_Button**: An inline X icon button rendered inside a text input's trailing slot, used to clear that specific filter field
- **UInput**: The Nuxt UI 4 text input component that exposes a `#trailing` slot for rendering content on the right side of the input
- **Global_Clear**: The existing "Clear" button that resets all filters to the default state (`{ status: 'all' }`)

## Requirements

### Requirement 1: Clear Button Visibility

**User Story:** As a user, I want to see a clear button inside a filter input only when it has a value, so that I know which filters are active and can be individually cleared.

#### Acceptance Criteria

1. WHEN a text filter input (Job name, Priority, or Step) has a non-empty string value, THE ViewFilters SHALL render a Clear_Button inside that input's trailing slot
2. WHEN a text filter input has an empty, undefined, or null value, THE ViewFilters SHALL NOT render a Clear_Button inside that input
3. WHEN a filter value changes from empty to non-empty, THE ViewFilters SHALL display the Clear_Button for that input
4. WHEN a filter value changes from non-empty to empty, THE ViewFilters SHALL hide the Clear_Button for that input

### Requirement 2: Individual Filter Clearing

**User Story:** As a user, I want to clear a single filter by clicking its X button, so that I can refine my search without losing other active filters.

#### Acceptance Criteria

1. WHEN a user clicks a Clear_Button for a specific filter field, THE ViewFilters SHALL set that filter field to undefined in the emitted FilterState
2. WHEN a user clicks a Clear_Button for a specific filter field, THE ViewFilters SHALL preserve all other filter field values unchanged in the emitted FilterState
3. WHEN a Clear_Button is clicked, THE ViewFilters SHALL emit a change event with the updated FilterState to the parent component

### Requirement 3: Global Clear Preservation

**User Story:** As a user, I want the existing global Clear button to continue working as before, so that I can still reset all filters at once.

#### Acceptance Criteria

1. THE Global_Clear button SHALL continue to reset all filters to the default state with status set to "all"
2. WHEN the Global_Clear button is clicked, THE ViewFilters SHALL emit a change event with FilterState containing only `{ status: 'all' }`

### Requirement 4: Clear Button Appearance and Interaction

**User Story:** As a user, I want the clear button to be visually unobtrusive and easy to click, so that it does not clutter the filter bar but is readily accessible.

#### Acceptance Criteria

1. THE Clear_Button SHALL use the `i-lucide-x` icon consistent with the existing Global_Clear button icon
2. THE Clear_Button SHALL use neutral color, link variant, xs size, and no padding to fit within the input's trailing area
3. THE Clear_Button SHALL be rendered using UInput's `#trailing` slot so that input text does not overlap the button

### Requirement 5: Accessibility

**User Story:** As a user relying on assistive technology, I want each clear button to have a descriptive label, so that I can understand its purpose without visual context.

#### Acceptance Criteria

1. THE Clear_Button for each filter field SHALL have an aria-label attribute describing which filter it clears (e.g., "Clear job name filter")
2. THE Clear_Button SHALL be focusable and activatable via keyboard interaction

### Requirement 6: Idempotent and Safe Clearing

**User Story:** As a user, I want clearing a filter to be safe and predictable, so that rapid or repeated interactions do not cause errors.

#### Acceptance Criteria

1. WHEN a Clear_Button click sets a filter field that is already undefined to undefined, THE ViewFilters SHALL treat the operation as a no-op with no errors
2. WHEN a user clicks a Clear_Button multiple times rapidly, THE ViewFilters SHALL handle each click without errors or inconsistent state
3. WHEN a user manually deletes all text from an input, THE ViewFilters SHALL produce the same FilterState as clicking the Clear_Button for that field
