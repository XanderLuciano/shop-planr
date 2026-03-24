# Requirements Document

## Introduction

The Operator View Redesign splits the current monolithic `operator.vue` page into two distinct, properly-routed pages and fixes the broken URL behavior when navigating between process steps.

Currently, the operator page shows all active parts grouped by job and process step, but clicking a step opens the advancement panel inline without updating the URL. This makes process steps non-bookmarkable and breaks browser navigation. The redesign addresses three goals:

1. Repurpose the current page as a "Parts View" — a read/act view of all active parts grouped by job and process step, living at its own URL.
2. Make process steps directly navigable by URL — clicking a step navigates to a dedicated step view page with a proper route, and the URL updates accordingly.
3. Create a new Operator Work Queue page that groups work by operator/assignee, replacing the current operator page's role in the sidebar.

The existing data model has no operator-to-step assignment relationship. The `ProcessStep` type has an optional `assignedTo` field that is sparsely populated. The new operator work queue will need to handle the case where most steps have no assignee, while still providing a useful operator-centric view.

## Glossary

- **Parts_View**: The page displaying all active parts across all jobs, grouped by job and process step, with part counts and advancement capabilities. Formerly the operator page.
- **Step_View**: A dedicated page for a single process step within a job/path, showing the advancement panel, serial selection, and notes. Directly navigable by URL.
- **Operator_Work_Queue**: A new page that groups active work by operator/assignee, showing each operator's assigned steps and part counts.
- **Process_Step**: A single operation in a manufacturing path (e.g., "Milling", "Inspection"), identified by a unique step ID.
- **Work_Queue_Entry**: A row in the operator work queue representing a group of parts at a specific step, associated with an operator.
- **Advancement_Panel**: The UI for selecting serials, entering quantities, adding notes, and confirming advancement to the next step.
- **Operator_Identity**: The currently selected ShopUser, persisted in localStorage, used for audit trail and queue filtering.
- **Unassigned_Work**: Steps that have no `assignedTo` value — work that appears in the operator work queue under an "Unassigned" grouping.

## Requirements

### Requirement 1: Parts View Page at Dedicated Route

**User Story:** As a shop floor user, I want a dedicated Parts View page at its own URL, so that I can bookmark it, share the link, and navigate to it directly.

#### Acceptance Criteria

1. THE Parts_View SHALL be accessible at a dedicated URL path distinct from the Operator_Work_Queue
2. THE Parts_View SHALL display all active parts across all jobs, grouped by job name and then by process step
3. THE Parts_View SHALL show the part count, step name, step location, and path name for each step group
4. THE Parts_View SHALL show the total count of active parts awaiting action across all displayed jobs
5. IF no active parts exist across any job, THEN THE Parts_View SHALL display an empty state message indicating no active work
6. THE Parts_View SHALL provide a search input that filters displayed groups by job name, path name, or step name using case-insensitive partial matching
7. WHEN the search field is empty, THE Parts_View SHALL display all active part groups without filtering

### Requirement 2: Process Step URL Navigation

**User Story:** As a shop floor user, I want clicking a process step to navigate to a dedicated URL for that step, so that I can use browser back/forward, bookmark specific steps, and share step links with coworkers.

#### Acceptance Criteria

1. WHEN a user clicks a process step row in the Parts_View, THE Parts_View SHALL navigate to the Step_View page using client-side routing
2. THE Step_View SHALL be accessible at a URL that encodes the job ID, path ID, and step ID as route parameters
3. WHEN a user navigates directly to a Step_View URL, THE Step_View SHALL load the correct step data and display the Advancement_Panel
4. THE Step_View SHALL display a back link or breadcrumb that returns the user to the Parts_View
5. WHEN a user uses the browser back button from the Step_View, THE browser SHALL return to the Parts_View
6. IF the step ID in the URL does not correspond to a valid active step, THEN THE Step_View SHALL display an error message indicating the step was not found or has no active parts

### Requirement 3: Step View Advancement Panel

**User Story:** As an operator, I want the step view page to provide the full advancement workflow, so that I can advance parts, create serials at the first step, and add notes — all at a bookmarkable URL.

#### Acceptance Criteria

