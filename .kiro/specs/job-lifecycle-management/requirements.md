# Requirements Document

## Introduction

The Job Lifecycle Management feature set extends Shop Planr's serial number tracking from a strictly sequential advancement model to a flexible, real-world manufacturing lifecycle. This encompasses 11 interconnected capabilities: batch serial number creation at the first step, a unified single-job view, scrap tracking, optional process steps, flexible and out-of-order step advancement, overproduction/bonus parts, force-complete overrides, per-SN step requirement overrides (prototype fast-track), editable BOMs with version history, and a deferred/skipped step model that distinguishes between steps that won't happen and steps that will happen later. Together these features allow Shop Planr to handle the messy realities of shop floor production — scrapped parts, skipped inspections, prototype fast-tracks, out-of-order processing, and force-completed jobs — while maintaining full audit traceability.

## Glossary

- **Batch**: A group of Serial Numbers created together in a single operation at the first Process Step of a Path.
- **Scrap**: The act of permanently removing a Serial Number from active production. A scrapped part does not advance further and is excluded from completion counts.
- **Scrap_Reason**: A predefined category explaining why a part was scrapped (e.g., "Out of tolerance", "Process defect", "Damaged", "Operator error", "Other").
- **Process_Library**: The system-managed list of predefined process/operation names (e.g., "CNC Machine", "Inspection", "Chemfilm", "Stress Relief", "Pinning", "Coating", "SPDT") that can be selected when defining Process Steps. Managed in Settings.
- **Location_Library**: The system-managed list of predefined physical locations (e.g., "Machine Shop", "QC Lab", "Vendor - Anodize Co.") that can be selected when defining Process Steps. Managed in Settings.
- **Optional_Step**: A Process Step that is not required for a Serial Number to reach final completion. Optional steps may be skipped without blocking completion.
- **Required_Step**: A Process Step that must be completed (or explicitly waived/force-completed) before a Serial Number can reach final "Complete" status.
- **Flexible_Advancement**: The ability to advance a Serial Number to any future step in the Path, not just the next sequential step.
- **Skip**: A deliberate decision that a step will not be performed for a given Serial Number. Skipped steps are marked gray and do not block completion if the step is optional.
- **Defer**: A decision to postpone a required step — the part advances past it now but must return to complete the deferred step before final completion.
- **Deferred_Step**: A required Process Step that a Serial Number has advanced past without completing. The step remains pending and must be resolved before final completion.
- **Force_Complete**: An override action that marks a Serial Number as completed even when required steps remain incomplete or deferred.
- **Waiver**: An explicit authorization to permanently bypass a required step, with a recorded reason and approver. A stretch-goal extension of force-complete.
- **Step_Override**: A per-Serial-Number configuration that marks a specific required step as "not required" for that SN, enabling prototype fast-track workflows.
- **Bonus_Parts**: Serial Numbers created beyond the Job's original Goal Quantity, representing overproduction.
- **Ordered_Quantity**: The original Goal Quantity specified when the Job was created.
- **Produced_Quantity**: The actual total number of Serial Numbers created for a Job, which may exceed the Ordered Quantity.
- **Step_Dependency_Type**: The classification of a step relationship — physical (hard block), preferred (flexible sequence), or completion_gate (required for sign-off).
- **Physical_Dependency**: A hard constraint where one step physically cannot occur before another (e.g., coating before machining is impossible).
- **Preferred_Sequence**: A soft ordering preference that can be overridden with a warning (e.g., prefer inspection before coating).
- **Completion_Gate**: A step that must be done (or waived) before final sign-off, regardless of when it occurs in the sequence.
- **Advancement_Mode**: The enforcement level for step ordering — strict (block out-of-order), flexible (allow with warning), or per_step (configured individually).
- **BOM_Version**: A snapshot of a BOM's entries at a point in time, recorded when edits are made.
- **SN_Step_Status**: The status of a Serial Number at a specific Process Step — one of: pending, in_progress, completed, skipped, deferred.
- **SHOP_ERP**: The Shop Planr application system.
- **Job**: A production order with a Goal Quantity and one or more Paths.
- **Path**: A route instance — an ordered sequence of Process Steps within a Job.
- **Process_Step**: An individual operation within a Path.
- **Serial_Number (SN)**: A unique identifier assigned to a physical part, tracking its position in a Path.
- **Certificate (Cert)**: A quality document attached to Serial Numbers.
- **Audit_Trail**: The append-only log of all tracked actions.
- **ShopUser**: A kiosk-mode user profile.

## Requirements

### Requirement 1: Batch Serial Number Creation at First Step

**User Story:** As a shop floor operator, I want to create a batch of serial numbers at the first process step by entering a quantity and optionally linking a material certificate, so that I can start production on a job quickly.

#### Acceptance Criteria

