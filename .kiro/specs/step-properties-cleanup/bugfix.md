# Bugfix Requirements Document

## Introduction

GitHub Issue #109 identifies one bug and three cleanup items introduced by the step properties PR (#108) and the add-note-to-parts PR (#107). The bug is a partial save failure in `StepPropertiesEditor` that leaves inconsistent state when one of two sequential PATCH requests fails. The cleanup items are: a dead `onStepAssigned` handler in `jobs/[id].vue`, an orphaned `StepAssignmentDropdown.vue` component with no remaining consumers, and empty strings being stored as location values in SQLite instead of NULLs.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user edits both assignee and location in StepPropertiesEditor and the assignee PATCH succeeds but the location PATCH fails THEN the system persists the assignee change, shows a generic "Save failed" toast, does not roll back the assignee, and does not re-fetch the step — leaving the UI out of sync with the actual persisted state

1.2 WHEN a user edits both assignee and location in StepPropertiesEditor and the assignee PATCH fails THEN the system shows a generic "Save failed" toast without indicating which field failed, and the location PATCH is never attempted

1.3 WHEN a user clears the location field in StepPropertiesEditor and saves THEN the system sends `{ location: '' }` to `PATCH /api/steps/:id/config`, which writes an empty string to the `location` column in SQLite instead of NULL, polluting the database with empty strings where NULLs are the convention

1.4 WHEN the `onStepAssigned` function is defined in `app/pages/jobs/[id].vue` THEN it is unreachable dead code because the `@assigned` event binding was removed from StepTracker in the template during the step properties PR

1.5 WHEN the `StepAssignmentDropdown.vue` component exists in `app/components/` THEN it is an orphaned file with no remaining template references, since StepTracker (its only consumer) was refactored to use inline text display for assignees

### Expected Behavior (Correct)

2.1 WHEN a user edits both assignee and location in StepPropertiesEditor and one PATCH request fails THEN the system SHALL re-fetch the step data so the UI reflects the actual persisted state, preventing the UI from showing stale or inconsistent values

2.2 WHEN a user edits both assignee and location in StepPropertiesEditor and one PATCH request fails THEN the system SHALL display a toast message that indicates which specific field(s) failed to save

2.3 WHEN a user clears the location field in StepPropertiesEditor and saves THEN the system SHALL normalize the empty or whitespace-only string to `undefined` (or `null`) in the API handler so that the database stores NULL instead of an empty string

2.4 WHEN the `onStepAssigned` dead function is identified in `app/pages/jobs/[id].vue` THEN it SHALL be removed along with any related unused code

2.5 WHEN the orphaned `StepAssignmentDropdown.vue` component is identified THEN the file SHALL be deleted from the codebase

### Unchanged Behavior (Regression Prevention)

3.1 WHEN both assignee and location PATCH requests succeed THEN the system SHALL CONTINUE TO show a "Step updated" success toast and emit the `saved` event

3.2 WHEN neither assignee nor location has changed THEN the system SHALL CONTINUE TO emit the `saved` event immediately without making any API calls

3.3 WHEN a user sets a non-empty location value THEN the system SHALL CONTINUE TO persist the location string as-is to the database

3.4 WHEN the `PATCH /api/steps/:id/config` endpoint receives `optional` or `dependencyType` fields THEN the system SHALL CONTINUE TO process those fields correctly without any change in behavior

3.5 WHEN the StepTracker component renders step data on the job detail page THEN the system SHALL CONTINUE TO display step distributions, assignee names, locations, and navigation correctly

3.6 WHEN property-based tests reference `StepAssignmentDropdown` filter logic (e.g., `dropdownFilter.property.test.ts`) THEN those tests SHALL CONTINUE TO pass since they duplicate the filter logic inline and do not import the component file
