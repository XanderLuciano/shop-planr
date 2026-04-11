# Requirements Document

## Introduction

The unified path editor feature extracts the shared step editing logic from `JobCreationForm.vue` and `PathEditor.vue` into a single `PathStepEditor.vue` component. This component renders the step editing grid for one path, is purely presentational with local state, and is consumed by both the job creation/edit form and the job detail page with the same props interface. The feature also refactors `ProcessLocationDropdown.vue` to use a floating overlay for its suggestion list, solving vertical alignment issues in flex rows.

## Glossary

- **PathStepEditor**: The new unified Vue component (`app/components/PathStepEditor.vue`) that renders the step editing grid for a single path.
- **StepDraft**: The client-side data type representing a step being edited, with `_clientId` for tracking, defined in `useJobForm.ts`.
- **ProcessStep**: The server-side domain type representing a persisted process step with `id`, `name`, `order`, and optional fields.
- **ProcessLocationDropdown**: The existing autocomplete component for process name and location fields, refactored to use a floating overlay.
- **JobCreationForm**: The form component used on `/jobs/new` and `/jobs/edit/[id]` for creating and editing jobs with multiple paths.
- **Job_Detail_Page**: The page at `/jobs/[id]` for viewing and editing individual paths on an existing job.
- **Zone_1**: The primary flex row in a desktop step card containing all fixed-height controls aligned at 32px.
- **Zone_2**: The conditional expandable area below Zone_1 for validation error messages.
- **Floating_Overlay**: An absolute-positioned dropdown panel (z-10) that renders above subsequent content without affecting layout height.
- **Mobile_Layout**: The stacked card layout rendered when viewport width is below 768px.
- **Desktop_Layout**: The flex row layout rendered when viewport width is 768px or above.

## Requirements

### Requirement 1: Unified Step Editing Component

**User Story:** As a developer, I want a single reusable step editing component, so that step editing behavior and layout are consistent across the job creation form and the job detail page.

#### Acceptance Criteria

1. THE PathStepEditor SHALL accept `steps` (StepDraft[]), `assigneeItems`, `dependencyTypeOptions`, and optional `getFieldError` and `clearFieldError` callback props
2. THE PathStepEditor SHALL emit `update:steps` with the full updated StepDraft array on every step mutation (add, remove, move, field change)
3. THE PathStepEditor SHALL render identically regardless of whether the parent is JobCreationForm or Job_Detail_Page
4. WHEN PathStepEditor is embedded in JobCreationForm, THE JobCreationForm SHALL pass path-level steps and handle `update:steps` by assigning to the path draft's steps array
5. WHEN PathStepEditor is used on Job_Detail_Page, THE Job_Detail_Page SHALL convert server ProcessStep[] to StepDraft[] before passing them as props and convert StepDraft[] back to API format on save

### Requirement 2: Step Add Operation

**User Story:** As a user, I want to add new steps to a path, so that I can define additional process steps in my routing.

#### Acceptance Criteria

1. WHEN a user clicks the "Add Step" button, THE PathStepEditor SHALL append a new StepDraft with a unique `_clientId`, empty `name`, empty `location`, empty `assignedTo`, `optional: false`, and `dependencyType: 'preferred'`
2. WHEN a step is added, THE PathStepEditor SHALL preserve all existing steps in their original order
3. WHEN a step is added, THE PathStepEditor SHALL emit `update:steps` with an array whose length is one greater than the previous array

### Requirement 3: Step Remove Operation

**User Story:** As a user, I want to remove steps from a path, so that I can adjust the routing when a step is no longer needed.

#### Acceptance Criteria

1. WHEN a user clicks the remove button on a step, THE PathStepEditor SHALL emit `update:steps` with an array that excludes the removed step and preserves all other steps in their original order
2. WHILE only one step exists in the steps array, THE PathStepEditor SHALL disable the remove button for that step
3. WHEN removal is attempted on a single-step array, THE PathStepEditor SHALL return the array unchanged

### Requirement 4: Step Move (Reorder) Operation

**User Story:** As a user, I want to reorder steps within a path, so that I can adjust the sequence of process steps.

#### Acceptance Criteria