1. WHEN an operator enters a quantity on the first Process Step of a Path, THE SHOP_ERP SHALL create that many Serial Numbers in a single batch, each assigned to the specified Job and Path at step index 0.
2. THE SHOP_ERP SHALL present a material Certificate selection (dropdown with search) during batch creation, allowing the operator to optionally link one Certificate to all Serial Numbers in the batch.
3. WHEN a Certificate is selected during batch creation, THE SHOP_ERP SHALL attach that Certificate to every Serial Number in the batch at the first Process Step.
4. WHEN a batch is created on a Path that has zero existing Serial Numbers, THE SHOP_ERP SHALL treat the Job as "in progress" for display purposes.
5. THE SHOP_ERP SHALL display the batch creation interface on the Process Advancement screen when the current step is the first Process Step of the Path.
6. IF the operator enters a quantity of zero or less, THEN THE SHOP_ERP SHALL reject the batch creation and display a validation error.
7. IF the selected Certificate does not exist in the Cert Database, THEN THE SHOP_ERP SHALL reject the batch creation and display an error identifying the invalid Certificate.
8. WHEN a batch is created, THE SHOP_ERP SHALL record an Audit Trail entry containing: user identity, timestamp, quantity created, Job, Path, and linked Certificate (if any).

### Requirement 2: Single Job View with Tabbed Layout

**User Story:** As a shop manager, I want a single job detail screen with tabs for routing overview and serial numbers, so that I can see the full manufacturing context and act on it from one place.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL enhance the existing job detail page at `/jobs/[id]` — the current routing interface (paths, step tracker, serial batch creation, step assignments, notes) becomes the "Job Routing" tab, and a new "Serial Numbers" tab SHALL be added alongside it.
2. THE SHOP_ERP SHALL make each Job row in the Jobs list page (`/jobs`) clickable, navigating to the job detail page (`/jobs/[id]`) for that Job.
3. THE SHOP_ERP SHALL make the "Active Jobs" section on the Dashboard page link to the Jobs list page, and each individual Job progress entry on the Dashboard SHALL link to that Job's detail page (`/jobs/[id]`).
4. THE Job Routing tab SHALL display all Paths belonging to the Job, each showing its ordered sequence of Process Steps with visual status indicators (complete, in-progress, pending).
5. THE Job Routing tab SHALL display the count of Serial Numbers at each Process Step and the count of completed Serial Numbers for each Path.
6. WHEN a user clicks a Process Step on the Job Routing tab, THE SHOP_ERP SHALL navigate to the Process Advancement screen for that step's Job, Path, and step context.
7. THE Job Routing tab SHALL display the Job's Goal Quantity as an inline-editable field, so that a planner can increase or decrease the target mid-run. Updating the Goal Quantity SHALL immediately recalculate the Job's progress percentage.
8. THE Serial Numbers tab SHALL display all Serial Numbers for the Job across all Paths, showing: SN identifier, Path name, current step name, and status (in-progress, completed, scrapped).
9. THE Serial Numbers tab SHALL provide filter controls for status (in-progress, completed, scrapped, all), Path, and current step name.
10. THE Serial Numbers tab SHALL provide sort controls for SN identifier, status, current step, and created date.
11. WHEN a user clicks a Serial Number row on the Serial Numbers tab, THE SHOP_ERP SHALL navigate to the Part Detail page for that Serial Number.
12. THE Serial Numbers tab SHALL display quick-action buttons for each SN: advance (if in-progress), scrap (if in-progress), and view detail.

### Requirement 3: Scrap Tracking

**User Story:** As a shop floor operator, I want to scrap a serial number at any process step with a reason, so that defective parts are removed from production and the scrap is documented.

#### Acceptance Criteria

1. WHEN an operator scraps a Serial Number, THE SHOP_ERP SHALL mark the Serial Number with a status of "scrapped" and record the Process Step at which the scrap occurred.
2. THE SHOP_ERP SHALL require a Scrap Reason when scrapping a Serial Number, selectable from a predefined dropdown list: "Out of tolerance", "Process defect", "Damaged", "Operator error", "Other".
3. WHEN the operator selects "Other" as the Scrap Reason, THE SHOP_ERP SHALL require a free-text explanation.
4. THE SHOP_ERP SHALL record an Audit Trail entry for each scrap action containing: user identity, timestamp, Serial Number, Process Step, Scrap Reason, and explanation text (if "Other").
5. WHEN a Serial Number is scrapped, THE SHOP_ERP SHALL exclude the scrapped Serial Number from in-progress and completed counts for the Job and Path.
6. THE SHOP_ERP SHALL prevent advancement of a scrapped Serial Number — a scrapped SN cannot be advanced or completed.
7. THE SHOP_ERP SHALL display scrapped Serial Numbers in the Serial Numbers tab with a distinct visual indicator (e.g., red strikethrough or "Scrapped" badge).
8. WHEN computing Job progress percentage, THE SHOP_ERP SHALL exclude scrapped Serial Numbers from both the numerator and denominator: `progressPercent = (completedCount / (goalQuantity - scrappedCount)) * 100`.
9. THE SHOP_ERP SHALL allow scrapping at any Process Step, including the first step and the last step.
10. IF a user attempts to scrap an already-scrapped Serial Number, THEN THE SHOP_ERP SHALL reject the operation and display an error.
11. IF a user attempts to scrap a completed Serial Number, THEN THE SHOP_ERP SHALL reject the operation and display an error.

