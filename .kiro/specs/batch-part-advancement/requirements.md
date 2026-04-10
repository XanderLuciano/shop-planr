# Requirements Document

## Introduction

This document defines the requirements for the Batch Part Advancement feature in Shop Planr. The feature replaces the current N-sequential-HTTP-call advancement pattern with a single batch endpoint, fixes race conditions in the create-and-advance flow, adds double-click prevention across all async actions, corrects skip-step origin status tracking, and introduces an admin-only "Advanced options" UI for skip-to-step operations. These changes improve reliability under rate limiting, prevent duplicate operations, and ensure routing history accurately reflects whether a step was completed, skipped, or deferred.

## Glossary

- **Batch_Endpoint**: The `POST /api/parts/advance` API route that accepts an array of part IDs and advances them in a single HTTP request
- **Part_Service**: The server-side service (`partService`) responsible for part lifecycle operations including advancement
- **Lifecycle_Service**: The server-side service (`lifecycleService`) responsible for step status tracking, scrap, force-complete, advance-to-step, and waiver operations
- **Advance_Batch_Composable**: The client-side composable (`useAdvanceBatch`) that wraps the batch endpoint call
- **Guarded_Action_Composable**: The client-side composable (`useGuardedAction`) that prevents double-execution of async functions
- **Part_Creation_Panel**: The Vue component (`PartCreationPanel.vue`) used on the first step to create and optionally advance parts
- **Process_Advancement_Panel**: The Vue component (`ProcessAdvancementPanel.vue`) used on non-first steps to select and advance parts
- **Step_View**: The page (`parts/step/[stepId].vue`) displaying a single process step with its parts and advancement controls
- **Part_Detail_Page**: The page (`parts-browser/[id].vue`) displaying a single part's routing, certificates, and advancement controls
- **Job_Parts_Tab**: The component (`JobPartsTab.vue`) displaying all parts for a job with quick-advance actions
- **Work_Queue_Job**: The TypeScript type representing a grouped set of parts at a process step, used by advancement UI components
- **Batch_Advance_Schema**: The Zod validation schema for the batch advance request body
- **Origin_Step**: The process step a part is currently at before advancement or skip
- **Bypass_Preview**: A UI element showing which intermediate steps will be skipped or deferred when using skip-to-step

## Requirements

### Requirement 1: Batch Advance Endpoint

**User Story:** As a shop operator, I want to advance multiple parts in a single request, so that I do not hit rate limits when advancing batches of parts through a process step.

#### Acceptance Criteria

1. WHEN a valid batch advance request is received with an array of part IDs, THE Batch_Endpoint SHALL delegate to Part_Service.advancePart for each part ID and return a structured response containing per-part success or failure
2. THE Batch_Advance_Schema SHALL enforce that the partIds array is non-empty and contains no more than 100 non-empty string elements
3. WHEN an empty partIds array is submitted, THE Batch_Endpoint SHALL reject the request with a 400 validation error
4. WHEN more than 100 part IDs are submitted, THE Batch_Endpoint SHALL reject the request with a 400 validation error
5. THE Batch_Endpoint SHALL extract the userId from the JWT token via getAuthUserId, not from the request body

### Requirement 2: Batch Advance Service Method

**User Story:** As a developer, I want the batch advance logic to delegate entirely to the existing advancePart method, so that all advancement business rules remain in a single source of truth.

#### Acceptance Criteria

1. THE Part_Service.batchAdvanceParts method SHALL produce exactly one result entry per input part ID, such that results.length equals partIds.length
2. THE Part_Service.batchAdvanceParts method SHALL return a response where advanced plus failed equals partIds.length
3. WHEN advancePart succeeds for a part, THE Part_Service SHALL record that part as successful in the results array
4. WHEN advancePart throws an error for a part, THE Part_Service SHALL catch the error, record the part as failed with the error message, and continue processing remaining parts
5. WHEN one part fails during batch advancement, THE Part_Service SHALL continue advancing subsequent parts without rollback

### Requirement 3: Single HTTP Call Client Composable

