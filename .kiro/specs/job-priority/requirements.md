# Requirements Document

## Introduction

This document defines the requirements for the Job Page Priority feature (GitHub Issue #71). The feature adds a master priority system to the Jobs page, allowing users to enter a priority-editing mode, drag-and-drop jobs to reorder them, and save the new ordering. Each job's list position becomes its priority number (1 = top = highest priority). The priority is persisted on the `jobs` table and returned in all job API responses. This lays the groundwork for future work-queue ordering by priority (out of scope).

## Glossary

- **Jobs_Page**: The frontend page (`app/pages/jobs/index.vue`) that displays the list of all production jobs
- **Job**: A production order tracked in the `jobs` database table, identified by a unique ID
- **Priority**: A positive integer (≥ 1) assigned to each Job representing its shop-floor ordering; lower numbers indicate higher priority
- **Priority_Edit_Mode**: A UI state on the Jobs Page where drag-and-drop reordering is enabled and row-click navigation is disabled
- **Priority_List**: The complete ordered array of all jobs with their assigned priority numbers, forming a contiguous sequence from 1 to N
- **Job_Service**: The server-side business logic layer (`jobService`) responsible for validating and executing priority operations
- **Job_Repository**: The data access layer responsible for persisting job data to SQLite
- **Priority_Composable**: The client-side composable (`useJobPriority`) managing drag-and-drop state and API communication
- **Bulk_Priority_Endpoint**: The `PATCH /api/jobs/priorities` API route that accepts a full priority reordering

## Requirements

### Requirement 1: Persist Job Priority

**User Story:** As a shop manager, I want each job to have a persistent priority number, so that the job list reflects the shop-floor ordering at all times.

#### Acceptance Criteria

1. THE Job_Repository SHALL store a `priority` integer column on the `jobs` table
2. WHEN the database is migrated, THE Job_Repository SHALL backfill existing jobs with sequential priority values based on creation date order (oldest job = priority 1)
3. WHEN a new job is created and other jobs exist, THE Job_Service SHALL assign the new job a priority equal to the current maximum priority plus one
4. WHEN a new job is created and no other jobs exist, THE Job_Service SHALL assign the new job a priority of 1
5. THE Job_Repository SHALL index the `priority` column for efficient ordering

### Requirement 2: List Jobs by Priority

**User Story:** As a shop floor user, I want the jobs list to be sorted by priority, so that I can see the most important jobs first.

#### Acceptance Criteria

1. WHEN listing jobs, THE Job_Repository SHALL return jobs sorted by priority in ascending order (priority 1 first)
2. THE Job_Service SHALL include the `priority` field in all job API responses

### Requirement 3: Bulk Update Job Priorities

**User Story:** As a shop manager, I want to submit a reordered priority list for all active jobs, so that the new ordering is persisted atomically.

#### Acceptance Criteria

1. WHEN a valid Priority_List is submitted to the Bulk_Priority_Endpoint, THE Job_Service SHALL update every active job's priority to the specified value
2. WHEN a Priority_List is submitted, THE Job_Service SHALL validate that the list includes every active (non-completed) job exactly once
3. WHEN a Priority_List contains duplicate job IDs, THEN THE Job_Service SHALL reject the request with a validation error
4. WHEN a Priority_List contains duplicate priority values, THEN THE Job_Service SHALL reject the request with a validation error
5. WHEN a Priority_List contains priorities that do not form a contiguous sequence from 1 to N, THEN THE Job_Service SHALL reject the request with a validation error
6. WHEN a Priority_List references a job ID that does not exist, THEN THE Job_Service SHALL reject the request with a not-found error
7. WHEN a Priority_List count does not match the total number of active jobs in the database, THEN THE Job_Service SHALL reject the request with a validation error
8. WHEN the Bulk_Priority_Endpoint processes a valid request, THE Job_Repository SHALL execute all priority updates within a single database transaction
9. IF a database error occurs during the bulk update, THEN THE Job_Repository SHALL roll back all changes so that no partial updates persist
10. WHEN a job is completed (completedParts >= goalQuantity), THE Job_Service SHALL exclude it from the Priority_List and assign it priority 0
11. WHEN priorities are saved, THE Job_Service SHALL also set priority 0 for any completed jobs that still have a non-zero priority

### Requirement 4: Enter and Exit Priority Edit Mode

**User Story:** As a shop manager, I want to toggle a priority editing mode on the Jobs page, so that I can reorder jobs without accidentally navigating away.

#### Acceptance Criteria

1. WHEN the user clicks the "Edit Priority" button on the Jobs_Page, THE Priority_Composable SHALL enter Priority_Edit_Mode and snapshot the current job order
2. WHILE in Priority_Edit_Mode, THE Jobs_Page SHALL display drag handles on each job row and show "Save" and "Cancel" buttons
3. WHILE in Priority_Edit_Mode, THE Jobs_Page SHALL disable row-click navigation to prevent accidental page changes
4. WHEN the user clicks "Cancel", THE Priority_Composable SHALL restore the job order to the snapshot taken at edit mode entry and exit Priority_Edit_Mode
5. WHEN the user clicks "Save", THE Priority_Composable SHALL submit the reordered Priority_List to the Bulk_Priority_Endpoint and exit Priority_Edit_Mode upon success

### Requirement 5: Drag-and-Drop Reordering

**User Story:** As a shop manager, I want to drag and drop jobs to reorder them, so that I can intuitively set the priority by position.

#### Acceptance Criteria

1. WHILE in Priority_Edit_Mode, THE Jobs_Page SHALL allow the user to drag a job row from one position and drop it at another position
2. WHEN a job is dragged from one position to another, THE Priority_Composable SHALL move the job to the target position and shift other jobs to fill the gap
3. WHEN a reorder operation completes, THE Priority_Composable SHALL preserve the same set of jobs with the same total count (no jobs added or removed)
4. THE Jobs_Page SHALL display the numeric priority (position number) for each job row during Priority_Edit_Mode

### Requirement 6: Priority Display

**User Story:** As a shop floor user, I want to see each job's priority number in the job list, so that I know the relative importance of each job.

#### Acceptance Criteria

1. THE Jobs_Page SHALL display a priority column showing each job's numeric priority value
2. WHEN priorities are updated and saved, THE Jobs_Page SHALL refresh the job list to reflect the new priority ordering

### Requirement 7: Save Feedback

**User Story:** As a shop manager, I want visual feedback while priorities are being saved, so that I know the system is processing my changes.

#### Acceptance Criteria

1. WHILE the Priority_Composable is submitting priorities to the Bulk_Priority_Endpoint, THE Jobs_Page SHALL display a loading indicator on the Save button
2. IF the save request fails, THEN THE Jobs_Page SHALL display an error notification and remain in Priority_Edit_Mode so the user can retry or cancel

### Requirement 8: Mobile Priority Editing

**User Story:** As a shop floor user on a mobile device, I want to reorder job priorities on the mobile job list, so that I can manage priorities from any device.

#### Acceptance Criteria

1. WHILE in Priority_Edit_Mode on a mobile viewport, THE Jobs_Page SHALL enable drag-and-drop reordering on the JobMobileCard list
2. WHILE in Priority_Edit_Mode on a touch device, THE Jobs_Page SHALL support touch-based drag-and-drop via touchstart, touchmove, and touchend events

### Requirement 9: Data Integrity

**User Story:** As a system administrator, I want the priority column to enforce NOT NULL constraints, so that no job can exist without a valid priority value.

#### Acceptance Criteria

1. THE Job_Repository SHALL enforce a NOT NULL DEFAULT 0 constraint on the `priority` column
2. WHEN the database is migrated from 009 to 010, THE migration SHALL re-sequence priorities using rowid as a tiebreaker for jobs with identical created_at timestamps