### Requirement 4: Optional Process Steps

**User Story:** As a shop planner, I want to mark process steps as optional at the template level or at runtime for specific serial numbers, so that non-critical steps can be skipped without blocking completion.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL support an `optional` boolean flag on each TemplateStep and ProcessStep, defaulting to `false` (required).
2. WHEN a user creates or edits a Template Route, THE SHOP_ERP SHALL allow setting each step as optional or required.
3. WHEN a Template Route is applied to create a Path, THE SHOP_ERP SHALL copy the optional flag from each TemplateStep to the corresponding ProcessStep.
4. THE SHOP_ERP SHALL allow changing a ProcessStep's optional flag at runtime on a per-Path basis (e.g., making a step optional for a specific Job's Path).
5. THE SHOP_ERP SHALL visually distinguish optional steps from required steps in all views (Job Routing tab, Operator View, Part Detail) using a distinct badge or icon (e.g., dashed border or "Optional" label).
6. WHEN a Serial Number skips an optional step, THE SHOP_ERP SHALL not block the Serial Number from reaching final completion.
7. WHEN a Serial Number skips a required step, THE SHOP_ERP SHALL mark that step as Deferred and block final completion until the deferred step is resolved.

### Requirement 5: Flexible Step Advancement

**User Story:** As a shop floor operator, I want to advance a serial number to any future step (not just the next one), so that I can handle real-world routing flexibility like skipping optional steps or jumping ahead when needed.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL provide an "Advance to Step" dropdown on the Process Advancement screen that defaults to the next sequential step but allows selecting any future step in the Path.
2. WHEN an operator selects a non-sequential future step, THE SHOP_ERP SHALL advance the Serial Number to the selected step, bypassing all intermediate steps.
3. WHEN intermediate steps are bypassed during flexible advancement, THE SHOP_ERP SHALL classify each bypassed step as either "Skipped" (if optional) or "Deferred" (if required).
4. THE SHOP_ERP SHALL provide a "Skip" button for optional steps that performs a one-click skip, marking the step as "Skipped" for the selected Serial Numbers and advancing to the next step.
5. WHEN a required step is bypassed, THE SHOP_ERP SHALL display a warning: "Step [step_name] is required and will be marked as Deferred. This step must be completed before final sign-off."
6. THE SHOP_ERP SHALL record an Audit Trail entry for each flexible advancement containing: user identity, timestamp, Serial Number, origin step, destination step, and a list of all bypassed steps with their classification (skipped or deferred).
7. THE SHOP_ERP SHALL prevent advancing a Serial Number to a step it has already completed.
8. THE SHOP_ERP SHALL prevent advancing a Serial Number backwards to a previous step (advancement is forward-only; deferred steps are resolved separately).

### Requirement 6: Out-of-Order Step Processing

**User Story:** As a shop planner, I want to configure how strictly step ordering is enforced — strict, flexible, or per-step — so that different jobs can have different levels of routing discipline.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL support three Advancement Modes configurable at the Path level: "strict" (block out-of-order advancement), "flexible" (allow with warning), and "per_step" (configured individually per step).
2. WHILE a Path is in "strict" Advancement Mode, THE SHOP_ERP SHALL enforce sequential advancement only — a Serial Number at step N can only advance to step N+1 or be completed at the final step.
3. WHILE a Path is in "flexible" Advancement Mode, THE SHOP_ERP SHALL allow advancement to any future step but display a confirmation warning listing all steps that will be bypassed.
4. WHILE a Path is in "per_step" Advancement Mode, THE SHOP_ERP SHALL evaluate each step's Step Dependency Type to determine whether out-of-order advancement past that step is allowed.
5. WHEN a step has a Physical Dependency type, THE SHOP_ERP SHALL block advancement past that step regardless of Advancement Mode (hard block).
6. WHEN a step has a Preferred Sequence type, THE SHOP_ERP SHALL allow advancement past that step with a warning in flexible and per_step modes.
7. WHEN a step has a Completion Gate type, THE SHOP_ERP SHALL allow advancement past that step (marking it as Deferred) but require the step to be completed or waived before final completion.
8. THE SHOP_ERP SHALL record an Audit Trail entry for any out-of-order advancement, including: user identity, timestamp, Serial Number, the steps advanced past, and the Advancement Mode in effect.
9. THE SHOP_ERP SHALL default new Paths to "strict" Advancement Mode for backwards compatibility with existing data.
10. WHEN a Path's Advancement Mode is changed, THE SHOP_ERP SHALL apply the new mode to all future advancements on that Path without affecting already-completed steps.

