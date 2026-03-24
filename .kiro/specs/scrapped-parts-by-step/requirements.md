# Requirements Document

## Introduction

After the `scrapped-sn-operator-view` bugfix excludes scrapped serials from the operator work queue, supervisors and quality engineers lose visibility into which parts were scrapped and at which process step. This feature adds the ability to view scrapped serial numbers at two levels: (1) grouped by the step where they were scrapped within a specific path (operator view), and (2) all scrapped serials for an entire job grouped by path and scrap step (job detail view). The step-level approach extends the existing `listByStepIndex` repository method with an optional status filter parameter. The job-level approach filters the existing `listByJobId` results to scrapped status and groups them by path and scrap step in the service layer. Both approaches avoid method proliferation, keep business logic in the service layer, and are backward-compatible with all existing callers.

## Glossary

- **Serial_Repository**: The data-access interface (`server/repositories/interfaces/serialRepository.ts`) that defines query methods for serial numbers, including `listByStepIndex`
- **SQLite_Serial_Repository**: The SQLite implementation of Serial_Repository (`server/repositories/sqlite/serialRepository.ts`)
- **Serial_Service**: The service-layer module (`server/services/serialService.ts`) that exposes serial query and mutation methods to API routes
- **Operator_Queue_API**: The API route (`server/api/operator/queue/[userId].get.ts`) that aggregates serials per step across all jobs and paths for the operator work queue
- **Status_Filter**: An optional parameter accepted by `listByStepIndex` that controls which serials are returned based on their `status` field. Valid values: `'in_progress'` (default — active serials only), `'scrapped'` (scrapped serials only), `'all'` (all serials regardless of status)
- **Scrap_Step_Id**: The `scrapStepId` field on a SerialNumber record that stores the ID of the process step where the serial was scrapped
- **Operator_View**: The frontend page (`app/pages/operator.vue`) that displays the operator work queue grouped by process step
- **Work_Queue_Job**: A computed view type representing a group of serials at a specific step within a job/path, displayed in the operator queue
- **Job_Detail_Page**: The frontend page (`app/pages/jobs/[id].vue`) that displays job information, paths, steps, serial numbers, and progress
- **Scrapped_Serial_Group**: A computed view type representing a group of scrapped serials at a specific step within a path, including step metadata and scrap details for each serial
- **Job_Scrapped_Response**: A computed view type representing all scrapped serials for a job, organized by path and then by scrap step within each path

## Requirements

### Requirement 1: Extend Repository Method with Status Filter

**User Story:** As a developer, I want the `listByStepIndex` repository method to accept an optional status filter, so that callers can request active serials, scrapped serials, or all serials at a given step without needing separate methods.

#### Acceptance Criteria

1. THE Serial_Repository interface SHALL define `listByStepIndex` with an optional third parameter `status` of type `'in_progress' | 'scrapped' | 'all'`
2. WHEN `listByStepIndex` is called without a `status` parameter, THE SQLite_Serial_Repository SHALL return only serials where `status != 'scrapped'` (preserving the bugfix behavior)
3. WHEN `listByStepIndex` is called with `status = 'in_progress'`, THE SQLite_Serial_Repository SHALL return only serials where `status = 'in_progress'` at the given path and step index
4. WHEN `listByStepIndex` is called with `status = 'scrapped'`, THE SQLite_Serial_Repository SHALL return only serials where `status = 'scrapped'` and `scrap_step_id` matches the step ID corresponding to the given step index in the path
5. WHEN `listByStepIndex` is called with `status = 'all'`, THE SQLite_Serial_Repository SHALL return all serials at the given path and step index regardless of status
6. THE SQLite_Serial_Repository SHALL order results by `created_at ASC` for all status filter values

### Requirement 2: Expose Status Filter Through Service Layer

**User Story:** As a developer, I want the serial service to pass the status filter through to the repository, so that API routes can request filtered serial lists without containing business logic.

#### Acceptance Criteria

1. THE Serial_Service `listSerialsByStepIndex` method SHALL accept an optional third parameter `status` of type `'in_progress' | 'scrapped' | 'all'`
2. WHEN `listSerialsByStepIndex` is called with a `status` parameter, THE Serial_Service SHALL pass the value through to `Serial_Repository.listByStepIndex`
3. WHEN `listSerialsByStepIndex` is called without a `status` parameter, THE Serial_Service SHALL call `Serial_Repository.listByStepIndex` without a status value, preserving the default behavior
4. IF `listSerialsByStepIndex` is called with an invalid `status` value, THEN THE Serial_Service SHALL reject the call with a validation error

### Requirement 3: Preserve Existing Operator Queue Behavior

**User Story:** As an operator, I want the work queue to continue showing only active (non-scrapped) serials, so that the bugfix behavior is preserved after the status filter is added.

#### Acceptance Criteria

1. THE Operator_Queue_API SHALL continue to call `serialService.listSerialsByStepIndex` without a status filter (or with `'in_progress'`), so that scrapped serials remain excluded from the operator work queue
2. WHEN a serial has been scrapped, THE Operator_Queue_API SHALL NOT include that serial in any Work_Queue_Job's `serialIds` or `partCount`
3. WHEN all serials at a step have been scrapped, THE Operator_Queue_API SHALL omit that step group from the queue response entirely

### Requirement 4: API Endpoint for Scrapped Serials by Step

