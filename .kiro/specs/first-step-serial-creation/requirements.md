# Requirements Document

## Introduction

This feature redesigns the UX for the first step in a process routing so that operators can create (spawn) serial numbers directly from within the first step's UI, rather than navigating to a separate part of the application. In reality, the first step represents cutting raw material from stock into parts — there is no "input" to receive, only new parts to create. The UI should treat the first step as a "creation point" where operators generate batches of serial numbers throughout the day, accumulate them, and then advance some or all to the next step when ready.

## Glossary

- **First_Step**: The process step at index 0 in a Path's ordered step list. This is where serial numbers originate.
- **Serial_Creation_Panel**: A new UI component displayed when viewing the first step of a process, allowing operators to spawn serial numbers in batches.
- **Batch**: A group of serial numbers created together in a single operation. An operator may create multiple batches throughout a work session.
- **Accumulated_Serials**: The collection of all serial numbers currently sitting at the first step (currentStepIndex = 0), regardless of which batch created them.
- **Operator**: A shop user performing work at a process step, identified via the operator identity system.
- **Spawn**: The act of creating new serial numbers at the first step, representing parts cut from raw material.
- **Work_Queue**: The operator page view that groups serials by step, job, and path for batch processing.
- **Process_Advancement_Panel**: The existing component that handles selecting serials and advancing them to the next step.
- **Creation_Point_View**: The combined UI for the first step that integrates serial creation and optional immediate advancement.

## Requirements

### Requirement 1: First Step Detection

**User Story:** As an operator, I want the system to recognize when I am viewing the first step of a process, so that I see the serial creation UI instead of the standard advancement-only UI.

#### Acceptance Criteria

1. WHEN an operator views a step in the Work_Queue, THE Creation_Point_View SHALL determine whether the step is the First_Step by checking that the step order equals 0.
2. WHEN the step is the First_Step, THE Creation_Point_View SHALL display the Serial_Creation_Panel in place of the standard receive-only view.
3. WHEN the step is not the First_Step, THE Work_Queue SHALL display the existing Process_Advancement_Panel without modification.

### Requirement 2: Batch Serial Creation at First Step

**User Story:** As an operator, I want to create a batch of serial numbers directly from the first step view, so that I can spawn parts as I cut them from raw material without leaving the operator page.

#### Acceptance Criteria

1. THE Serial_Creation_Panel SHALL display a numeric quantity input for specifying how many serial numbers to create in a Batch.
2. THE Serial_Creation_Panel SHALL display the job name, path name, and step name for context.
3. WHEN the operator submits a Batch creation request, THE Serial_Creation_Panel SHALL call the existing batch serial creation API (POST /api/serials) with the jobId, pathId, quantity, and userId.
4. WHEN the batch creation API returns successfully, THE Serial_Creation_Panel SHALL display a success confirmation showing the count of created serial numbers.
5. WHEN the batch creation API returns an error, THE Serial_Creation_Panel SHALL display the error message to the operator.
6. THE Serial_Creation_Panel SHALL default the quantity input to 1.
7. IF the operator submits a quantity less than 1, THEN THE Serial_Creation_Panel SHALL display a validation error and prevent submission.

### Requirement 3: Accumulated Serials Display

**User Story:** As an operator, I want to see all serial numbers currently sitting at the first step, so that I know how many parts have been created across all batches throughout the day.

#### Acceptance Criteria

1. THE Serial_Creation_Panel SHALL display a list of all Accumulated_Serials at the First_Step, grouped by the path and job context.
2. WHEN a new Batch is created, THE Serial_Creation_Panel SHALL refresh the Accumulated_Serials list to include the newly created serial numbers.
3. THE Serial_Creation_Panel SHALL display the total count of Accumulated_Serials.
4. THE Serial_Creation_Panel SHALL display each serial number's identifier (SN-XXXXX format) in the accumulated list.
5. WHEN no Accumulated_Serials exist at the First_Step, THE Serial_Creation_Panel SHALL display an empty state message indicating no parts have been created yet.

### Requirement 4: Select and Advance from First Step

**User Story:** As an operator, I want to select some or all accumulated serials at the first step and advance them to the next step in one batch, so that I can move completed parts to QC or the next operation when ready.

#### Acceptance Criteria

1. THE Serial_Creation_Panel SHALL provide checkboxes for selecting individual serial numbers from the Accumulated_Serials list.
2. THE Serial_Creation_Panel SHALL provide a "Select All" control to select all Accumulated_Serials at once.
3. THE Serial_Creation_Panel SHALL provide a "Select None" control to deselect all serial numbers.
4. THE Serial_Creation_Panel SHALL display the count of selected serial numbers relative to the total Accumulated_Serials count.
5. WHEN the operator clicks the advance action with one or more serial numbers selected, THE Serial_Creation_Panel SHALL advance all selected serial numbers to the next step using the existing advancement API.
6. WHEN advancement completes successfully, THE Serial_Creation_Panel SHALL display a success message indicating how many parts were advanced and the destination step name.
7. WHEN advancement completes successfully, THE Serial_Creation_Panel SHALL refresh the Accumulated_Serials list to reflect the remaining serials at the First_Step.
8. IF no serial numbers are selected, THEN THE Serial_Creation_Panel SHALL disable the advance action.

