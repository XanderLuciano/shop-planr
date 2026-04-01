# Requirements Document

## Introduction

Shop Planr currently tracks a part's position through its process path using `currentStepIndex`, an integer index into the path's ordered step array. When steps are reordered, the part stays at the same index number, which means it effectively "moves" to a different step — a virtual relocation that does not match physical reality. This feature replaces index-based position tracking with step-ID-based tracking, so that a part's location is anchored to the specific process step it is physically at, regardless of how the path is reordered. It also introduces a full routing history per part that records every step transition, supports recycling through previously completed steps, and integrates with the existing skipped/optional step system.

## Glossary

- **Part**: A tracked unit of production (domain type `Part`) that moves through a sequence of process steps. Identified by a unique part ID.
- **Process_Step**: A named operation in a process path, identified by a unique step ID. Has properties: name, order, location, assignedTo, optional, dependencyType.
- **Path**: An ordered sequence of Process_Steps that defines the route a Part follows through production.
- **Current_Step_ID**: The step ID of the Process_Step where a Part is physically located. Replaces the integer `currentStepIndex`.
- **Routing_History**: An ordered, append-only log of all step transitions for a single Part, recording each step the Part has entered, completed, skipped, or recycled through.
- **Routing_Entry**: A single record in a Part's Routing_History, capturing the step ID, the status of that visit (completed, skipped, recycled, in_progress, pending), the sequence number of the visit, and timestamps.
- **Recycle**: When a path reorder or manual action causes a Part to pass through a Process_Step it has previously completed. The Routing_History records this as a second (or subsequent) visit.
- **Step_Reorder**: The act of changing the `order` values of Process_Steps within a Path, which changes the sequence parts follow but does not change step IDs.
- **Part_Step_Status**: The per-part, per-step status record (domain type `PartStepStatus`) tracking whether a step is pending, in_progress, completed, skipped, deferred, or waived for a given Part.
- **Reconcile_Steps**: The server function that matches incoming step edits to existing steps during a path update.
- **Full_Route**: The complete route view for a single Part, combining three sections: (1) historical steps the Part has already been through (completed, skipped, recycled), (2) the current step the Part is physically at, and (3) planned/future steps the Part still needs to go through based on the current Path ordering.
- **Planned_Step**: A Process_Step in the Path whose order is greater than the current step's order, and which the Part has not yet visited in this pass. Planned steps appear in the Full_Route as "pending" entries derived from the Path definition, not from Routing_History.

## Requirements

### Requirement 1: Step-ID-Based Position Tracking

**User Story:** As a shop floor manager, I want each part's current position to be tracked by step ID rather than step index, so that reordering process steps does not virtually relocate parts.

#### Acceptance Criteria

1. THE Part SHALL store its current position as a Current_Step_ID reference instead of an integer step index.
2. WHEN a Part is created, THE System SHALL set the Part's Current_Step_ID to the ID of the first Process_Step in the Path.
3. WHEN a Part completes all steps, THE System SHALL set the Part's Current_Step_ID to a null or sentinel value indicating completion.
4. WHEN a Step_Reorder occurs on a Path, THE System SHALL preserve each Part's Current_Step_ID unchanged, so that the Part remains associated with the same Process_Step regardless of its new position in the sequence.
5. WHEN the System queries parts at a given Process_Step, THE System SHALL filter by Current_Step_ID matching the step's ID, not by a positional index.

### Requirement 2: Step-ID-Based Part Advancement

**User Story:** As an operator, I want part advancement to use step IDs so that advancing a part moves it to the correct next step even after a path reorder.

#### Acceptance Criteria

1. WHEN a Part is advanced, THE System SHALL determine the next step by finding the Process_Step whose order is one greater than the current step's order in the Path, and set the Part's Current_Step_ID to that step's ID.
2. WHEN a Part is advanced past the final Process_Step, THE System SHALL mark the Part as completed and set Current_Step_ID to null.
3. WHEN `advanceToStep` is called, THE System SHALL accept a target step ID instead of a target step index, and update the Part's Current_Step_ID to the target step ID.
4. IF a Part's Current_Step_ID references a Process_Step that no longer exists in the Path, THEN THE System SHALL return a validation error indicating the step was removed.

### Requirement 3: Full Routing History

**User Story:** As a quality engineer, I want a complete routing history for each part, so that I can see every step the part has been through, in what order, and with what outcome.