### Requirement 7: Bonus Parts and Overproduction

**User Story:** As a shop floor operator, I want to create additional serial numbers beyond the job's goal quantity, so that overproduction and bonus parts are tracked alongside the original order.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL allow creating Serial Number batches that cause the total SN count for a Job to exceed the Job's Goal Quantity.
2. WHEN the total Serial Number count exceeds the Goal Quantity, THE SHOP_ERP SHALL display the Job progress as exceeding 100% (e.g., "52/50 complete — 104%").
3. THE SHOP_ERP SHALL distinguish between Ordered Quantity (the original Goal Quantity) and Produced Quantity (the actual total SN count) in the Job detail view.
4. THE SHOP_ERP SHALL display a "Bonus" or "Over" indicator on Serial Numbers created beyond the Goal Quantity, based on creation order.
5. THE SHOP_ERP SHALL include bonus parts in all standard tracking, advancement, and completion workflows — bonus parts follow the same Path and Process Steps as original parts.
6. WHEN computing BOM roll-up summaries, THE SHOP_ERP SHALL include bonus/overproduction parts in the completed and in-progress counts.
7. THE SHOP_ERP SHALL not require any special permission or confirmation to create bonus parts — overproduction is a normal shop floor occurrence.

### Requirement 8: Force Complete Override

**User Story:** As a shop supervisor, I want to force-complete a serial number even when required steps are incomplete, so that production can move forward when business needs override standard process.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL provide a "Force Complete" action on any in-progress Serial Number that has one or more incomplete required steps.
2. WHEN a user initiates Force Complete, THE SHOP_ERP SHALL display a confirmation dialog listing all incomplete and deferred required steps with the message: "[N] required steps are incomplete — force complete anyway?"
3. THE SHOP_ERP SHALL require the user to provide an optional reason text when force-completing a Serial Number.
4. WHEN the user confirms Force Complete, THE SHOP_ERP SHALL mark the Serial Number as completed (currentStepIndex = -1) regardless of incomplete steps.
5. THE SHOP_ERP SHALL record an Audit Trail entry for each Force Complete action containing: user identity, timestamp, Serial Number, list of bypassed required steps, and the reason text (if provided).
6. THE SHOP_ERP SHALL flag force-completed Serial Numbers in all views with a distinct indicator: "Force completed by [user_name] on [date]".
7. THE SHOP_ERP SHALL include force-completed Serial Numbers in the Job's completed count for progress calculation.
8. THE SHOP_ERP SHALL add a new audit action type `serial_force_completed` to distinguish force completions from normal completions in the Audit Trail.
9. IF a Serial Number has no incomplete required steps, THEN THE SHOP_ERP SHALL complete the Serial Number normally without the force-complete flow.

### Requirement 9: Per-SN Step Requirement Overrides (Prototype Fast-Track)

**User Story:** As a shop planner, I want to mark specific serial numbers as "not requiring" certain steps, so that prototype or fast-track parts can skip steps that the rest of the batch must complete.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL allow a user to create Step Overrides on individual Serial Numbers, marking specific required Process Steps as "not required" for those SNs.
2. THE SHOP_ERP SHALL support batch selection for Step Overrides: "first N serial numbers" (by creation order) or manual multi-select from the SN list.
3. WHEN a Step Override is applied, THE SHOP_ERP SHALL treat the overridden step as optional for the affected Serial Numbers only — other Serial Numbers on the same Path retain the original requirement.
4. THE SHOP_ERP SHALL allow reversing a Step Override (re-enabling the requirement) if the step has not yet been skipped or completed for that Serial Number.
5. THE SHOP_ERP SHALL record an Audit Trail entry for each Step Override creation and reversal containing: user identity, timestamp, affected Serial Numbers, overridden step, and reason text.
6. THE SHOP_ERP SHALL add a new audit action type `step_override_created` and `step_override_reversed` for Step Override tracking.
7. THE SHOP_ERP SHALL display active Step Overrides on the Part Detail page for each affected Serial Number, showing which steps are overridden and by whom.
8. THE SHOP_ERP SHALL display a split summary on the Job Routing tab when Step Overrides exist: e.g., "10 fast-track / 40 standard" indicating how many SNs have overrides versus standard routing.
9. IF a user attempts to override a step that the Serial Number has already completed, THEN THE SHOP_ERP SHALL reject the operation and display an error.
10. IF a user attempts to reverse an override for a step that has already been skipped, THEN THE SHOP_ERP SHALL reject the reversal and display an error.

### Requirement 10: Editable BOMs with Version History