**User Story:** As a shop operator, I want the UI to make one HTTP call for batch advancement instead of one per part, so that I stay within rate limits even for large batches.

#### Acceptance Criteria

1. WHEN advanceBatch is called, THE Advance_Batch_Composable SHALL make exactly one POST request to /api/parts/advance regardless of the number of part IDs
2. WHEN the partIds count exceeds availablePartCount, THE Advance_Batch_Composable SHALL reject the call with a client-side error before making any HTTP request
3. WHEN a non-empty note is provided, THE Advance_Batch_Composable SHALL create the note via a separate POST to /api/notes after the advancement call succeeds
4. WHEN a note exceeding 1000 characters is provided, THE Advance_Batch_Composable SHALL reject with a validation error

### Requirement 4: Part Creation Panel Race Condition Fix

**User Story:** As a shop operator, I want the create-and-advance flow to execute sequentially without race conditions, so that parts are reliably created and then advanced.

#### Acceptance Criteria

1. WHEN handleCreateAndAdvance is invoked, THE Part_Creation_Panel SHALL set the creating flag to true synchronously before any async operation begins
2. WHEN the creating flag is true, THE Part_Creation_Panel SHALL prevent additional create or create-and-advance actions from executing
3. WHEN handleCreateAndAdvance completes (success or failure), THE Part_Creation_Panel SHALL reset the creating flag to false in a finally block
4. WHEN handleCreateAndAdvance executes, THE Part_Creation_Panel SHALL emit the created event before emitting the advance event, ensuring sequential execution

### Requirement 5: Part Detail Page Batch Advancement

**User Story:** As a shop operator, I want the part detail page to use the batch endpoint for advancement, so that all advancement flows go through a consistent code path.

#### Acceptance Criteria

1. WHEN handleAdvance is called on the Part_Detail_Page, THE Part_Detail_Page SHALL make a single POST to /api/parts/advance with the selected part IDs instead of looping over individual advancePart calls
2. THE Part_Detail_Page SHALL remove the dependency on useParts().advancePart and use useAuthFetch directly for the batch endpoint call

### Requirement 6: Job Parts Tab Batch Advancement

**User Story:** As a shop operator, I want the quick-advance action in the job parts tab to use the batch endpoint, so that all advancement goes through the same code path.

#### Acceptance Criteria

1. WHEN handleQuickAdvance is called on the Job_Parts_Tab, THE Job_Parts_Tab SHALL make a single POST to /api/parts/advance with the part ID in an array instead of calling useParts().advancePart
2. THE Job_Parts_Tab SHALL remove the dependency on useParts().advancePart

### Requirement 7: Cleanup useParts.advancePart

**User Story:** As a developer, I want the unused advancePart function removed from the useParts composable, so that there is no dead code and all callers use the batch endpoint.

#### Acceptance Criteria

1. THE useParts composable SHALL remove the advancePart function and its export after all callers have been migrated to the batch endpoint

### Requirement 8: Double-Click Prevention Composable

**User Story:** As a shop operator, I want all async action buttons to be protected against double-clicks, so that I cannot accidentally trigger duplicate operations.

#### Acceptance Criteria

1. WHEN execute is called on the Guarded_Action_Composable, THE Guarded_Action_Composable SHALL set loading to true synchronously before invoking the wrapped async function
2. WHEN execute is called while loading is already true, THE Guarded_Action_Composable SHALL return undefined immediately without invoking the wrapped function
3. WHEN the wrapped function completes (success or failure), THE Guarded_Action_Composable SHALL reset loading to false in a finally block
4. WHEN the wrapped function throws an error, THE Guarded_Action_Composable SHALL re-throw the error after resetting loading to false

### Requirement 9: Skip-Step Origin Status Fix

**User Story:** As a production manager, I want skipped steps to be recorded as 'skipped' or 'deferred' in routing history instead of 'completed', so that the audit trail accurately reflects what happened.

#### Acceptance Criteria

