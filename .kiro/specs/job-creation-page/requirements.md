# Requirements Document

## Introduction

The Job Creation Page promotes job creation from a minimal inline form (name + goal quantity only) to a dedicated, full-page experience at `/jobs/new`. The new page allows users to define all job-related settings — including paths, process steps, step configuration, and template application — in a single workflow before submitting. The same page doubles as the job editing experience at `/jobs/[id]/edit`, eliminating the current two-step pattern of "create then configure."

## Glossary

- **Job_Creation_Page**: The dedicated full-page form at `/jobs/new` (create mode) or `/jobs/[id]/edit` (edit mode) for defining all job settings in one workflow.
- **Job**: A production order with a name, goal quantity, and optional Jira metadata.
- **Path**: A route instance belonging to a Job, containing an ordered list of Process Steps, a goal quantity, and an advancement mode.
- **Process_Step**: An individual step within a Path, with a name, order, optional location, optional/required flag, and dependency type.
- **Step_Draft**: A transient, unsaved representation of a Process Step used within the Job_Creation_Page form before submission.
- **Path_Draft**: A transient, unsaved representation of a Path (including its Step_Drafts) used within the Job_Creation_Page form before submission.
- **Advancement_Mode**: A Path-level setting controlling serial number progression: `strict`, `flexible`, or `per_step`.
- **Dependency_Type**: A step-level setting indicating the nature of step ordering: `physical`, `preferred`, or `completion_gate`.
- **Template**: A reusable route definition (TemplateRoute) that can be applied to populate a Path_Draft with predefined steps.
- **Process_Library**: The system-managed list of reusable process names available for step name selection.
- **Location_Library**: The system-managed list of reusable location names available for step location selection.

## Requirements

### Requirement 1: Dedicated Route and Page Shell

**User Story:** As a production planner, I want a dedicated page for creating jobs, so that I have enough screen space to configure all job settings in one place.

#### Acceptance Criteria

1. WHEN a user navigates to `/jobs/new`, THE Job_Creation_Page SHALL render in create mode with all form fields empty and default values applied.
2. WHEN a user navigates to `/jobs/[id]/edit`, THE Job_Creation_Page SHALL render in edit mode with all form fields pre-populated from the existing Job, its Paths, and their Process Steps.
3. IF a user navigates to `/jobs/[id]/edit` with a non-existent Job ID, THEN THE Job_Creation_Page SHALL display an error message and provide a link back to the jobs list.
4. THE Job_Creation_Page SHALL include a back/cancel navigation link that returns the user to the jobs list page without saving changes.

### Requirement 2: Job-Level Fields

**User Story:** As a production planner, I want to define the job name and goal quantity during creation, so that the job is properly identified and sized.

#### Acceptance Criteria

1. THE Job_Creation_Page SHALL provide a text input for the Job name.
2. THE Job_Creation_Page SHALL provide a numeric input for the Job goal quantity with a minimum value of 1.
3. WHEN the user submits the form with an empty Job name, THE Job_Creation_Page SHALL display a validation error on the name field and prevent submission.
4. WHEN the user submits the form with a goal quantity less than 1, THE Job_Creation_Page SHALL display a validation error on the goal quantity field and prevent submission.
5. WHILE in edit mode, THE Job_Creation_Page SHALL pre-populate the name and goal quantity fields with the existing Job values.

### Requirement 3: Inline Path Definition

**User Story:** As a production planner, I want to define paths with their process steps inline during job creation, so that I do not need to navigate to a separate page to configure routing.

#### Acceptance Criteria