**User Story:** As a production manager, I want to edit a BOM after creation and see a history of changes, so that I can adjust material requirements as designs evolve without losing traceability.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL allow editing an existing BOM's entries: adding new part types, removing existing part types, and adjusting required quantities.
2. WHEN a BOM is edited, THE SHOP_ERP SHALL create a BOM Version snapshot containing: the previous entries, the user who made the change, the timestamp, and a change description.
3. THE SHOP_ERP SHALL store BOM Versions as immutable records — versions cannot be modified or deleted after creation.
4. THE SHOP_ERP SHALL display a version history on the BOM detail view, showing all changes in reverse chronological order with: version number, date, user, and a summary of what changed (added/removed/modified entries).
5. WHEN a BOM is edited, THE SHOP_ERP SHALL recalculate all roll-up summary views that reference the modified BOM to reflect the new entry quantities.
6. THE SHOP_ERP SHALL record an Audit Trail entry for each BOM edit containing: user identity, timestamp, BOM identifier, and a summary of changes.
7. THE SHOP_ERP SHALL add a new audit action type `bom_edited` for BOM change tracking.
8. IF a user removes a part type from a BOM that has contributing Jobs with completed Serial Numbers, THEN THE SHOP_ERP SHALL display a warning but allow the removal (the historical version preserves the record).

### Requirement 11: Deferred vs Skipped Step Model

**User Story:** As a shop planner, I want the system to distinguish between steps that won't happen (skipped) and steps that will happen later (deferred), so that parts can go out of order while still ensuring all required work gets done before final sign-off.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL track per-Serial-Number step status for each Process Step in the Path using the following statuses: "pending" (not yet reached), "in_progress" (currently at this step), "completed" (step done), "skipped" (deliberately bypassed, optional step), "deferred" (will happen later, required step).
2. WHEN a Serial Number advances past an optional step without completing it, THE SHOP_ERP SHALL mark that step as "skipped" for the Serial Number.
3. WHEN a Serial Number advances past a required step without completing it, THE SHOP_ERP SHALL mark that step as "deferred" for the Serial Number.
4. THE SHOP_ERP SHALL visually distinguish step statuses in all views: deferred steps displayed with a yellow "Pending" indicator, skipped steps displayed with a gray indicator, completed steps with a green indicator, and in-progress steps with a blue indicator.
5. THE SHOP_ERP SHALL display a "Deferred Steps" section on the Part Detail page listing all deferred steps for the Serial Number, with the ability to complete each deferred step individually.
6. WHEN a user completes a deferred step, THE SHOP_ERP SHALL update the step status from "deferred" to "completed" and record an Audit Trail entry.
7. WHEN a Serial Number reaches the final step or a user attempts normal completion, THE SHOP_ERP SHALL validate that all required steps are either "completed" or "skipped" (if optional). If any required steps remain "deferred", THE SHOP_ERP SHALL block completion and display: "[N] required steps are still deferred: [step_names]. Complete these steps or use Force Complete."
8. THE SHOP_ERP SHALL add a new audit action type `step_deferred` and `step_skipped` for tracking step status changes.
9. THE SHOP_ERP SHALL add a new audit action type `deferred_step_completed` for tracking resolution of deferred steps.

### Requirement 12: Step Dependency Types

**User Story:** As a shop planner, I want to classify step relationships as physical dependencies, preferred sequences, or completion gates, so that the system enforces the right level of constraint for each step.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL support a `dependencyType` field on each ProcessStep and TemplateStep with values: "physical" (hard block), "preferred" (flexible sequence), or "completion_gate" (required for final sign-off). The default value SHALL be "preferred".
2. WHEN a step has a "physical" dependency type, THE SHOP_ERP SHALL block any Serial Number from advancing past that step without completing it, regardless of the Path's Advancement Mode.
3. WHEN a step has a "preferred" dependency type and the Path is in "flexible" or "per_step" mode, THE SHOP_ERP SHALL allow advancement past the step with a warning.
4. WHEN a step has a "completion_gate" dependency type, THE SHOP_ERP SHALL allow advancement past the step (marking it as deferred) but require the step to be completed or waived before the Serial Number can reach final "completed" status.
5. WHEN a user creates or edits a Template Route, THE SHOP_ERP SHALL allow setting the dependency type for each step.
6. WHEN a Template Route is applied to create a Path, THE SHOP_ERP SHALL copy the dependency type from each TemplateStep to the corresponding ProcessStep.
7. THE SHOP_ERP SHALL visually indicate the dependency type of each step in the Job Routing tab and Part Detail page (e.g., lock icon for physical, arrow icon for preferred, gate icon for completion gate).
8. IF a user attempts to advance a Serial Number past a step with a "physical" dependency that has not been completed, THEN THE SHOP_ERP SHALL reject the advancement and display: "Step [step_name] has a physical dependency and must be completed before advancing."

### Requirement 13: Waiver for Required Steps (Stretch Goal)