1. WHEN a user clicks the move-up button on a step, THE PathStepEditor SHALL swap that step with the step above it and emit `update:steps` with the reordered array
2. WHEN a user clicks the move-down button on a step, THE PathStepEditor SHALL swap that step with the step below it and emit `update:steps` with the reordered array
3. WHILE a step is at the first position, THE PathStepEditor SHALL disable the move-up button for that step
4. WHILE a step is at the last position, THE PathStepEditor SHALL disable the move-down button for that step
5. WHEN a move operation is performed, THE PathStepEditor SHALL preserve all steps in the array with only the two swapped steps changing position

### Requirement 5: Step Field Editing

**User Story:** As a user, I want to edit individual fields on each step, so that I can configure process name, location, assignee, optional flag, and dependency type.

#### Acceptance Criteria

1. WHEN a user changes a field value on a step, THE PathStepEditor SHALL emit `update:steps` with the full array where only the changed field on the target step differs
2. THE PathStepEditor SHALL use ProcessLocationDropdown for the process name field
3. THE PathStepEditor SHALL use ProcessLocationDropdown for the location field
4. THE PathStepEditor SHALL use USelect for the assignee field, mapping empty `assignedTo` to the SELECT_UNASSIGNED sentinel value
5. THE PathStepEditor SHALL use a checkbox for the optional field
6. THE PathStepEditor SHALL use USelect for the dependency type field with options: physical, preferred, completion_gate

### Requirement 6: Desktop Two-Zone Card Layout

**User Story:** As a user on a desktop viewport, I want step controls aligned in a consistent row, so that the editing grid is visually clean and controls do not shift when dropdowns open.

#### Acceptance Criteria

1. WHILE the viewport width is 768px or greater, THE PathStepEditor SHALL render each step as a bordered card with a Zone_1 primary flex row containing all controls at 32px height
2. WHILE the viewport width is 768px or greater, THE PathStepEditor SHALL render a column headers row above the step cards with labels for each field
3. WHILE the viewport width is 768px or greater, THE PathStepEditor SHALL wrap the optional checkbox in a container with height matching UInput sm (32px) for vertical alignment
4. WHEN validation errors exist for a step, THE PathStepEditor SHALL render error messages in Zone_2 below the Zone_1 primary row


### Requirement 7: Mobile Stacked Card Layout

**User Story:** As a user on a mobile viewport, I want step fields stacked vertically with inline labels, so that the editing interface is usable on small screens.

#### Acceptance Criteria

1. WHILE the viewport width is below 768px, THE PathStepEditor SHALL render each step as a stacked card with the step number in the card header
2. WHILE the viewport width is below 768px, THE PathStepEditor SHALL render Process, Location, and Assignee as full-width stacked fields with inline labels above each input
3. WHILE the viewport width is below 768px, THE PathStepEditor SHALL render the Optional checkbox and Dependency type select in a single compact row
4. WHILE the viewport width is below 768px, THE PathStepEditor SHALL render Move up, Move down, and Remove buttons in a footer row within each step card
5. WHILE the viewport width is below 768px, THE PathStepEditor SHALL hide the column headers row
6. WHILE the viewport width is below 768px, THE PathStepEditor SHALL render the "Add Step" button at full width

### Requirement 8: Layout Data and Behavior Parity

**User Story:** As a developer, I want both mobile and desktop layouts to produce identical data and events, so that switching viewports does not cause data loss or behavioral differences.

#### Acceptance Criteria

1. THE PathStepEditor SHALL render the same step data (process, location, assignee, optional, dependency type) in both Mobile_Layout and Desktop_Layout for the same StepDraft[] input
2. THE PathStepEditor SHALL emit identical `update:steps` event payloads for the same user interaction (add, remove, move, field change) regardless of whether Mobile_Layout or Desktop_Layout is active

### Requirement 9: ProcessLocationDropdown Floating Overlay

**User Story:** As a user, I want the process and location suggestion lists to float above other content, so that opening a dropdown does not push sibling controls out of alignment.

#### Acceptance Criteria

1. WHEN the ProcessLocationDropdown suggestion list is visible, THE ProcessLocationDropdown SHALL render the suggestion list as a Floating_Overlay positioned below the input field
2. WHEN the ProcessLocationDropdown suggestion list is visible, THE Floating_Overlay SHALL not affect the layout height of the ProcessLocationDropdown container or shift any sibling elements in the same flex row
3. WHEN a user selects a suggestion from the Floating_Overlay, THE ProcessLocationDropdown SHALL close the overlay and update the model value
4. WHEN a user clicks outside the Floating_Overlay, THE ProcessLocationDropdown SHALL close the overlay
5. WHEN the "New process" or "New location" button is clicked, THE ProcessLocationDropdown SHALL render the new-item input inside the Floating_Overlay