#### Acceptance Criteria

1. THE Routing_History SHALL contain one Routing_Entry for each visit a Part makes to a Process_Step, ordered by sequence number.
2. WHEN a Part enters a Process_Step for the first time, THE System SHALL create a Routing_Entry with status "in_progress" and a sequence number one greater than the previous entry.
3. WHEN a Part completes a Process_Step, THE System SHALL update the corresponding Routing_Entry status to "completed" and record a completion timestamp.
4. WHEN a Part skips a Process_Step (optional or overridden), THE System SHALL create a Routing_Entry with status "skipped" and record the skip timestamp.
5. THE System SHALL allow multiple Routing_Entries for the same Part and Process_Step combination, each with a distinct sequence number, to support recycling.
6. FOR ALL Parts, reading the Routing_History from first to last entry SHALL produce the complete chronological record of every Process_Step the Part has visited or skipped.

### Requirement 4: Recycling Through Previously Completed Steps

**User Story:** As a shop floor manager, I want the system to handle parts recycling through steps they have already completed, so that rework or reorder scenarios are accurately tracked.

#### Acceptance Criteria

1. WHEN a Step_Reorder causes a Part's current position to be before a Process_Step the Part has previously completed, THE System SHALL allow the Part to advance through that step again.
2. WHEN a Part enters a Process_Step it has previously completed, THE System SHALL create a new Routing_Entry with a new sequence number, preserving the original completion entry.
3. WHEN a Part completes a recycled Process_Step, THE System SHALL mark the new Routing_Entry as "completed", independent of the original entry.
4. THE Routing_History SHALL show all visits to a recycled Process_Step, each with its own status and timestamps, so that an auditor can see the Part went through that step multiple times.

### Requirement 5: Integration with Skipped and Optional Steps

**User Story:** As a production planner, I want skipped and optional steps to appear correctly in the routing history, so that the record is complete even for steps the part did not physically go through.

#### Acceptance Criteria

1. WHEN a Part bypasses an optional or overridden Process_Step during advancement, THE System SHALL create a Routing_Entry with status "skipped" for that step.
2. WHEN a Step_Reorder causes a previously skipped Process_Step to appear before the Part's current position again, and the Part subsequently advances through that step, THE System SHALL create a new Routing_Entry with status "completed" for that second pass.
3. THE Routing_History SHALL distinguish between a step that was skipped on the first pass and completed on a subsequent pass by maintaining separate Routing_Entries with distinct sequence numbers and statuses.

### Requirement 6: Part_Step_Status Table Migration

**User Story:** As a developer, I want the part_step_statuses table to support multiple entries per part per step, so that recycling and re-visits are properly stored.

#### Acceptance Criteria

1. THE System SHALL remove the UNIQUE(part_id, step_id) constraint from the Part_Step_Status table to allow multiple status records per Part per Process_Step.
2. THE System SHALL add a sequence_number column to the Part_Step_Status table to distinguish multiple visits to the same step.
3. WHEN the System queries the current status of a Part at a Process_Step, THE System SHALL return the Routing_Entry with the highest sequence number for that Part and step combination.
4. THE System SHALL migrate existing Part_Step_Status records to have sequence_number = 1 without data loss.

### Requirement 7: Database Migration for Step-ID Tracking

**User Story:** As a developer, I want a database migration that replaces the integer step index column with a step ID column on the parts table, so that the schema matches the new tracking model.

#### Acceptance Criteria

1. THE Migration SHALL add a `current_step_id` TEXT column to the parts table that references process_steps(id).
2. THE Migration SHALL populate `current_step_id` for all existing parts by looking up the Process_Step at the part's current `current_step_index` in its Path.
3. THE Migration SHALL set `current_step_id` to NULL for parts with `current_step_index = -1` (completed parts). This changes the completed sentinel from the integer `-1` to `NULL`, which is semantically cleaner (NULL = "not at any step").
4. THE Migration SHALL drop the `current_step_index` column from the parts table after data migration, using SQLite's create-copy-drop-rename pattern to safely rebuild the table.
5. IF a Part references a `current_step_index` that has no corresponding Process_Step (orphaned data), THEN THE Migration SHALL log a warning and set `current_step_id` to NULL.
6. THE Migration SHALL run within a transaction so that any failure rolls back all changes, leaving the database in its pre-migration state.
7. THE Migration SHALL be safe for production data — it must preserve all existing parts, their statuses, and their relationships. A backup of the database before migration is recommended but not enforced by the migration itself.
8. THE Migration SHALL add a `removed_at` TEXT column (nullable) to the `process_steps` table for soft-delete support.