1. THE Step_View SHALL display the Advancement_Panel for the selected process step, showing all serial numbers currently at that step
2. THE Step_View SHALL allow the operator to select one or more serial numbers for advancement
3. WHEN the operator confirms advancement, THE Step_View SHALL advance all selected serial numbers to the next process step
4. IF the selected step is the first step (step order 0) in the path, THEN THE Step_View SHALL display the serial creation panel instead of the standard advancement panel
5. THE Step_View SHALL display the job name, path name, step name, step location, and destination step information
6. WHEN advancement completes successfully, THE Step_View SHALL display a success confirmation and refresh the step data
7. IF all parts at the step have been advanced, THEN THE Step_View SHALL indicate that no parts remain and provide navigation back to the Parts_View

### Requirement 4: Operator Work Queue Page

**User Story:** As a shop floor operator, I want a work queue page that shows work grouped by operator, so that I can see my assigned work separately from other operators' work.

#### Acceptance Criteria

1. THE Operator_Work_Queue SHALL be accessible at a dedicated URL path distinct from the Parts_View
2. THE Operator_Work_Queue SHALL group active work by the `assignedTo` field on each Process_Step
3. WHEN steps have an `assignedTo` value matching a ShopUser, THE Operator_Work_Queue SHALL display those steps under the corresponding operator's name
4. WHEN steps have no `assignedTo` value, THE Operator_Work_Queue SHALL display those steps under an "Unassigned" grouping
5. THE Operator_Work_Queue SHALL show the part count, step name, step location, job name, and path name for each Work_Queue_Entry
6. THE Operator_Work_Queue SHALL show the total part count per operator grouping
7. WHEN a user clicks a Work_Queue_Entry in the Operator_Work_Queue, THE Operator_Work_Queue SHALL navigate to the Step_View page for that step

### Requirement 5: Operator Identity, URL State, and Filtering

**User Story:** As an operator, I want to quickly filter the work queue to show only my assigned work and bookmark that filtered view, so that I can focus on my tasks and return to my personalized view directly via URL.

#### Acceptance Criteria

1. THE Operator_Work_Queue SHALL retain the operator identity selector dropdown from the current implementation
2. WHEN an operator is selected via the identity selector, THE Operator_Work_Queue SHALL highlight or prioritize the selected operator's section in the queue
3. WHEN an operator is selected via the identity selector, THE Operator_Work_Queue SHALL update the URL with a query parameter or slug identifying the selected operator (e.g., `?operator=userId` or `/queue/userId`)
4. WHEN a user navigates directly to an Operator_Work_Queue URL that includes an operator identifier, THE Operator_Work_Queue SHALL automatically select that operator and display their filtered view
5. THE Operator_Work_Queue SHALL persist the selected operator identity in browser localStorage as a fallback when no URL parameter is present
6. WHEN the operator returns to the Operator_Work_Queue page without a URL parameter, THE Operator_Work_Queue SHALL restore the previously selected operator identity from localStorage
7. THE Operator_Work_Queue SHALL provide a search input that filters displayed entries by job name, path name, step name, or operator name using case-insensitive partial matching
8. WHEN the operator clears the operator selection, THE Operator_Work_Queue SHALL remove the operator identifier from the URL and show all work

### Requirement 6: Navigation and Sidebar Integration

**User Story:** As a user, I want clear navigation between the Parts View and Operator Work Queue, so that I can easily switch between the two views.

#### Acceptance Criteria

1. THE application sidebar SHALL include navigation links to both the Parts_View and the Operator_Work_Queue as separate menu items
2. THE Parts_View sidebar link SHALL use a label that clearly indicates it shows all active parts (e.g., "Parts" or "Active Parts")
3. THE Operator_Work_Queue sidebar link SHALL use a label that clearly indicates it shows work by operator (e.g., "Work Queue" or "Operator Queue")
4. WHEN the user is on the Parts_View, THE sidebar SHALL visually indicate the Parts_View link as active
5. WHEN the user is on the Operator_Work_Queue, THE sidebar SHALL visually indicate the Operator_Work_Queue link as active

### Requirement 7: Deprecation of Inline Step Panel Behavior

**User Story:** As a developer, I want the old inline panel behavior removed, so that all step interactions happen at proper URLs and the codebase is consistent.

#### Acceptance Criteria

1. THE Parts_View SHALL NOT open the Advancement_Panel inline when a step is clicked — clicking SHALL navigate to the Step_View instead
2. THE Parts_View SHALL NOT use query parameters (`?jobId=...&pathId=...&stepId=...`) for step selection — step selection SHALL use route-based navigation
3. THE Step_View SHALL be the single location where the Advancement_Panel is rendered for a given step
4. WHEN external pages link to a specific step (e.g., from the job detail page), THE link SHALL point to the Step_View URL rather than the Parts_View with query parameters
