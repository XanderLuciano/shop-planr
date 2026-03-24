# Requirements Document

## Introduction

This feature adds four related capabilities to Shop Planr: (1) assigning process steps to operators via a searchable dropdown, (2) a dedicated tabbed part detail page showing routing/step information on one tab and a serial numbers table on another, (3) clickable job steps that navigate to the operator advancement view, and (4) a serial number browser page with search, filter, sort, and navigation to part details. Together these capabilities close the loop between job management, operator assignment, and part-level visibility.

## Glossary

- **Step_Assignment_Service**: The backend service responsible for assigning and unassigning ShopUsers to ProcessSteps
- **Step_Assignment_Dropdown**: A searchable dropdown UI control for selecting an active ShopUser or Unassigned to assign to a ProcessStep
- **Unassigned**: A reserved system concept representing the absence of an assigned user; displayed as "Unassigned" in the UI and stored as NULL in the database
- **Part_Detail_Page**: A dedicated tabbed page view displaying routing/step information and serial number details for a Job's Path
- **Routing_Tab**: The first tab on the Part_Detail_Page showing process steps, assignments, distribution, and advancement
- **Serials_Tab**: The second tab on the Part_Detail_Page showing a table of all serial numbers for the associated Job/Path
- **Serial_Browser**: A page listing all SerialNumbers with search, filter, sort, and navigation capabilities
- **Process_Advancement_Panel**: The existing card-based UI for advancing serial numbers through process steps
- **Work_Queue**: The existing operator work queue showing jobs with parts at assigned steps
- **Job_Step_Link**: A clickable element on the jobs view that navigates to the operator advancement view for a specific step
- **SerialNumber**: A unique identifier for an individual tracked part, with a current_step_index indicating progress
- **ProcessStep**: A single operation in a manufacturing path (e.g., "Milling", "Inspection")
- **ShopUser**: A kiosk-mode user profile representing a shop floor operator
- **Path**: A route instance defining the sequence of ProcessSteps for a Job
- **Job**: A production order containing parts that flow through ProcessSteps

## Requirements

### Requirement 1: Database Schema for Step Assignment

**User Story:** As a system administrator, I want the process_steps table to support an assigned_to column, so that step assignments can be persisted.

#### Acceptance Criteria

1. THE Step_Assignment_Service SHALL add a nullable `assigned_to` column of type TEXT to the `process_steps` table via migration 003
2. THE `assigned_to` column SHALL reference the `users` table `id` column as a foreign key
3. WHEN a ShopUser referenced by `assigned_to` does not exist in the `users` table, THEN THE Step_Assignment_Service SHALL reject the assignment with a validation error
4. THE ProcessStep domain type SHALL include an optional `assignedTo` field of type string
5. WHEN the `assigned_to` column is NULL, THE system SHALL treat the ProcessStep as Unassigned

### Requirement 2: Step Assignment API

**User Story:** As a shop manager, I want to assign and unassign operators to process steps via the API, so that step ownership is tracked.

#### Acceptance Criteria

1. WHEN a valid ShopUser ID is provided for a ProcessStep, THE Step_Assignment_Service SHALL update the `assigned_to` column for that step
2. WHEN "unassigned" or null is provided for assignment, THE Step_Assignment_Service SHALL clear the `assigned_to` column for that step (set to NULL)
3. IF the provided ShopUser ID is not "unassigned" and does not correspond to an active ShopUser, THEN THE Step_Assignment_Service SHALL return a validation error
4. IF the provided ProcessStep ID does not exist, THEN THE Step_Assignment_Service SHALL return a not-found error
5. WHEN a step assignment is updated, THE Step_Assignment_Service SHALL return the updated ProcessStep with the assignedTo field populated (or null for Unassigned)

### Requirement 3: Step Assignment Dropdown UI

**User Story:** As a shop manager, I want a searchable dropdown on each process step to assign an operator, so that I can quickly delegate work.

#### Acceptance Criteria

1. THE Step_Assignment_Dropdown SHALL display on each ProcessStep in the job detail view
2. THE Step_Assignment_Dropdown SHALL list "Unassigned" as the first option, followed by all active ShopUsers as selectable options
3. THE Step_Assignment_Dropdown SHALL support type-ahead search filtering by ShopUser name (case-insensitive partial match); the "Unassigned" option SHALL always remain visible regardless of search input
4. WHEN a ShopUser is selected from the Step_Assignment_Dropdown, THE Step_Assignment_Dropdown SHALL call the Step_Assignment_Service to persist the assignment
5. WHEN "Unassigned" is selected from the Step_Assignment_Dropdown, THE Step_Assignment_Dropdown SHALL call the Step_Assignment_Service to remove the assignment (set to NULL)
6. THE Step_Assignment_Dropdown SHALL display the currently assigned ShopUser name when a step has an existing assignment, or "Unassigned" when no assignment exists
7. IF the assignment API call fails, THEN THE Step_Assignment_Dropdown SHALL display an error notification and revert to the previous selection

### Requirement 4: Part Detail Page — Tabbed Layout and Routing Overview

**User Story:** As a shop manager, I want a dedicated page for a single serial number with tabs for routing and serial numbers, so that I can see the full manufacturing context and all related parts.

#### Acceptance Criteria

