# Bugfix Requirements Document

## Introduction

The StepAssignmentDropdown component on the `/jobs/[id]` page fails to assign users to process steps. When a user selects a person from the dropdown, the assignment does not take effect. The root cause is a data type mismatch in the `@update:model-value` event handler: Nuxt UI's `USelectMenu` with `value-key="value"` emits the raw value (a string userId or null), but the `handleSelection` handler expects a `SelectMenuItem` object and accesses `item?.value`, which is undefined on a plain string — resulting in `null` always being sent to the API.

Additionally, the StepAssignmentDropdown is rendered in a separate `<div>` below the StepTracker in the parent page, making it visually disconnected from the step data it controls. The steps in StepTracker also use `min-w-[80px]` which is too narrow when the dropdown is integrated.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user selects an assignee from the StepAssignmentDropdown THEN the system sends `null` as the userId to the PATCH `/api/steps/{id}/assign` endpoint because `handleSelection` receives a raw string value but destructures it as `item?.value`, which is `undefined` on a string, defaulting to `null`

1.2 WHEN a user selects "Unassigned" from the StepAssignmentDropdown THEN the system sends `null` correctly by coincidence, but the handler logic is still incorrect (accessing `.value` on a raw value)

1.3 WHEN the StepAssignmentDropdown is rendered on the `/jobs/[id]` page THEN it appears in a separate `<div>` below the StepTracker, visually disconnected from the step columns it corresponds to

1.4 WHEN the StepTracker renders step columns THEN each step has `min-w-[80px]` which is too narrow to accommodate an integrated assignment dropdown

### Expected Behavior (Correct)

2.1 WHEN a user selects an assignee from the StepAssignmentDropdown THEN the system SHALL send the correct userId string to the PATCH `/api/steps/{id}/assign` endpoint and the step assignment SHALL be persisted in the database

2.2 WHEN a user selects "Unassigned" from the StepAssignmentDropdown THEN the system SHALL send `null` as the userId to unassign the step, using correct handler logic that properly extracts the value

2.3 WHEN the StepAssignmentDropdown is rendered on the `/jobs/[id]` page THEN it SHALL appear inside the StepTracker component, integrated within each step column alongside the step's other data

2.4 WHEN the StepTracker renders step columns THEN each step SHALL have a wider minimum width (e.g. `min-w-[120px]`) to accommodate the integrated assignment dropdown

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the PATCH `/api/steps/{id}/assign` endpoint receives a valid userId THEN the system SHALL CONTINUE TO validate the user exists and is active before persisting the assignment

3.2 WHEN the PATCH `/api/steps/{id}/assign` endpoint receives `null` as userId THEN the system SHALL CONTINUE TO clear the step assignment (unassign)

3.3 WHEN a step assignment API call fails THEN the StepAssignmentDropdown SHALL CONTINUE TO revert the optimistic update and show an error toast

3.4 WHEN the StepTracker displays step distribution data (serial counts, completed counts, bottleneck badges) THEN the system SHALL CONTINUE TO render all existing step information correctly

3.5 WHEN a user clicks a step in the StepTracker THEN the system SHALL CONTINUE TO navigate to the step view page (`/parts/step/{stepId}`)

3.6 WHEN the parent page receives the `assigned` event from StepAssignmentDropdown THEN the system SHALL CONTINUE TO reload distributions and path data via `onStepAssigned`