### Requirement 7a: Completed Sentinel Migration (currentStepIndex = -1 → currentStepId = NULL)

**User Story:** As a developer, I want all code that checks for completed parts via `currentStepIndex === -1` to be updated to check `currentStepId === null`, so that the system works correctly after the migration.

#### Acceptance Criteria

1. ALL repository queries that filter on `current_step_index = -1` to find completed parts SHALL be updated to filter on `current_step_id IS NULL`.
2. ALL service logic that checks `part.currentStepIndex === -1` SHALL be updated to check `part.currentStepId === null` (or `=== undefined`).
3. ALL frontend code that checks `part.currentStepIndex === -1` to render "Completed" status SHALL be updated to check `part.currentStepId === null`.
4. THE `countCompletedByJobId` repository method SHALL query `WHERE current_step_id IS NULL AND status = 'completed'` instead of `WHERE current_step_index = -1`.
5. THE `getPathCompletedCount` service method SHALL query completed parts by `current_step_id IS NULL` instead of calling `listByStepIndex(pathId, -1)`.
6. THE `EnrichedPart` computed type SHALL use `currentStepId === null` to determine completed status instead of `currentStepIndex === -1`.

### Requirement 8: Reconcile Steps by Step ID

**User Story:** As a developer, I want the path update reconciliation to match steps by their ID rather than by position, so that reordering steps preserves their identity and all associated data.

#### Acceptance Criteria

1. WHEN a path update includes step inputs with step IDs, THE Reconcile_Steps function SHALL match each input to the existing step with the same ID, regardless of position.
2. WHEN a path update reorders steps, THE Reconcile_Steps function SHALL update the `order` field of each matched step to its new position without changing the step's ID.
3. WHEN a path update includes a new step (no matching ID), THE Reconcile_Steps function SHALL generate a new step ID and insert the step at the specified position.
4. WHEN a path update removes a step (existing ID not present in input), THE Reconcile_Steps function SHALL soft-delete the step (set `removed_at` timestamp) rather than physically deleting it, and SHALL validate that no active parts reference that step as their Current_Step_ID before allowing the soft-delete.
5. THE StepInput type SHALL include an optional `id` field so that the client can specify which existing step each input corresponds to.

### Requirement 9: Operator Step View with Step-ID Queries

**User Story:** As an operator, I want the step view page to find parts by step ID, so that the view is correct regardless of step ordering changes.

#### Acceptance Criteria

1. WHEN the operator step view API is called for a step ID, THE System SHALL query parts where Current_Step_ID matches the requested step ID, instead of querying by path ID and step index.
2. THE Part repository SHALL provide a `listByCurrentStepId(stepId: string)` query method that returns all active (non-scrapped) parts whose Current_Step_ID matches the given step ID.
3. THE Step distribution calculation SHALL count parts per step using Current_Step_ID grouping instead of step index grouping.

### Requirement 10: Clear Location and Next-Step Tracking

**User Story:** As a shop floor manager, I want to always know where a part is, who has it, and where it should go next, so that production flow is transparent.

#### Acceptance Criteria

1. THE System SHALL resolve a Part's current location by looking up the Process_Step matching the Part's Current_Step_ID and returning that step's location and assignedTo fields.
2. THE System SHALL determine a Part's next destination by finding the Process_Step whose order is one greater than the current step's order in the Path.
3. WHEN a Part's Current_Step_ID is null (completed), THE System SHALL report the Part's location as "Completed" with no next destination.
4. IF a Part's Current_Step_ID references a step whose order has changed due to a Step_Reorder, THEN THE System SHALL use the step's updated order to correctly determine the next step.

### Requirement 11: Full Route API

**User Story:** As a quality engineer, I want an API endpoint that returns a part's full route — history, current position, and planned future steps — so that I can see the complete picture of where a part has been and where it is going.

#### Acceptance Criteria