1. THE Part_Detail_Page SHALL be accessible at the route `/serials/[id]` where `id` is the SerialNumber identifier
2. THE Part_Detail_Page SHALL display the SerialNumber identifier, associated Job name, and associated Path name
3. THE Part_Detail_Page SHALL provide a tab bar at the top with two tabs: Routing_Tab and Serials_Tab
4. THE Routing_Tab SHALL be the default active tab when the page loads
5. THE Routing_Tab SHALL display all ProcessSteps in the associated Path in order, showing step name, step order, and location
6. THE Routing_Tab SHALL visually indicate which ProcessStep the SerialNumber is currently at (the active step)
7. WHEN the SerialNumber has a currentStepIndex of -1, THE Routing_Tab SHALL indicate the part is completed
8. THE Routing_Tab SHALL display the assigned ShopUser name for each ProcessStep, or "Unassigned" when no assignment exists
9. THE Routing_Tab SHALL display the count of SerialNumbers at each ProcessStep (step distribution from the Path)

### Requirement 5: Part Detail Page — Process Advancement

**User Story:** As an operator, I want to advance a part from its detail page, so that I can process parts without switching to the operator queue.

#### Acceptance Criteria

1. THE Routing_Tab SHALL display the Process_Advancement_Panel for the SerialNumber at its current step
2. THE Process_Advancement_Panel on the Routing_Tab SHALL pre-select the current SerialNumber for advancement
3. WHEN the operator advances the SerialNumber from the Routing_Tab, THE Part_Detail_Page SHALL refresh the routing overview to reflect the new step
4. IF the SerialNumber is already completed (currentStepIndex = -1), THEN THE Routing_Tab SHALL not display the Process_Advancement_Panel

### Requirement 6: Clickable Job Steps Navigation

**User Story:** As a shop manager, I want to click on a step in the jobs view to navigate to the operator advancement view for that step, so that I can quickly act on bottlenecks.

#### Acceptance Criteria

1. WHEN a user clicks on a ProcessStep in the StepTracker component on the job detail page, THE Job_Step_Link SHALL navigate to the operator page
2. THE Job_Step_Link SHALL pass the step context (jobId, pathId, stepId) as query parameters so the operator page can pre-select the correct Work_Queue entry
3. WHEN the operator page receives step context query parameters, THE Work_Queue SHALL automatically select and display the Process_Advancement_Panel for the matching step
4. IF no parts exist at the clicked step, THEN THE Job_Step_Link SHALL still navigate to the operator page but the Process_Advancement_Panel SHALL display an empty state

### Requirement 7: Serial Number Browser — Listing

**User Story:** As a shop manager, I want a page to browse all serial numbers, so that I can find and inspect any part in the system.

#### Acceptance Criteria

1. THE Serial_Browser SHALL be accessible at the route `/serials`
2. THE Serial_Browser SHALL display a scrollable list of all SerialNumbers in the system
3. THE Serial_Browser SHALL display for each SerialNumber: the identifier, associated Job name, associated Path name, current step name, and status (in-progress or completed)
4. THE Serial_Browser SHALL support pagination or virtual scrolling to handle large datasets without performance degradation
5. WHEN the user clicks on a SerialNumber row, THE Serial_Browser SHALL navigate to the Part_Detail_Page for that SerialNumber

### Requirement 8: Serial Number Browser — Search

**User Story:** As a shop manager, I want to search serial numbers by identifier, so that I can quickly find a specific part.

#### Acceptance Criteria

1. THE Serial_Browser SHALL provide a search input field
2. WHEN the user enters text in the search field, THE Serial_Browser SHALL filter SerialNumbers by identifier (case-insensitive partial match)
3. THE Serial_Browser SHALL debounce search input by 300ms before applying the filter
4. WHEN the search field is cleared, THE Serial_Browser SHALL display all SerialNumbers

### Requirement 9: Serial Number Browser — Filtering

**User Story:** As a shop manager, I want to filter serial numbers by job, path, step, and status, so that I can narrow down to relevant parts.

#### Acceptance Criteria

1. THE Serial_Browser SHALL provide filter controls for: Job name, Path name, current step name, status (in-progress, completed, all), and assigned operator (including "Unassigned" as a filter option)
2. WHEN a filter is applied, THE Serial_Browser SHALL display only SerialNumbers matching all active filter criteria (AND logic)
3. WHEN the "Unassigned" assignee filter is selected, THE Serial_Browser SHALL display only SerialNumbers whose current ProcessStep has no assignment
4. WHEN filters are cleared, THE Serial_Browser SHALL display all SerialNumbers
5. THE Serial_Browser SHALL display the count of filtered results versus total results when filters are active

### Requirement 10: Serial Number Browser — Sorting

**User Story:** As a shop manager, I want to sort serial numbers by various properties, so that I can organize the list to find what I need.

#### Acceptance Criteria

1. THE Serial_Browser SHALL support sorting by: SerialNumber identifier, Job name, current step name, status, and created date
2. WHEN the user clicks a sortable column header, THE Serial_Browser SHALL sort the list by that column in ascending order
3. WHEN the user clicks the same column header again, THE Serial_Browser SHALL toggle the sort direction to descending
4. THE Serial_Browser SHALL indicate the active sort column and direction visually

### Requirement 11: Part Detail Page — Serial Numbers Tab

**User Story:** As a shop manager, I want a serial numbers tab on the part detail page showing all serials for that job/path, so that I can see the status of every part in the same production run.

#### Acceptance Criteria

1. THE Serials_Tab SHALL display a table of all SerialNumbers associated with the same Job and Path as the current SerialNumber
2. THE Serials_Tab SHALL display for each SerialNumber: the identifier, current step name, status (in-progress or completed), and created date
3. THE Serials_Tab SHALL visually highlight the row for the currently viewed SerialNumber
4. WHEN the user clicks on a different SerialNumber row in the Serials_Tab, THE Part_Detail_Page SHALL navigate to the Part_Detail_Page for that SerialNumber
5. THE Serials_Tab SHALL support sorting by identifier, current step, status, and created date
6. THE Serials_Tab SHALL display a summary row showing total count, completed count, and in-progress count
