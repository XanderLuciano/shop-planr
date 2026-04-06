# Requirements Document

## Introduction

This document defines the requirements for the Edit Step Properties feature (GitHub Issue #93). The feature enables users to edit step assignee and location from two surfaces: the Step View page (inline edit mode) and the Job create/edit form (Assignee column in the step grid). Backend changes extend `StepInput`, `reconcileSteps()`, and the config endpoint to support these editing flows.

## Glossary

- **Step_View_Page**: The dedicated step detail page at `/parts/step/[stepId]` where operators interact with individual process steps.
- **StepPropertiesEditor**: A new inline edit component rendered in the Step View page header, providing assignee and location dropdowns with save/cancel actions.
- **JobCreationForm**: The existing form component used on the job create (`/jobs/new`) and job edit (`/jobs/edit/[id]`) pages for defining paths and steps.
- **StepDraft**: The client-side draft object representing a step in the JobCreationForm, extended with an `assignedTo` field.
- **StepInput**: The server-side input type consumed by `reconcileSteps()` during path create/update operations.
- **reconcileSteps**: A pure function that reconciles incoming step inputs against existing steps, producing update, insert, and soft-delete lists.
- **Config_Endpoint**: The `PATCH /api/steps/:id/config` API route that accepts partial step configuration updates.
- **Assign_Endpoint**: The `PATCH /api/steps/:id/assign` API route that sets or clears a step's assignee.
- **pathService**: The server-side service module responsible for path and step business logic.
- **Assignee**: A reference to a `ShopUser` (by user ID) assigned to a process step, or null/undefined when unassigned.
- **Location**: A free-text string representing the physical location of a process step; the location library provides suggestions but does not constrain values.

## Requirements

### Requirement 1: Inline Edit Mode on Step View Page

**User Story:** As an operator, I want to edit a step's assignee and location directly from the Step View page, so that I can quickly update step properties without navigating to the job edit form.

#### Acceptance Criteria

1. WHEN a user clicks the edit button on the Step_View_Page header, THE Step_View_Page SHALL enter edit mode and display the StepPropertiesEditor in place of the static assignee and location display.
2. WHEN the StepPropertiesEditor is displayed, THE StepPropertiesEditor SHALL populate the assignee dropdown with all active users from the users API and the location dropdown with entries from the location library API.
3. WHEN a user clicks the cancel button on the StepPropertiesEditor, THE Step_View_Page SHALL exit edit mode and restore the static display without making any API calls.
4. WHEN a user clicks save on the StepPropertiesEditor with changed values, THE StepPropertiesEditor SHALL send the appropriate PATCH requests and emit a saved event upon success.
5. WHEN the StepPropertiesEditor emits a saved event, THE Step_View_Page SHALL exit edit mode and refresh the step data to reflect the updated values.

### Requirement 2: Assignee Update via Step View

**User Story:** As an operator, I want to assign or unassign a user to a step from the Step View page, so that the team knows who is responsible for that step.

#### Acceptance Criteria

1. WHEN a user selects a new assignee and saves, THE StepPropertiesEditor SHALL send a PATCH request to the Assign_Endpoint with the selected user ID.
2. WHEN a user clears the assignee selection and saves, THE StepPropertiesEditor SHALL send a PATCH request to the Assign_Endpoint with a null user ID to unassign the step.
3. WHEN the assignee value has not changed from the current value, THE StepPropertiesEditor SHALL skip the PATCH request to the Assign_Endpoint.

### Requirement 3: Location Update via Step View

**User Story:** As an operator, I want to update a step's location from the Step View page, so that I can correct or set the physical location where work happens.

#### Acceptance Criteria

1. WHEN a user selects or types a new location and saves, THE StepPropertiesEditor SHALL send a PATCH request to the Config_Endpoint with the new location value.
2. WHEN a user clears the location field and saves, THE StepPropertiesEditor SHALL send a PATCH request to the Config_Endpoint with an empty string to clear the location.
3. WHEN the location value has not changed from the current value, THE StepPropertiesEditor SHALL skip the PATCH request to the Config_Endpoint.
4. THE Config_Endpoint SHALL accept any string value for location, including empty string, without validation against the location library.

### Requirement 4: Independent Field Updates

**User Story:** As an operator, I want assignee and location changes to be independent, so that updating one field does not affect the other.

#### Acceptance Criteria

1. WHEN only the assignee is changed, THE StepPropertiesEditor SHALL call only the Assign_Endpoint and leave the location unchanged.
2. WHEN only the location is changed, THE StepPropertiesEditor SHALL call only the Config_Endpoint and leave the assignee unchanged.
3. WHEN both assignee and location are changed, THE StepPropertiesEditor SHALL call both the Assign_Endpoint and the Config_Endpoint.

### Requirement 5: Config Endpoint Extension for Location

**User Story:** As a developer, I want the config endpoint to accept a location field, so that location can be updated via the same endpoint used for other step configuration.

#### Acceptance Criteria

1. WHEN the Config_Endpoint receives a request body containing a `location` field of type string, THE Config_Endpoint SHALL include the location in the update passed to pathService.updateStep.
2. WHEN the Config_Endpoint receives a request body without a `location` field, THE Config_Endpoint SHALL not modify the step's existing location.
3. THE pathService.updateStep function SHALL merge the location field into the existing step record without affecting other step fields.

### Requirement 6: Assignee Column in Job Creation Form

**User Story:** As a job planner, I want to assign operators to steps when creating or editing a job, so that I can batch-assign responsibilities during path setup.

#### Acceptance Criteria

1. THE JobCreationForm SHALL display an Assignee column in the step grid between the Location and Optional columns.
2. WHEN the Assignee column is displayed, THE JobCreationForm SHALL render a dropdown for each step row populated with all active users and an unassigned option.
3. WHEN a user selects an assignee for a step in the JobCreationForm, THE StepDraft SHALL store the selected user ID in its `assignedTo` field.
4. WHEN a new StepDraft is created, THE StepDraft SHALL default the `assignedTo` field to an empty string representing unassigned.

### Requirement 7: StepInput Extension for assignedTo

**User Story:** As a developer, I want the StepInput type to include an assignedTo field, so that assignee data flows through the path create/update API.

#### Acceptance Criteria

1. THE StepInput type SHALL include an optional `assignedTo` field of type string.
2. WHEN the JobCreationForm submits step data with a non-empty `assignedTo` value, THE submit function SHALL include the `assignedTo` field in the StepInput payload.
3. WHEN the JobCreationForm submits step data with an empty string `assignedTo` value, THE submit function SHALL map the empty string to undefined in the StepInput payload.

### Requirement 8: reconcileSteps Assignee Handling

**User Story:** As a developer, I want reconcileSteps to accept and propagate assignedTo from input, so that assignee changes made in the job form are persisted correctly.

#### Acceptance Criteria

1. WHEN a StepInput has an `assignedTo` value and matches an existing step by ID, THE reconcileSteps function SHALL use the input's `assignedTo` value in the updated step.
2. WHEN a StepInput has no `assignedTo` value (undefined) and matches an existing step by ID, THE reconcileSteps function SHALL preserve the existing step's `assignedTo` value.
3. WHEN a StepInput has an `assignedTo` value and does not match any existing step, THE reconcileSteps function SHALL include the `assignedTo` value in the newly inserted step.
4. WHEN a StepInput has no `assignedTo` value and does not match any existing step, THE reconcileSteps function SHALL create the new step without an `assignedTo` value.

### Requirement 9: Change Detection for Assignee in Job Form

**User Story:** As a developer, I want the job form change detection to include assignee comparisons, so that editing a step's assignee triggers a path update on save.

#### Acceptance Criteria

1. WHEN a StepDraft's `assignedTo` value differs from the corresponding original step's `assignedTo` value, THE hasPathChanges function SHALL return true.
2. WHEN a StepDraft's `assignedTo` value matches the corresponding original step's `assignedTo` value, THE hasPathChanges function SHALL not flag the step as changed based on assignee alone.

### Requirement 10: Edit Mode Hydration for Assignee

**User Story:** As a job planner, I want existing step assignees to appear in the form when editing a job, so that I can see and modify current assignments.

#### Acceptance Criteria

1. WHEN the JobCreationForm loads in edit mode, THE useJobForm composable SHALL populate each StepDraft's `assignedTo` field from the corresponding ProcessStep's `assignedTo` value.
2. WHEN a ProcessStep has no `assignedTo` value, THE useJobForm composable SHALL set the StepDraft's `assignedTo` field to an empty string.

### Requirement 11: Error Handling for Step Property Edits

**User Story:** As an operator, I want clear error feedback when a step property edit fails, so that I can understand what went wrong and retry.

#### Acceptance Criteria

1. IF the Assign_Endpoint returns a validation error (user not found or inactive), THEN THE StepPropertiesEditor SHALL display a toast with the error message and remain in edit mode.
2. IF the Config_Endpoint returns a not-found error (step was deleted), THEN THE StepPropertiesEditor SHALL display a toast with the error message.
3. IF a network error occurs during save, THEN THE StepPropertiesEditor SHALL display a toast with a generic error message and remain in edit mode for retry.
4. IF the assignee PATCH succeeds but the location PATCH fails, THEN THE StepPropertiesEditor SHALL display an error toast, and on retry the assignee PATCH SHALL be a no-op because the value is already saved.

### Requirement 12: Assignee Validation

**User Story:** As a system administrator, I want step assignment to validate that the target user exists and is active, so that steps cannot be assigned to deactivated users.

#### Acceptance Criteria

1. WHEN the Assign_Endpoint receives a user ID, THE pathService.assignStep function SHALL verify the user exists and is active before updating the assignment.
2. IF the Assign_Endpoint receives a user ID for a non-existent or inactive user, THEN THE pathService.assignStep function SHALL return a validation error.
3. WHEN the Assign_Endpoint receives a null user ID, THE pathService.assignStep function SHALL clear the step's assignee without user validation.

### Requirement 13: No Side Effects on Other Step Fields

**User Story:** As a developer, I want step property edits to be scoped to only the changed fields, so that other step data is never accidentally modified.

#### Acceptance Criteria

1. WHEN the Assign_Endpoint updates a step's assignee, THE pathService SHALL not modify the step's name, order, location, optional flag, dependencyType, or completedCount.
2. WHEN the Config_Endpoint updates a step's location, THE pathService SHALL not modify the step's name, order, assignedTo, optional flag, dependencyType, or completedCount.