**User Story:** As a frontend developer, I want an API endpoint that returns scrapped serials grouped by step for a given path, so that the operator view can display scrap information per step.

#### Acceptance Criteria

1. THE system SHALL provide an API endpoint that accepts a `pathId` parameter and returns scrapped serials grouped by the step where they were scrapped
2. WHEN the endpoint is called for a valid path, THE system SHALL return for each step: the step ID, step name, step order, and the list of scrapped serials at that step (including serial ID, scrap reason, scrap explanation, scrapped-at timestamp, and scrapped-by user ID)
3. WHEN the endpoint is called for a path with no scrapped serials, THE system SHALL return an empty list of step groups
4. IF the endpoint is called with a non-existent `pathId`, THEN THE system SHALL return a 404 error
5. THE system SHALL use the `scrapStepId` field on each scrapped serial to determine which step the serial was scrapped at

### Requirement 5: Frontend Display of Scrapped Parts by Step

**User Story:** As a supervisor, I want to see which parts were scrapped at each process step in the operator view, so that I can identify problem areas in the production process.

#### Acceptance Criteria

1. THE Operator_View SHALL provide a UI control (toggle, tab, or expandable section) that allows users to view scrapped serials grouped by step
2. WHEN the user activates the scrapped-parts view, THE Operator_View SHALL fetch and display scrapped serials for each step that has scrapped parts
3. THE Operator_View SHALL display for each scrapped serial: the serial ID, the scrap reason, and the scrap explanation (when available)
4. WHEN a step has no scrapped serials, THE Operator_View SHALL omit that step from the scrapped-parts display
5. WHILE the scrapped-parts data is loading, THE Operator_View SHALL display a loading indicator
6. IF the scrapped-parts fetch fails, THEN THE Operator_View SHALL display an error message with a retry option

### Requirement 6: Backward Compatibility

**User Story:** As a developer, I want the status filter parameter to be fully backward-compatible, so that all existing callers of `listByStepIndex` and `listSerialsByStepIndex` continue to work without modification.

#### Acceptance Criteria

1. THE Serial_Repository interface change SHALL be backward-compatible: existing callers that pass two arguments to `listByStepIndex` SHALL continue to compile and function correctly
2. THE Serial_Service method change SHALL be backward-compatible: existing callers that pass two arguments to `listSerialsByStepIndex` SHALL continue to compile and function correctly
3. WHEN the status parameter is omitted, THE system SHALL default to excluding scrapped serials (matching the post-bugfix behavior)
4. THE `listByPathId` and `listByJobId` repository methods SHALL remain unchanged and SHALL continue to return all serials regardless of status

### Requirement 7: API Endpoint for Scrapped Serials by Job

**User Story:** As a frontend developer, I want an API endpoint that returns all scrapped serials for a given job grouped by path and scrap step, so that the job detail page can display a comprehensive scrap summary across all paths.

#### Acceptance Criteria

1. THE system SHALL provide an API endpoint that accepts a `jobId` parameter and returns all scrapped serials for that job, grouped first by path and then by the step where each serial was scrapped
2. WHEN the endpoint is called for a valid job, THE system SHALL return for each path that contains scrapped serials: the path ID, path name, and a list of Scrapped_Serial_Groups (one per step that has scrapped serials in that path)
3. WHEN the endpoint is called for a valid job, THE system SHALL return for each Scrapped_Serial_Group: the step ID, step name, step order, and the list of scrapped serials at that step (including serial ID, scrap reason, scrap explanation, scrapped-at timestamp, and scrapped-by user ID)
4. WHEN the endpoint is called for a job with no scrapped serials, THE system SHALL return an empty list of path groups
5. IF the endpoint is called with a non-existent `jobId`, THEN THE system SHALL return a 404 error
6. THE system SHALL use the existing `listByJobId` repository method (which returns all serials for a job) and filter to scrapped status in the service layer, keeping business logic out of the repository
7. THE system SHALL use the `scrapStepId` field on each scrapped serial to determine which step the serial was scrapped at, and SHALL resolve step metadata (name, order) from the path's process steps

### Requirement 8: Frontend Display of Scrapped Parts at Job Level

**User Story:** As a supervisor, I want to see all scrapped parts for a job on the job detail page grouped by path and step, so that I can assess total scrap impact across the entire job without navigating to each path individually.

#### Acceptance Criteria

1. THE Job_Detail_Page SHALL provide a UI control (tab, expandable section, or dedicated panel) that allows users to view all scrapped serials for the current job
2. WHEN the user activates the job-level scrapped-parts view, THE Job_Detail_Page SHALL fetch and display scrapped serials grouped by path and then by scrap step within each path
3. THE Job_Detail_Page SHALL display for each scrapped serial: the serial ID, the scrap reason, the scrap explanation (when available), the scrapped-at timestamp, and the scrapped-by user ID
4. THE Job_Detail_Page SHALL display the path name and step name as group headers so the user can identify where each scrap occurred
5. WHEN a job has no scrapped serials, THE Job_Detail_Page SHALL display an empty-state message indicating no parts have been scrapped
6. WHILE the scrapped-parts data is loading, THE Job_Detail_Page SHALL display a loading indicator
7. IF the scrapped-parts fetch fails, THEN THE Job_Detail_Page SHALL display an error message with a retry option