1. WHEN advanceToStep is called with skip set to true and the origin step is optional or has an active override, THE Lifecycle_Service SHALL mark the origin step status as 'skipped'
2. WHEN advanceToStep is called with skip set to true and the origin step is required with no active override, THE Lifecycle_Service SHALL mark the origin step status as 'deferred'
3. WHEN advanceToStep is called with skip set to true, THE Lifecycle_Service SHALL not increment the origin step's completedCount
4. WHEN advanceToStep is called with skip omitted or set to false, THE Lifecycle_Service SHALL mark the origin step status as 'completed' and increment completedCount (existing behavior preserved)

### Requirement 10: AdvanceToStepInput Skip Flag

**User Story:** As a developer, I want the AdvanceToStepInput type to include an optional skip boolean, so that the service can distinguish between normal advancement and intentional skipping.

#### Acceptance Criteria

1. THE AdvanceToStepInput interface SHALL include an optional skip field of type boolean
2. WHEN skip is not provided in the input, THE Lifecycle_Service SHALL treat it as false and apply normal advancement behavior

### Requirement 11: Skip Utility Update

**User Story:** As a developer, I want the executeSkip utility to pass skip: true to advanceToStep, so that the service correctly classifies the origin step.

#### Acceptance Criteria

1. WHEN executeSkip calls advanceToStep for each part, THE executeSkip utility SHALL include skip: true in the input object

### Requirement 12: canComplete Unaffected by Skipped Optional Steps

**User Story:** As a production manager, I want part completion eligibility to be unaffected by skipped optional steps, so that parts can complete normally when only optional steps were skipped.

#### Acceptance Criteria

1. WHILE evaluating completion eligibility, THE Lifecycle_Service.canComplete method SHALL skip optional steps entirely regardless of their status value
2. WHILE evaluating completion eligibility, THE Lifecycle_Service.canComplete method SHALL treat required steps with 'deferred' status as blockers that prevent completion
3. WHILE evaluating completion eligibility, THE Lifecycle_Service.canComplete method SHALL treat required steps with 'waived' status as non-blockers that allow completion

### Requirement 13: Admin-Only Advanced Options UI

**User Story:** As an admin user, I want a collapsible "Advanced options" section in the advancement panel, so that I can skip to a specific step or defer required steps without cluttering the standard operator UI.

#### Acceptance Criteria

1. THE Process_Advancement_Panel SHALL display a collapsible "Advanced options" disclosure toggle below the main action buttons
2. THE Process_Advancement_Panel SHALL only show the "Advanced options" toggle to admin users as determined by useAuth().isAdmin
3. WHEN the "Advanced options" section is expanded, THE Process_Advancement_Panel SHALL display a skip-to-step dropdown populated with all future steps from the path
4. WHEN a target step is selected in the skip-to dropdown, THE Process_Advancement_Panel SHALL display a Bypass_Preview showing each intermediate step with its classification as 'Skip' or 'Defer'
5. WHEN the path advancement mode is 'strict', THE Process_Advancement_Panel SHALL only show the immediate next step in the skip-to dropdown
6. THE Process_Advancement_Panel SHALL collapse the "Advanced options" section by default and reset it to collapsed when the step changes

### Requirement 14: DeferredStepsList on Step View

**User Story:** As a shop operator, I want to see and manage deferred steps directly from the Step View, so that I can complete or waive deferred steps without navigating to the part detail page.

#### Acceptance Criteria

1. WHEN parts at the current step have deferred steps, THE Step_View SHALL display a DeferredStepsList section below the advancement panel
2. WHEN an operator completes a deferred step from the Step_View, THE Step_View SHALL refresh the step data to reflect the updated status

### Requirement 15: WorkQueueJob Type Extension

**User Story:** As a developer, I want the WorkQueueJob type to include path advancement mode and step list, so that the advancement panel can determine skip-to-step availability and populate the dropdown.

#### Acceptance Criteria

1. THE Work_Queue_Job type SHALL include an optional pathAdvancementMode field with values 'strict', 'flexible', or 'per_step'
2. THE Work_Queue_Job type SHALL include an optional pathSteps field containing an array of step objects with id, name, order, location, and optional flag