1. THE Job_Creation_Page SHALL provide an "Add Path" control that appends a new empty Path_Draft to the form.
2. WHEN a Path_Draft is added, THE Job_Creation_Page SHALL display inputs for the path name and path goal quantity.
3. THE Job_Creation_Page SHALL allow zero or more Path_Drafts to be defined during job creation.
4. WHEN the user submits the form with a Path_Draft that has an empty name, THE Job_Creation_Page SHALL display a validation error on that Path_Draft and prevent submission.
5. WHEN the user submits the form with a Path_Draft that has a goal quantity less than 1, THE Job_Creation_Page SHALL display a validation error on that Path_Draft and prevent submission.
6. THE Job_Creation_Page SHALL provide a remove control on each Path_Draft that removes the Path_Draft from the form.
7. WHILE in edit mode, THE Job_Creation_Page SHALL pre-populate Path_Drafts from the existing Job's Paths and their Process Steps.

### Requirement 4: Inline Step Definition Within Paths

**User Story:** As a production planner, I want to define process steps within each path during job creation, so that the full routing is configured before the job is saved.

#### Acceptance Criteria

1. WHEN a Path_Draft exists, THE Job_Creation_Page SHALL display an "Add Step" control within that Path_Draft.
2. WHEN a Step_Draft is added, THE Job_Creation_Page SHALL display inputs for the step name (using Process_Library dropdown) and step location (using Location_Library dropdown).
3. WHEN the user submits the form with a Path_Draft containing zero Step_Drafts, THE Job_Creation_Page SHALL display a validation error indicating at least one step is required per path and prevent submission.
4. WHEN the user submits the form with a Step_Draft that has an empty name, THE Job_Creation_Page SHALL display a validation error on that Step_Draft and prevent submission.
5. THE Job_Creation_Page SHALL provide a remove control on each Step_Draft that removes the Step_Draft from its parent Path_Draft, except when only one Step_Draft remains.

### Requirement 5: Step Reordering

**User Story:** As a production planner, I want to reorder process steps within a path by dragging or using move controls, so that I can define the correct step sequence.

#### Acceptance Criteria

1. THE Job_Creation_Page SHALL display the step order number next to each Step_Draft within a Path_Draft.
2. THE Job_Creation_Page SHALL provide move-up and move-down controls on each Step_Draft to change its position within the parent Path_Draft.
3. WHEN the user activates the move-up control on the first Step_Draft, THE Job_Creation_Page SHALL keep the Step_Draft in its current position.
4. WHEN the user activates the move-down control on the last Step_Draft, THE Job_Creation_Page SHALL keep the Step_Draft in its current position.
5. WHEN a Step_Draft is moved, THE Job_Creation_Page SHALL update the displayed order numbers for all Step_Drafts in that Path_Draft.

### Requirement 6: Step Optional/Required Flag

**User Story:** As a production planner, I want to mark steps as optional or required during job creation, so that the routing flexibility is defined upfront.

#### Acceptance Criteria

1. THE Job_Creation_Page SHALL provide a checkbox or toggle on each Step_Draft to set the optional flag.
2. THE Job_Creation_Page SHALL default the optional flag to `false` (required) for new Step_Drafts.
3. WHILE in edit mode, THE Job_Creation_Page SHALL pre-populate the optional flag from the existing Process Step values.

### Requirement 7: Step Dependency Type

**User Story:** As a production planner, I want to set the dependency type for each step during job creation, so that advancement rules are configured before production begins.

#### Acceptance Criteria

1. THE Job_Creation_Page SHALL provide a dropdown on each Step_Draft with options: `physical`, `preferred`, and `completion_gate`.
2. THE Job_Creation_Page SHALL default the dependency type to `preferred` for new Step_Drafts.
3. WHILE in edit mode, THE Job_Creation_Page SHALL pre-populate the dependency type from the existing Process Step values.

### Requirement 8: Step Location

**User Story:** As a production planner, I want to assign a location to each step during job creation, so that operators know where to perform each process.

#### Acceptance Criteria

1. THE Job_Creation_Page SHALL provide a Location_Library dropdown on each Step_Draft for selecting or creating a location.
2. THE Job_Creation_Page SHALL allow the location field to remain empty (location is optional).
3. WHILE in edit mode, THE Job_Creation_Page SHALL pre-populate the location from the existing Process Step values.

### Requirement 9: Path Advancement Mode

**User Story:** As a production planner, I want to set the advancement mode for each path during job creation, so that serial number progression rules are defined before production starts.