### Requirement 10: StepDraft Conversion from Server Data

**User Story:** As a developer, I want a reliable conversion from server ProcessStep[] to client StepDraft[], so that the job detail page can populate the editor with existing path data.

#### Acceptance Criteria

1. WHEN converting ProcessStep[] to StepDraft[], THE toStepDrafts function SHALL sort the result by the `order` field ascending
2. WHEN converting ProcessStep[] to StepDraft[], THE toStepDrafts function SHALL assign a unique `_clientId` (via nanoid) to each StepDraft
3. WHEN converting ProcessStep[] to StepDraft[], THE toStepDrafts function SHALL set `_existingStepId` to the original ProcessStep `id`
4. WHEN a ProcessStep has null or undefined `location`, `assignedTo`, `optional`, or `dependencyType`, THE toStepDrafts function SHALL normalize the value to the StepDraft default (empty string, empty string, false, 'preferred' respectively)
5. WHEN converting ProcessStep[] to StepDraft[], THE toStepDrafts function SHALL produce an output array of the same length as the input array

### Requirement 11: StepDraft Conversion to API Payload

**User Story:** As a developer, I want a reliable conversion from client StepDraft[] to the API step payload format, so that edited steps can be saved to the server correctly.

#### Acceptance Criteria

1. WHEN converting StepDraft[] to API payload, THE toStepPayload function SHALL trim the `name` field of each step
2. WHEN converting StepDraft[] to API payload, THE toStepPayload function SHALL convert an empty trimmed `location` to `undefined`
3. WHEN a StepDraft has a truthy `assignedTo`, THE toStepPayload function SHALL preserve the value as-is
4. WHEN a StepDraft has a falsy `assignedTo` and has `_existingStepId`, THE toStepPayload function SHALL set `assignedTo` to `null` to explicitly unassign
5. WHEN a StepDraft has a falsy `assignedTo` and no `_existingStepId`, THE toStepPayload function SHALL set `assignedTo` to `undefined` to omit the field
6. WHEN converting StepDraft[] to API payload, THE toStepPayload function SHALL set `id` to `_existingStepId` for each step
7. WHEN converting StepDraft[] to API payload, THE toStepPayload function SHALL preserve `optional` and `dependencyType` unchanged

### Requirement 12: Validation Error Display

**User Story:** As a user, I want to see validation errors on specific step fields, so that I know which fields need correction before submitting.

#### Acceptance Criteria

1. WHEN the `getFieldError` prop returns a non-empty string for a step field, THE PathStepEditor SHALL display the error message adjacent to the relevant field
2. WHILE the viewport width is 768px or greater, THE PathStepEditor SHALL render validation errors in Zone_2 below the step's primary row
3. WHILE the viewport width is below 768px, THE PathStepEditor SHALL render validation errors below the relevant field within the stacked card
4. WHEN a user modifies a field that has a validation error, THE PathStepEditor SHALL invoke the `clearFieldError` callback for that field

### Requirement 13: PathEditor Removal and Job Detail Page Integration

**User Story:** As a developer, I want to remove the standalone PathEditor component and integrate PathStepEditor directly into the job detail page, so that there is a single source of truth for step editing UI.

#### Acceptance Criteria

1. WHEN editing a path on Job_Detail_Page, THE Job_Detail_Page SHALL render path name and goal quantity inputs alongside PathStepEditor with Save and Cancel buttons
2. WHEN creating a new path on Job_Detail_Page, THE Job_Detail_Page SHALL render PathStepEditor with empty initial steps and path-level fields
3. WHEN the user clicks Save on Job_Detail_Page, THE Job_Detail_Page SHALL call the appropriate API (updatePath or createPath) with the converted step payload
4. IF the API save call fails, THEN THE Job_Detail_Page SHALL display the error to the user and keep the editing state intact for retry

### Requirement 14: ClientId Uniqueness

**User Story:** As a developer, I want every StepDraft to have a unique `_clientId`, so that Vue's keyed rendering and step operations work correctly.

#### Acceptance Criteria

1. WHEN a new StepDraft is created (via add or conversion), THE system SHALL assign a `_clientId` that is a non-empty string unique within the current steps array
2. WHEN any sequence of add, remove, and move operations is performed, THE PathStepEditor SHALL maintain unique `_clientId` values across all steps in the resulting array
