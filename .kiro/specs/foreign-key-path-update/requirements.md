# Requirements Document

## Introduction

This document specifies the requirements for fixing the FOREIGN KEY constraint failure that occurs when updating a Path's steps (GitHub Issue #9). The root cause is that `pathService.updatePath()` generates new step IDs for every step and `SQLitePathRepository.update()` performs a delete-and-recreate of all steps, breaking FK references from four dependent tables (`cert_attachments`, `step_notes`, `part_step_statuses`, `part_step_overrides`). The fix shifts to an UPDATE-in-place + INSERT-only strategy with a reconciliation function and FK-dependent guard, covering both entry points: PathEditor (Job Detail page) and JobCreationForm/useJobForm (Job Edit page).

## Glossary

- **PathService**: The server-side service (`server/services/pathService.ts`) responsible for path business logic including validation and step reconciliation.
- **PathRepository**: The SQLite repository (`server/repositories/sqlite/pathRepository.ts`) responsible for persisting path and step data.
- **ReconcileSteps**: A pure function that matches input steps to existing steps by position, producing update, insert, and delete sets.
- **StepReconciliation**: The data structure returned by ReconcileSteps containing `toUpdate`, `toInsert`, and `toDelete` arrays.
- **FK_Dependent_Tables**: The four tables that reference `process_steps(id)`: `cert_attachments`, `step_notes`, `part_step_statuses`, `part_step_overrides`.
- **HasStepDependents**: A repository helper that checks whether a given step ID is referenced by any FK_Dependent_Tables.
- **PathEditor**: The Vue component (`PathEditor.vue`) for inline path editing on the Job Detail page (`/jobs/[id]`).
- **JobCreationForm**: The Vue component (`JobCreationForm.vue`) used on the Job Edit page (`/jobs/edit/[id]`).
- **UseJobForm**: The composable (`useJobForm.ts`) that manages job editing state and calls `computePathChanges()` to detect modified paths.

## Requirements

### Requirement 1: Step ID Preservation During Path Update

**User Story:** As a user editing a path, I want existing step IDs to be preserved when I update step fields, so that all FK references (certificates, notes, statuses, overrides) remain valid.

#### Acceptance Criteria

1. WHEN PathService receives a path update with steps, THE PathService SHALL fetch the existing path and call ReconcileSteps to match input steps to existing steps by position index
2. WHEN an input step maps to an existing step at the same position index, THE ReconcileSteps function SHALL reuse the existing step's ID in the toUpdate set rather than generating a new ID
3. WHEN an input step's position index exceeds the existing step count, THE ReconcileSteps function SHALL generate a new ID for that step and place it in the toInsert set
4. WHEN existing steps have position indices beyond the input step count, THE ReconcileSteps function SHALL place those existing step IDs in the toDelete set

### Requirement 2: Step Reconciliation Completeness

**User Story:** As a developer, I want the step reconciliation to account for every input step and every existing step, so that no steps are lost or duplicated during an update.

#### Acceptance Criteria

1. THE ReconcileSteps function SHALL produce output where the sum of toUpdate count and toInsert count equals the input step count
2. THE ReconcileSteps function SHALL produce output where the sum of toUpdate count and toDelete count equals the existing step count
3. THE ReconcileSteps function SHALL produce output where no step ID appears in both the toUpdate set and the toDelete set
4. THE ReconcileSteps function SHALL assign sequential order values starting from 0 to all steps in toUpdate and toInsert combined

### Requirement 3: FK-Safe Step Deletion

**User Story:** As a user removing steps from a path, I want the system to prevent deletion of steps that have associated data, so that certificates, notes, and part statuses are never orphaned.

#### Acceptance Criteria

1. WHEN PathRepository processes a step deletion, THE PathRepository SHALL call HasStepDependents to check all four FK_Dependent_Tables before executing the DELETE
2. IF a step marked for deletion has references in any FK_Dependent_Tables, THEN THE PathRepository SHALL throw a ValidationError with the message "Cannot remove step because it has associated data (certificates, notes, or part statuses). Remove the associated data first, or keep the step."
3. IF a step marked for deletion has zero references across all FK_Dependent_Tables, THEN THE PathRepository SHALL delete that step row from process_steps
4. WHEN HasStepDependents checks a step ID, THE HasStepDependents function SHALL query cert_attachments, step_notes, part_step_statuses, and part_step_overrides for any row referencing that step ID

### Requirement 4: Repository Update-in-Place Strategy

**User Story:** As a user editing a path, I want the repository to update existing steps in place rather than deleting and recreating them, so that FK references are never broken.

#### Acceptance Criteria

1. WHEN PathRepository receives an update with steps, THE PathRepository SHALL UPDATE existing step rows (matched by ID) with new field values for name, location, step_order, optional, and dependency_type
2. WHEN PathRepository receives an update with new steps (not matching any existing ID), THE PathRepository SHALL INSERT those steps as new rows in process_steps
3. THE PathRepository SHALL execute all step updates, inserts, and deletes within a single SQLite transaction so that all changes succeed together or none are applied
4. IF any step deletion is blocked by FK dependents, THEN THE PathRepository SHALL roll back the entire transaction and report the error

### Requirement 5: UNIQUE Constraint Handling During Reorder

**User Story:** As a user reordering steps in a path, I want the update to succeed without hitting UNIQUE constraint violations on (path_id, step_order), so that step reordering works reliably.

#### Acceptance Criteria

1. WHEN PathRepository updates step_order values for existing steps, THE PathRepository SHALL first set temporary negative order values to avoid UNIQUE(path_id, step_order) conflicts
2. WHEN temporary order values are set, THE PathRepository SHALL then update each step to its final sequential order value within the same transaction
3. THE PathRepository SHALL produce sequential step_order values from 0 to N-1 with no duplicates after the update completes

### Requirement 6: Idempotent Path Update

**User Story:** As a user saving a path without making changes, I want the update to succeed without errors, so that accidental re-saves do not cause problems.

#### Acceptance Criteria

1. WHEN PathService receives a path update with identical data to the current state, THE PathService SHALL complete the update without errors
2. WHEN a path is updated with the same steps in the same order, THE PathRepository SHALL UPDATE each step in place with the same values and return the path unchanged (modulo updatedAt timestamp)

### Requirement 7: Both Entry Points Covered

**User Story:** As a user, I want the FK constraint fix to work regardless of whether I edit a path from the Job Detail page (PathEditor) or the Job Edit page (JobCreationForm), so that both workflows are reliable.

#### Acceptance Criteria

1. WHEN a user updates a path via PathEditor on the Job Detail page, THE PathService SHALL apply the same ReconcileSteps logic to preserve step IDs and guard FK deletions
2. WHEN a user updates a path via JobCreationForm on the Job Edit page, THE PathService SHALL apply the same ReconcileSteps logic to preserve step IDs and guard FK deletions
3. THE PathEditor and JobCreationForm SHALL require no client-side code changes because the fix is entirely server-side in PathService and PathRepository

### Requirement 8: Clear Error Messaging

**User Story:** As a user, I want clear error messages when a step cannot be removed, so that I understand why the operation failed and what to do about it.

#### Acceptance Criteria

1. WHEN a step removal is blocked by FK dependents, THE API route SHALL return a 400 status code with a descriptive error message identifying the cause
2. WHEN a path update fails due to FK-dependent step removal, THE PathService SHALL surface a ValidationError rather than allowing a raw SQLite FOREIGN KEY constraint error to propagate
3. IF a path ID does not exist, THEN THE PathService SHALL return a NotFoundError with a 404 status code