**User Story:** As a shop supervisor, I want to waive a required step with a documented reason and approval, so that production can proceed when a step is genuinely unnecessary for specific parts.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL provide a "Waive Step" action on deferred required steps for a Serial Number.
2. WHEN a user initiates a waiver, THE SHOP_ERP SHALL require: a reason text explaining why the step is being waived, and the identity of the approving user.
3. WHEN a waiver is confirmed, THE SHOP_ERP SHALL mark the deferred step as "waived" for the affected Serial Number, allowing the SN to proceed to final completion.
4. THE SHOP_ERP SHALL record an Audit Trail entry for each waiver containing: approving user identity, timestamp, Serial Number, waived step, and reason text.
5. THE SHOP_ERP SHALL add a new audit action type `step_waived` for waiver tracking.
6. THE SHOP_ERP SHALL display waived steps with a distinct visual indicator (e.g., orange "Waived" badge) in all views, distinguishing them from completed, skipped, and deferred steps.
7. THE SHOP_ERP SHALL treat waived steps as resolved for the purpose of final completion validation — a Serial Number with all required steps either completed or waived can be completed normally.

### Requirement 14: Backwards Compatibility and Data Migration

**User Story:** As a developer, I want existing serial numbers and process steps to work seamlessly with the new lifecycle features, so that no data is lost and existing workflows continue to function.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL provide a database migration that adds new columns and tables required by the lifecycle features without modifying existing data.
2. WHEN the migration runs, THE SHOP_ERP SHALL default all existing Serial Numbers to have no scrap status, no deferred steps, and no step overrides.
3. WHEN the migration runs, THE SHOP_ERP SHALL default all existing ProcessSteps to `optional = false`, `dependencyType = 'preferred'`, and all existing Paths to `advancementMode = 'strict'`.
4. THE SHOP_ERP SHALL ensure that existing Serial Numbers with `currentStepIndex = -1` (completed) continue to be treated as completed with all steps implicitly marked as "completed".
5. THE SHOP_ERP SHALL ensure that existing audit action types (`cert_attached`, `serial_created`, `serial_advanced`, `serial_completed`, `note_created`) continue to function alongside new action types.
6. THE SHOP_ERP SHALL extend the AuditAction union type to include: `serial_scrapped`, `serial_force_completed`, `step_override_created`, `step_override_reversed`, `step_deferred`, `step_skipped`, `deferred_step_completed`, `step_waived`, `bom_edited`.
7. IF the migration encounters an error, THEN THE SHOP_ERP SHALL roll back the migration transaction and report the error without corrupting existing data.

### Requirement 15: Extended Audit Trail

**User Story:** As a quality engineer, I want all new lifecycle actions (scrap, force complete, step overrides, deferrals, waivers) recorded in the audit trail, so that full traceability is maintained for audits.

#### Acceptance Criteria

1. WHEN a Serial Number is scrapped, THE SHOP_ERP SHALL record an Audit Trail entry with action `serial_scrapped` containing: user identity, timestamp, Serial Number, Process Step where scrapped, Scrap Reason, and explanation text.
2. WHEN a Serial Number is force-completed, THE SHOP_ERP SHALL record an Audit Trail entry with action `serial_force_completed` containing: user identity, timestamp, Serial Number, list of incomplete step IDs, and reason text.
3. WHEN a Step Override is created, THE SHOP_ERP SHALL record an Audit Trail entry with action `step_override_created` containing: user identity, timestamp, affected Serial Number IDs, overridden step ID, and reason text.
4. WHEN a Step Override is reversed, THE SHOP_ERP SHALL record an Audit Trail entry with action `step_override_reversed` containing: user identity, timestamp, affected Serial Number IDs, and step ID.
5. WHEN a step is deferred during flexible advancement, THE SHOP_ERP SHALL record an Audit Trail entry with action `step_deferred` containing: user identity, timestamp, Serial Number, deferred step ID.
6. WHEN a deferred step is completed, THE SHOP_ERP SHALL record an Audit Trail entry with action `deferred_step_completed` containing: user identity, timestamp, Serial Number, step ID.
7. WHEN a step is waived, THE SHOP_ERP SHALL record an Audit Trail entry with action `step_waived` containing: approving user identity, timestamp, Serial Number, step ID, and reason text.
8. THE SHOP_ERP SHALL display all new audit action types in the existing Audit Trail viewer with appropriate labels and formatting.
9. THE SHOP_ERP SHALL support filtering the Audit Trail by the new action types in addition to existing types.

### Requirement 16: Predefined Process and Location Libraries

