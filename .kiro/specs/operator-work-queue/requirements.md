# Requirements Document

## Introduction

The Operator Work Queue feature enhances the existing operator view in Shop Planr to provide a better user experience for shop floor operators. Currently, operators must type in a process or operation name to see their work, which is cumbersome. This feature introduces a work queue that shows all assigned jobs by default, allows filtering/searching, and provides a streamlined workflow for advancing parts through processes and recording completions with optional notes.

## Glossary

- **Work_Queue**: The primary view showing all jobs currently assigned to an operator
- **Operator**: A shop floor user who processes parts through manufacturing steps
- **Job**: A production order containing parts that flow through process steps
- **Path**: A route instance defining the sequence of process steps for a job
- **Process_Step**: A single operation in a manufacturing path (e.g., "Milling", "Inspection")
- **Serial_Number**: A unique identifier for an individual tracked part
- **Part_Completion**: The action of advancing a serial number through or completing a process step
- **Completion_Note**: Optional text annotation recorded when completing a step

## Requirements

### Requirement 1: Default Work Queue Display

**User Story:** As an operator, I want to see all my assigned jobs when I open the operator view, so that I can immediately see my workload without searching.

#### Acceptance Criteria

1. WHEN an operator opens the Work_Queue page, THE Work_Queue SHALL display all jobs with parts currently assigned to the operator
2. THE Work_Queue SHALL group displayed jobs by job name, showing part counts per job
3. THE Work_Queue SHALL display the current process step name and location for each job's parts
4. THE Work_Queue SHALL show the total count of parts awaiting action across all jobs
5. IF no jobs are assigned to the operator, THEN THE Work_Queue SHALL display an empty state message indicating no current assignments

### Requirement 2: Search and Filter Capability

**User Story:** As an operator, I want to search and filter my work queue, so that I can focus on specific jobs or process steps when needed.

#### Acceptance Criteria

1. THE Work_Queue SHALL provide a search input field for filtering displayed jobs
2. WHEN the operator enters text in the search field, THE Work_Queue SHALL filter jobs by job name, path name, or process step name (case-insensitive partial match)
3. WHEN the search field is empty, THE Work_Queue SHALL display all assigned jobs without filtering
4. THE Work_Queue SHALL update the filtered results immediately as the operator types (debounced by 300ms)
5. THE Work_Queue SHALL display the count of filtered results versus total results when a filter is active

### Requirement 3: Process Advancement Workflow

**User Story:** As an operator, I want a dedicated interface to advance parts through processes, so that I can efficiently move parts to the next step.

#### Acceptance Criteria

1. WHEN the operator selects a job from the Work_Queue, THE Work_Queue SHALL display a process advancement panel for that job
2. THE Process_Advancement_Panel SHALL display all serial numbers currently at the active process step
3. THE Process_Advancement_Panel SHALL allow the operator to select one or more serial numbers for advancement
4. WHEN the operator confirms advancement, THE Work_Queue SHALL advance all selected serial numbers to the next process step
5. IF a serial number is at the final process step, THEN THE Work_Queue SHALL mark it as completed (currentStepIndex = -1)
6. THE Process_Advancement_Panel SHALL display the next step name and location after advancement

### Requirement 4: Completion Quantity Tracking

**User Story:** As an operator, I want to specify how many parts I have completed, so that I can record my progress accurately.

#### Acceptance Criteria

1. THE Process_Advancement_Panel SHALL display a quantity input for batch completion
2. WHEN the operator enters a quantity, THE Work_Queue SHALL validate that the quantity does not exceed available parts at the current step
3. IF the entered quantity exceeds available parts, THEN THE Work_Queue SHALL display a validation error and prevent submission
4. WHEN the operator submits a valid quantity, THE Work_Queue SHALL advance that number of serial numbers (selected in order of creation)
5. THE Work_Queue SHALL display a success confirmation showing the number of parts advanced and their destination step

### Requirement 5: Optional Notes on Completion

**User Story:** As an operator, I want to optionally add notes when completing a step, so that I can document observations or issues during processing.

#### Acceptance Criteria

1. THE Process_Advancement_Panel SHALL provide an optional text area for completion notes
2. WHEN the operator enters a note and completes parts, THE Work_Queue SHALL create a StepNote record associated with the advanced serial numbers
3. IF the note field is empty, THEN THE Work_Queue SHALL complete the advancement without creating a note
4. THE Completion_Note text area SHALL have a maximum length of 1000 characters
5. THE Work_Queue SHALL display previously created notes for the current process step in the advancement panel

### Requirement 6: Operator Assignment Context

**User Story:** As an operator, I want the system to know who I am, so that my work queue shows only my assignments.

#### Acceptance Criteria

1. THE Work_Queue page SHALL require operator identification before displaying the queue
2. THE Work_Queue SHALL provide a dropdown to select the current operator from active ShopUsers
3. WHEN an operator is selected, THE Work_Queue SHALL persist the selection in browser local storage
4. WHEN the operator returns to the Work_Queue page, THE Work_Queue SHALL restore the previously selected operator
5. THE Work_Queue SHALL provide a way to switch operators without leaving the page