1. WHEN the full route API is called for a Part ID, THE System SHALL return a unified list of route entries that combines: (a) historical Routing_Entries from the part's routing history, (b) the current step entry, and (c) planned future steps derived from the Path's current step ordering.
2. THE full route response SHALL include for each entry: step ID, step name, step order, location, assignedTo, sequence number (for historical/current entries), status, entry timestamp, and completion timestamp.
3. FOR historical entries (steps the Part has already passed through), THE status SHALL reflect the actual outcome: "completed", "skipped", "deferred", "waived", or "recycled_completed" (for a second pass completion).
4. FOR the current entry (the step the Part is physically at), THE status SHALL be "in_progress" and the entry SHALL be marked as `isCurrent: true`.
5. FOR planned entries (steps the Part has not yet reached in this pass), THE status SHALL be "pending" and the entries SHALL be derived from the Path's process steps whose order is greater than the current step's order.
6. WHEN a Part is completed (Current_Step_ID is null), THE full route SHALL contain only historical entries with no planned entries, and no entry SHALL be marked as `isCurrent`.
7. WHEN a step appears in both the history (previously completed) AND in the planned future (due to a reorder causing recycling), THE full route SHALL show the historical entry with its original status AND a separate planned "pending" entry for the upcoming re-visit.
8. THE full route entries SHALL be ordered by: historical entries first (by sequence number ascending), then the current entry, then planned entries (by step order ascending).

### Requirement 12: Part Detail Full Route View

**User Story:** As a shop floor manager viewing a single part's detail page, I want to see the full route of that part — what processes it has been through, what process it is currently at, and what processes it is scheduled to go through next — so that I have complete visibility into the part's journey.

#### Acceptance Criteria

1. THE Part detail page routing card SHALL display the Full_Route for the part, showing all three sections: history, current, and planned.
2. FOR each historical step, THE view SHALL show the step name, location, status badge (completed/skipped/deferred/waived), and timestamps.
3. FOR the current step, THE view SHALL highlight it visually (e.g., primary color border) and show the step name, location, assignedTo, and "In Progress" status badge.
4. FOR each planned step, THE view SHALL show the step name, location, assignedTo, and a "Pending" status badge, visually distinguished from completed steps (e.g., muted styling).
5. WHEN a step has been visited multiple times (recycled), THE view SHALL show each visit as a separate entry in the route, so the user can see the part went through that step more than once.
6. THE view SHALL show the step order number for each entry so the user can see the sequence.
7. WHEN the part is completed, THE view SHALL show all steps as historical with their final statuses and a "Completed" indicator at the end.

### Requirement 13: Steps Added Behind Active Parts

**User Story:** As a shop floor manager, I want the system to handle new steps being inserted into a path before parts that have already passed that position, so that parts continue advancing normally and the unvisited step is clearly visible in the routing record.

#### Acceptance Criteria

1. WHEN a new Process_Step is inserted into a Path at an order position before a Part's current step, THE System SHALL NOT move the Part backward or block its forward advancement.
2. THE Part SHALL continue to advance forward from its Current_Step_ID through subsequent steps as normal.
3. THE Full_Route for the Part SHALL show the newly inserted step as "N/A" (status value `'na'`) — a step that exists in the path but was never entered by this Part because it was added after the Part had already passed that position.
4. THE "N/A" status SHALL be visually distinct from "pending" (future steps the part will go through) and "skipped" (steps the part intentionally bypassed during advancement). THE UI SHALL display an "N/A" badge with a tooltip explaining: "This step was added to the route after this part had already passed this point."
5. WHEN the Part reaches the final step and is advanced to completion, THE System SHALL mark the Part as completed regardless of any "N/A" steps in its route.
6. THE existing `canComplete` check SHALL treat "N/A" steps the same as steps with no routing entry — they do not block completion unless the path's advancement mode or step dependency rules explicitly require them.

### Future Considerations (Out of Scope)

The following capabilities are acknowledged as future enhancements and are intentionally excluded from this iteration. The data model and routing history design support these without schema changes:

- **Return to Step**: A manager action to send a part backward to a previously skipped or N/A step, then have it re-advance forward. The routing history's sequence-number-based append-only model supports this — it would create new routing entries for the backward visit and subsequent re-traversal.
- **Backward Advancement UI**: A UI flow for selecting a part and choosing a prior step to send it to, with reason tracking and audit trail.
- **Skip/Bypass/Force-Advance UI**: Full UI flows for the existing skip, waive, defer, and force-complete features on the part detail page. These features exist at the service layer but lack dedicated UI beyond the basic advancement panel.