**User Story:** As a shop planner, I want to select process step names and locations from predefined lists when building routes, so that naming is consistent across jobs and I can set up paths quickly without typing the same names repeatedly.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL maintain a Process Library — a list of predefined process/operation names (e.g., "CNC Machine", "Inspection", "Chemfilm", "Stress Relief", "Pinning", "Coating", "SPDT", "Nano Black") stored in the database and manageable via the Settings page.
2. THE SHOP_ERP SHALL maintain a Location Library — a list of predefined physical locations (e.g., "Machine Shop", "QC Lab", "Vendor - Anodize Co.") stored in the database and manageable via the Settings page.
3. WHEN a user defines or edits Process Steps on a Path or Template, THE SHOP_ERP SHALL present the process name field as a searchable dropdown populated from the Process Library, with a "New Process" option that allows adding a new entry inline.
4. WHEN a user defines or edits Process Steps on a Path or Template, THE SHOP_ERP SHALL present the location field as a searchable dropdown populated from the Location Library, with a "New Location" option that allows adding a new entry inline.
5. WHEN a user selects "New Process" or "New Location" from the dropdown, THE SHOP_ERP SHALL prompt for the new name, add it to the respective library, and select it for the current step.
6. THE SHOP_ERP SHALL provide a management interface in the Settings page for viewing, adding, editing, and removing entries from both the Process Library and Location Library.
7. IF a user removes a Process or Location entry that is currently in use by existing Process Steps, THEN THE SHOP_ERP SHALL display a warning but allow the removal — existing steps retain their current names.
8. THE SHOP_ERP SHALL seed the Process Library and Location Library with default entries during initial setup, including common shop processes (CNC Machine, Inspection, Chemfilm, Stress Relief, Pinning, Coating, SPDT, Nano Black) and common locations (Machine Shop, QC Lab, Vendor).
9. THE seed script SHALL include the predefined processes and locations so that development and demo environments start with realistic data.

### Requirement 17: Notes Display on Part Detail Page

**User Story:** As a shop manager, I want to see all notes and defects associated with a serial number on its Part Detail page, so that I can review the full history of issues for that part.

#### Acceptance Criteria

1. THE Part Detail page SHALL display a "Notes" section showing all StepNotes associated with the current Serial Number, in reverse chronological order.
2. FOR each note, THE Part Detail page SHALL display: the step name where the note was created, the note text, the user who created it, and the timestamp.
3. THE Part Detail page SHALL also display notes created at any step in the Serial Number's Path that reference the current Serial Number in their `serialIds` list.
4. IF no notes exist for the Serial Number, THEN THE Part Detail page SHALL display an empty state message.

### Requirement 18: Template Editing

**User Story:** As a shop planner, I want to edit an existing route template's steps (add, remove, reorder, rename), so that I can update templates as processes evolve without deleting and recreating them.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL provide an "Edit" button on each Template Route in the Templates page that opens the template for editing.
2. WHEN editing a template, THE SHOP_ERP SHALL allow adding new steps, removing existing steps, reordering steps, and changing step names, locations, optional flags, and dependency types.
3. WHEN a user saves template edits, THE SHOP_ERP SHALL persist the updated steps to the template without affecting any Paths that were previously created from the template (template independence preserved).
4. THE SHOP_ERP SHALL use the Process Library and Location Library dropdowns when editing template steps, consistent with Path step editing.

### Requirement 19: Path Deletion

**User Story:** As a shop planner, I want to delete a path from a job that has no serial numbers, so that I can remove incorrectly configured routes before production starts.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL provide a "Delete" button on each Path in the Job Routing tab.
2. IF the Path has zero Serial Numbers, THEN THE SHOP_ERP SHALL delete the Path and all its Process Steps after a confirmation prompt.
3. IF the Path has one or more Serial Numbers, THEN THE SHOP_ERP SHALL reject the deletion and display: "Cannot delete a path with existing serial numbers."
4. WHEN a Path is deleted, THE SHOP_ERP SHALL refresh the Job Routing tab to reflect the removal.

### Requirement 20: Certificate Detail View

**User Story:** As a quality engineer, I want to view a certificate's full details including which serial numbers it's attached to, so that I can trace material and process certifications across parts.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL make each Certificate row on the Certificates page clickable, navigating to a Certificate detail view.
2. THE Certificate detail view SHALL display: certificate name, type (material/process), all metadata key-value pairs, and creation date.
3. THE Certificate detail view SHALL display a list of all Serial Numbers the certificate is attached to, showing: SN identifier, the step where it was attached, who attached it, and when.
4. WHEN a user clicks a Serial Number in the attachment list, THE SHOP_ERP SHALL navigate to the Part Detail page for that Serial Number.

### Requirement 21: Certificate Attachment from Part Detail Page

**User Story:** As a shop floor operator, I want to attach a certificate to a serial number directly from the Part Detail page, so that I can record cert traceability without navigating to a separate page.

#### Acceptance Criteria

1. THE Part Detail page SHALL display an "Attach Certificate" button on the Routing tab when the Serial Number is in-progress.
2. WHEN the operator clicks "Attach Certificate", THE SHOP_ERP SHALL display a searchable Certificate dropdown and attach the selected Certificate to the Serial Number at its current Process Step.
3. THE Part Detail page SHALL display all Certificates currently attached to the Serial Number, showing: cert name, type, the step where attached, and who attached it.
4. IF the Serial Number is completed or scrapped, THEN THE Part Detail page SHALL display attached certificates as read-only (no attach button).

