# Implementation Plan: Fix FOREIGN KEY Constraint on Path Update (Issue #9)

## Overview

Shift `pathService.updatePath()` and `SQLitePathRepository.update()` from a delete-and-recreate strategy to an UPDATE-in-place + INSERT-only strategy with a pure `reconcileSteps()` function and FK-dependent guard. No client-side changes needed — the fix is entirely server-side, covering both PathEditor and JobCreationForm entry points.

## Tasks

- [x] 1. Implement reconcileSteps() pure function
  - [x] 1.1 Create `reconcileSteps()` in `server/services/pathService.ts`
    - Add the `StepReconciliation` interface (`toUpdate: ProcessStep[]`, `toInsert: ProcessStep[]`, `toDelete: string[]`)
    - Implement `reconcileSteps(existingSteps, inputSteps)` as an exported pure function
    - Match input steps to existing steps by position index: reuse existing ID for positions `0..min(N,M)-1`, generate new ID for positions beyond existing count, collect removed step IDs for deletion
    - Assign sequential `order` values 0 to N-1 across all output steps
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

  - [x] 1.2 Write unit tests for reconcileSteps()
    - Test same-count steps (all updates, no inserts/deletes)
    - Test more input steps than existing (updates + inserts)
    - Test fewer input steps than existing (updates + deletes)
    - Test empty existing steps (all inserts)
    - Test single step path updates
    - Verify step IDs are preserved for matched positions
    - Verify new IDs are generated only for appended steps
    - Verify sequential order values 0..N-1
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

  - [x] 1.3 Write property test: Step ID Preservation (Property 1)
    - **Property 1: Step ID Preservation**
    - For any valid path with N existing steps and M input steps (M ≥ 1), the first `min(N, M)` output steps in toUpdate retain their original IDs
    - **Validates: Requirements 1.1, 1.2**

  - [x] 1.4 Write property test: Reconciliation Completeness (Property 2)
    - **Property 2: Reconciliation Completeness (Count Conservation)**
    - `|toUpdate| + |toInsert| === inputSteps.length` and `|toUpdate| + |toDelete| === existingSteps.length`; no ID in both toUpdate and toDelete
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [x] 1.5 Write property test: Append-Only Inserts (Property 3)
    - **Property 3: Append-Only Inserts**
    - All IDs in toInsert are freshly generated and disjoint from existing step IDs
    - **Validates: Requirements 1.3, 2.3**

  - [x] 1.6 Write property test: Sequential Order Invariant (Property 4)
    - **Property 4: Sequential Order Invariant**
    - All steps in toUpdate and toInsert combined have sequential order values 0..N-1 with no gaps or duplicates
    - **Validates: Requirements 2.4, 5.3**

  - [x] 1.7 Write property test: Idempotent Update (Property 5)
    - **Property 5: Idempotent Update**
    - Updating with identical data produces toUpdate with all existing steps, empty toInsert and toDelete
    - **Validates: Requirements 6.1, 6.2**

- [x] 2. Checkpoint — Ensure reconcileSteps tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add hasStepDependents() helper to the repository
  - [x] 3.1 Implement `hasStepDependents(stepId)` in `SQLitePathRepository`
    - Query `cert_attachments`, `step_notes`, `part_step_statuses`, and `part_step_overrides` for any row referencing the step ID
    - Return `true` if any reference exists, `false` otherwise
    - Add `hasStepDependents` to the `PathRepository` interface
    - _Requirements: 3.1, 3.4_

  - [x] 3.2 Write unit tests for hasStepDependents()
    - Test step with cert_attachments → returns true
    - Test step with step_notes → returns true
    - Test step with part_step_statuses → returns true
    - Test step with part_step_overrides → returns true
    - Test step with no dependents → returns false
    - _Requirements: 3.1, 3.4_

- [x] 4. Refactor SQLitePathRepository.update() to use UPDATE/INSERT/conditional-DELETE
  - [x] 4.1 Rewrite `SQLitePathRepository.update()` step handling
    - Replace `DELETE FROM process_steps WHERE path_id = ?` + re-insert with three-phase approach
    - Phase 1: Identify steps to update (existing IDs), insert (new IDs), and delete (removed IDs) from the reconciled `partial.steps`
    - Phase 2: Guard — call `hasStepDependents()` for each step to delete; throw `ValidationError` if any have FK dependents
    - Phase 3: Set temporary negative `step_order` values to avoid UNIQUE(path_id, step_order) conflicts during reorder
    - Phase 4: UPDATE existing steps in place (name, location, step_order, optional, dependency_type)
    - Phase 5: INSERT new steps
    - Phase 6: DELETE removed steps (already verified safe)
    - All within a single SQLite transaction — rollback on any error
    - _Requirements: 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3_

- [x] 5. Refactor pathService.updatePath() to call reconcileSteps()
  - [x] 5.1 Update `pathService.updatePath()` to use reconcileSteps()
    - When `input.steps` is provided, fetch existing path and call `reconcileSteps(existing.steps, input.steps)`
    - Build `partial.steps` from `toUpdate` + `toInsert` (preserving existing IDs for matched positions)
    - Pass `toDelete` step IDs to the repository (add to partial or handle via a new parameter)
    - Remove the current `generateId('step')` call for all steps — only reconcileSteps generates new IDs for appended steps
    - _Requirements: 1.1, 1.2, 7.1, 7.2, 7.3, 8.2, 8.3_

- [x] 6. Checkpoint — Ensure all existing tests still pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Integration tests for FK-safe path update
  - [x] 7.1 Write integration test: update path steps without FK violation
    - Create a path with steps, attach certs/notes to steps, then update the path (change goalQuantity, change step location)
    - Verify no FK errors and all references remain valid
    - Verify step IDs are preserved
    - _Requirements: 1.1, 1.2, 4.1, 7.1, 7.2_

  - [x] 7.2 Write integration test: append new steps to existing path
    - Create a path with 2 steps, update with 3 steps
    - Verify existing step IDs preserved, new step inserted with fresh ID
    - _Requirements: 1.3, 4.2_

  - [x] 7.3 Write integration test: remove step blocked by FK dependents
    - Create a path, attach cert to a step, then try to remove that step
    - Verify `ValidationError` is thrown (not raw SQLite FK error)
    - Verify error message matches requirement 3.2
    - _Requirements: 3.2, 8.1, 8.2_

  - [x] 7.4 Write integration test: remove step with no dependents succeeds
    - Create a path with steps that have no dependents, remove a step
    - Verify successful deletion
    - _Requirements: 3.3_

  - [x] 7.5 Write integration test: idempotent update (save without changes)
    - Update a path with identical data
    - Verify no errors and path returned unchanged (modulo updatedAt)
    - _Requirements: 6.1, 6.2_

  - [x] 7.6 Write integration test: both entry points produce same result
    - Simulate PathEditor payload shape and JobCreationForm/useJobForm payload shape
    - Verify both produce the same reconciliation outcome through pathService.updatePath()
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The fix is entirely server-side — no changes to PathEditor.vue, JobCreationForm.vue, or useJobForm.ts
- Property tests use `fast-check` following the project's existing pattern in `tests/properties/`
- Integration tests use the project's `createTestContext()` helper from `tests/integration/helpers.ts`
- All step reconciliation logic is in a pure function for easy testing
- The UNIQUE(path_id, step_order) constraint is handled via temporary negative order values during reorder