### Requirement 14: Soft-Delete of Process Steps (Step Removal)

**User Story:** As a shop floor manager, I want to remove a process step from a route mid-production without losing the routing history of parts that already went through that step, so that the production record remains complete even when requirements change.

#### Acceptance Criteria

1. WHEN a user removes a Process_Step from a Path via a path update, THE System SHALL soft-delete the step by setting a `removed_at` timestamp rather than physically deleting the row from the database.
2. IF any active (non-scrapped, non-completed) Part has its Current_Step_ID set to the step being removed, THEN THE System SHALL reject the removal with a validation error: "Cannot remove step — advance all parts through this step first."
3. AFTER a step is soft-deleted, THE System SHALL exclude it from the Path's active step list — it SHALL NOT appear in `path.steps` for routing, advancement, or step distribution purposes.
4. THE routing history entries (`part_step_statuses`) that reference the removed step SHALL remain intact — the step ID foreign key references SHALL continue to resolve to the soft-deleted step row.
5. WHEN the Full_Route API builds the route for a Part that previously went through a removed step, THE System SHALL include the step in the historical section with its original status (completed, skipped, etc.) and a `removed: true` flag indicating the step has been removed from the active route.
6. THE Full_Route view SHALL visually indicate removed steps (e.g., strikethrough or "Removed" label) so the user can see the step was part of the route but is no longer active.
7. FOR Parts that have not yet reached the removed step (it was in their planned future), THE System SHALL simply omit the step from their planned route — it disappears from their future steps as if it was never there.
8. THE `process_steps` table SHALL add a `removed_at` TEXT column (nullable) to support soft-deletion. Steps with `removed_at IS NULL` are active; steps with a value are soft-deleted.

### Requirement 15: Write-Time Step Completion Counter

**User Story:** As a developer, I want the "done" count per step to be maintained as a write-time counter rather than computed on every read, so that step distribution queries are fast and the count is always correct regardless of step reordering.

#### Acceptance Criteria

1. THE `process_steps` table SHALL have a `completed_count` INTEGER column (default 0) that tracks how many parts have completed that step based on routing history.
2. WHEN a Part completes a Process_Step (routing entry status changes to "completed"), THE System SHALL atomically increment the step's `completed_count` by 1 within the same transaction as the routing entry update.
3. WHEN the `getStepDistribution` function calculates the "done" count for a step, THE System SHALL read the step's `completed_count` column directly instead of computing it from part positions or routing history queries.
4. THE definition of "done" for a step SHALL be: "the number of distinct parts that have a completed routing entry for this step" — not "the number of parts currently positioned after this step in the sequence."
5. THE System SHALL provide a server-side reconciliation operation that recounts `completed_count` for all steps in a path by querying routing history, to correct any drift between the counter and the actual routing data.
6. THE Migration SHALL initialize `completed_count` for all existing steps by counting the number of parts with a completed `part_step_statuses` entry for each step ID.
7. THE `completed_count` SHALL NOT be decremented when steps are reordered — reordering does not undo the fact that a part went through a step.

### Requirement 16: Update AI Agent Documentation

**User Story:** As a developer working with AI agents, I want the architectural decisions from this feature documented in the AI-facing files, so that future AI-assisted development understands the intentional design choices.

#### Acceptance Criteria

1. THE `.ai/architecture.md` file SHALL be updated to document: (a) step-ID-based part tracking as the canonical position tracking method, (b) the routing history model with append-only entries and sequence numbers, (c) write-time counters as the preferred pattern for derived counts, and (d) the reconcileSteps ID-based matching strategy.
2. THE `.ai/data-model.md` file SHALL be updated to reflect the new schema: `parts.current_step_id`, `process_steps.removed_at`, `process_steps.completed_count`, and the `part_step_statuses` table changes (sequence_number, entered_at, completed_at, no UNIQUE constraint).
3. THE `.kiro/steering/` files SHALL document the soft-delete preference: "Prefer soft-deletes (`removed_at` timestamp) over hard-deletes for any entity that may be referenced by historical records. This preserves FK integrity and audit trail completeness. All entities will eventually migrate to soft-delete; for now, `process_steps` uses this pattern."
4. THE `AI-MAP.md` file SHALL be updated to reflect the architectural changes in the Domain Model section and any new API endpoints.