#### Acceptance Criteria

1. THE Job_Creation_Page SHALL provide a dropdown on each Path_Draft with options: `strict`, `flexible`, and `per_step`.
2. THE Job_Creation_Page SHALL default the advancement mode to `strict` for new Path_Drafts.
3. WHILE in edit mode, THE Job_Creation_Page SHALL pre-populate the advancement mode from the existing Path values.

### Requirement 10: Path Goal Quantity

**User Story:** As a production planner, I want to set a goal quantity for each path independently, so that different routes can target different production volumes.

#### Acceptance Criteria

1. THE Job_Creation_Page SHALL provide a numeric input for goal quantity on each Path_Draft with a minimum value of 1.
2. THE Job_Creation_Page SHALL default the path goal quantity to the Job-level goal quantity for new Path_Drafts.
3. WHILE in edit mode, THE Job_Creation_Page SHALL pre-populate the path goal quantity from the existing Path values.

### Requirement 11: Template Application

**User Story:** As a production planner, I want to apply a route template to populate a path during job creation, so that I can reuse standard routing definitions without re-entering steps manually.

#### Acceptance Criteria

1. THE Job_Creation_Page SHALL provide an "Apply Template" control within each Path_Draft.
2. WHEN the user selects a Template and confirms, THE Job_Creation_Page SHALL populate the Path_Draft's Step_Drafts with the Template's steps, including name, location, optional flag, and dependency type.
3. WHEN a Template is applied to a Path_Draft that already has Step_Drafts, THE Job_Creation_Page SHALL replace the existing Step_Drafts with the Template's steps.
4. IF no Templates exist in the system, THEN THE Job_Creation_Page SHALL hide the "Apply Template" control.

### Requirement 12: Form Submission — Create Mode

**User Story:** As a production planner, I want to submit the completed form to create the job and all its paths and steps in one operation, so that the entire job configuration is saved atomically.

#### Acceptance Criteria

1. WHEN the user submits a valid form in create mode, THE Job_Creation_Page SHALL send a create job request to the server followed by create path requests for each Path_Draft.
2. WHEN all server requests succeed, THE Job_Creation_Page SHALL navigate the user to the newly created Job's detail page at `/jobs/[id]`.
3. IF any server request fails during submission, THEN THE Job_Creation_Page SHALL display the error message and keep the form populated with the user's input.
4. WHILE a submission is in progress, THE Job_Creation_Page SHALL disable the submit button and display a loading indicator.

### Requirement 13: Form Submission — Edit Mode

**User Story:** As a production planner, I want to submit changes to an existing job and its paths, so that I can update the job configuration from a single page.

#### Acceptance Criteria

1. WHEN the user submits a valid form in edit mode, THE Job_Creation_Page SHALL send update requests for the Job and each modified Path.
2. WHEN the user adds a new Path_Draft in edit mode and submits, THE Job_Creation_Page SHALL send a create path request for the new Path_Draft.
3. WHEN the user removes an existing Path in edit mode and submits, THE Job_Creation_Page SHALL send a delete path request for the removed Path.
4. WHEN all server requests succeed in edit mode, THE Job_Creation_Page SHALL navigate the user to the Job's detail page at `/jobs/[id]`.
5. IF any server request fails during edit submission, THEN THE Job_Creation_Page SHALL display the error message and keep the form populated with the user's input.

### Requirement 14: Client-Side Validation

**User Story:** As a production planner, I want immediate feedback on form errors before submitting, so that I can correct mistakes without waiting for a server round-trip.

#### Acceptance Criteria

1. WHEN the user activates the submit control, THE Job_Creation_Page SHALL validate all fields before sending any server requests.
2. WHEN validation fails, THE Job_Creation_Page SHALL scroll to and visually highlight the first field with an error.
3. THE Job_Creation_Page SHALL display inline error messages adjacent to each invalid field.
4. WHEN the user corrects an invalid field, THE Job_Creation_Page SHALL clear the error message for that field.