### Requirement 5: Create-Then-Advance-Later Workflow

**User Story:** As an operator, I want to create multiple batches of serials throughout the day and advance them all at once later, so that I can batch my QC handoffs efficiently.

#### Acceptance Criteria

1. THE Serial_Creation_Panel SHALL allow the operator to create a Batch without requiring immediate advancement.
2. WHEN a Batch is created, THE Serial_Creation_Panel SHALL keep the creation form available for creating additional batches.
3. THE Serial_Creation_Panel SHALL persist Accumulated_Serials across multiple Batch creation operations within the same view session.
4. WHEN the operator returns to the First_Step view after navigating away, THE Serial_Creation_Panel SHALL load all Accumulated_Serials from the server, reflecting any batches created in prior sessions.

### Requirement 6: Create-and-Immediately-Advance Workflow

**User Story:** As an operator, I want to create a batch of serials and immediately advance them to the next step, so that I can handle quick turnaround parts without extra clicks.

#### Acceptance Criteria

1. THE Serial_Creation_Panel SHALL provide a combined "Create & Advance" action that creates a Batch and immediately advances the newly created serial numbers to the next step.
2. WHEN the "Create & Advance" action is used, THE Serial_Creation_Panel SHALL first create the serial numbers via the batch creation API, then advance each created serial number to the next step.
3. WHEN the "Create & Advance" action completes successfully, THE Serial_Creation_Panel SHALL display a success message indicating the count of created and advanced serial numbers and the destination step name.
4. IF the batch creation succeeds but advancement fails for any serial number, THEN THE Serial_Creation_Panel SHALL display an error message identifying which serial numbers failed to advance, and the successfully created serial numbers SHALL remain in the Accumulated_Serials list.

### Requirement 7: Advancement Destination Display

**User Story:** As an operator, I want to see where parts will go when I advance them from the first step, so that I have confidence about the next operation.

#### Acceptance Criteria

1. THE Serial_Creation_Panel SHALL display the name of the next step (destination) that serial numbers will advance to.
2. WHEN the next step has a location defined, THE Serial_Creation_Panel SHALL display the location alongside the step name.
3. WHEN the First_Step is also the final step in the path, THE Serial_Creation_Panel SHALL indicate that advancement will mark serial numbers as "Completed".

### Requirement 8: Optional Note on Advancement

**User Story:** As an operator, I want to attach a note when advancing serials from the first step, so that I can record observations about the batch (e.g., material lot, cutting conditions).

#### Acceptance Criteria

1. THE Serial_Creation_Panel SHALL provide an optional text input for adding a note when advancing serial numbers.
2. WHEN a note is provided during advancement, THE Serial_Creation_Panel SHALL submit the note to the notes API associated with the serial numbers, job, path, and step.
3. THE Serial_Creation_Panel SHALL limit the note text to 1000 characters.
4. THE Serial_Creation_Panel SHALL display the current character count relative to the 1000-character limit.

### Requirement 9: Serial Detail Page First Step Integration

**User Story:** As a user viewing a serial's detail page, I want the routing tab to reflect the first-step creation context, so that the "Advance Process" section works correctly for serials at the first step.

#### Acceptance Criteria

1. WHEN a serial number is at the First_Step (currentStepIndex = 0) and the serial detail page is viewed, THE serial detail page SHALL display the Process_Advancement_Panel for advancing the serial to the next step.
2. THE serial detail page SHALL continue to use the existing Process_Advancement_Panel for single-serial advancement at the First_Step without requiring the full Serial_Creation_Panel.

### Requirement 10: Loading and Error States

**User Story:** As an operator, I want clear feedback during serial creation and advancement operations, so that I know when operations are in progress or have failed.

#### Acceptance Criteria

1. WHILE a Batch creation request is in progress, THE Serial_Creation_Panel SHALL display a loading indicator on the creation action and disable the submit controls.
2. WHILE an advancement request is in progress, THE Serial_Creation_Panel SHALL display a loading indicator on the advance action and disable the advance controls.
3. WHILE the Accumulated_Serials list is loading, THE Serial_Creation_Panel SHALL display a loading indicator in the serial list area.
4. IF the Accumulated_Serials list fails to load, THEN THE Serial_Creation_Panel SHALL display an error message with a retry option.