### Requirement 22: Audit Trail Filtering

**User Story:** As a quality engineer, I want to filter the audit trail by action type, user, serial number, job, and date range, so that I can quickly find specific audit entries during investigations.

#### Acceptance Criteria

1. THE Audit Trail page SHALL provide filter controls for: action type (dropdown of all action types), user (dropdown of ShopUsers), serial number (text search), job (dropdown of Jobs), and date range (start/end date pickers).
2. WHEN filters are applied, THE Audit Trail page SHALL display only entries matching all active filter criteria (AND logic).
3. WHEN filters are cleared, THE Audit Trail page SHALL display all entries.
4. THE Audit Trail page SHALL display the count of filtered results versus total results when filters are active.
5. THE Audit Trail page SHALL support the new lifecycle action types (serial_scrapped, serial_force_completed, step_deferred, etc.) in the action type filter dropdown.

## Correctness Properties (for Property-Based Testing)

### CP-1: Scrap Exclusion from Progress

FOR ALL Jobs, the progress percentage SHALL equal `completedCount / (goalQuantity - scrappedCount) * 100`. Scrapped Serial Numbers SHALL NOT appear in either the completed count or the in-progress count. This invariant holds after any sequence of scrap, advancement, and completion operations.

### CP-2: Step Status Conservation

FOR ALL Serial Numbers on a Path, the count of step statuses (pending + in_progress + completed + skipped + deferred + waived) SHALL equal the total number of Process Steps in the Path. No step status is lost or duplicated during any advancement, skip, defer, or waiver operation.

### CP-3: Deferred Step Blocks Completion

FOR ALL Serial Numbers with one or more deferred required steps, normal completion (setting currentStepIndex to -1) SHALL be rejected. Only Force Complete can bypass this constraint. This property holds regardless of the number of completed, skipped, or optional steps.

### CP-4: Optional Step Skip Does Not Block Completion

FOR ALL Serial Numbers where all required steps are completed (or waived) and only optional steps are skipped, normal completion SHALL succeed. The presence of skipped optional steps SHALL NOT prevent a Serial Number from reaching completed status.

### CP-5: Step Override Reversibility

FOR ALL Step Overrides that have not yet resulted in a skip or completion of the overridden step, reversing the override SHALL restore the step to its original required status. After reversal, the step SHALL behave identically to a step that was never overridden.

### CP-6: Scrap Immutability

FOR ALL scrapped Serial Numbers, no advancement, completion, force-complete, or further scrap operation SHALL succeed. A scrapped Serial Number's status is terminal — the only valid query operations are read and audit trail lookup.

### CP-7: Physical Dependency Hard Block

FOR ALL Process Steps with dependency type "physical", no Serial Number SHALL advance past that step without completing it, regardless of the Path's Advancement Mode (strict, flexible, or per_step). This property holds for all combinations of advancement mode and dependency type.

### CP-8: Bonus Part Tracking Consistency

FOR ALL Jobs, the Produced Quantity SHALL equal the count of all Serial Numbers (including scrapped). The Ordered Quantity SHALL equal the Job's Goal Quantity. `producedQuantity >= 0` and `orderedQuantity > 0` always hold. Bonus parts (SNs created after the count exceeds Goal Quantity) SHALL follow the same Path and step rules as non-bonus parts.

### CP-9: BOM Version Immutability

FOR ALL BOM Versions, the version snapshot entries SHALL remain unchanged after creation. Editing the current BOM SHALL create a new version without modifying any previous version's data. `version[N].entries == version[N].entries` holds for all reads after creation.

### CP-10: Audit Trail Completeness for Lifecycle Actions

FOR ALL scrap, force-complete, step-override, defer, skip, waiver, and BOM edit operations, exactly one Audit Trail entry with the corresponding action type SHALL be created. The count of lifecycle audit entries for a Serial Number SHALL equal the number of lifecycle operations performed on that Serial Number.

### CP-11: Advancement Mode Enforcement

FOR ALL Paths in "strict" Advancement Mode, advancing a Serial Number from step N SHALL only succeed for destination step N+1 (or completion at the final step). Any attempt to advance to step N+2 or beyond SHALL be rejected. This property holds regardless of step dependency types or optional flags.

### CP-12: Force Complete Audit Fidelity

FOR ALL force-completed Serial Numbers, the Audit Trail entry SHALL contain the exact set of step IDs that were incomplete at the time of force completion. The set of incomplete steps in the audit entry SHALL match the set of steps with status "deferred" or "pending" (required) at the moment of force completion.

### CP-13: Flexible Advancement Step Classification

FOR ALL flexible advancements that bypass intermediate steps, each bypassed optional step SHALL be classified as "skipped" and each bypassed required step SHALL be classified as "deferred". The union of skipped and deferred steps from the advancement SHALL equal the set of all bypassed steps. No bypassed step is left unclassified.
