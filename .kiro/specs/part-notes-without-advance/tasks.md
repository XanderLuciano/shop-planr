# Implementation Plan: Part Notes Without Advance

## Overview

Add an "Add Note" action to the Step View page that lets operators attach notes to selected parts without triggering advancement. The backend already supports standalone note creation — this is purely a UI-layer feature. The implementation creates a new `AddNoteDialog` component, integrates it into `ProcessAdvancementPanel`, and wires up note refresh on the Step View page.

## Tasks

- [x] 1. Create the AddNoteDialog component
  - [x] 1.1 Create `app/components/AddNoteDialog.vue` with UModal, part checkbox list, note textarea, Save/Cancel buttons
    - Props: `modelValue` (boolean v-model), `partIds` (string[]), `jobId`, `pathId`, `stepId`, `stepName`, `preSelectedPartIds?` (string[])
    - Emits: `update:modelValue`, `saved` (StepNote)
    - Use `useNotes().createNote()` for the API call
    - Use `useOperatorIdentity().operatorId` for the `userId` field
    - Disable Save when: no parts selected, note text empty/whitespace-only, or no operator selected
    - Show character count (max 1000) via `maxlength` on UTextarea
    - Show success toast on save, error toast on failure (keep dialog open on error with text preserved)
    - Pre-select parts from `preSelectedPartIds` prop on open
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.2, 5.1, 5.2, 5.3, 5.4_

  - [x] 1.2 Write unit tests for AddNoteDialog
    - Test: renders part checkbox list from `partIds` prop
    - Test: Save button disabled when no text entered
    - Test: Save button disabled when no parts selected
    - Test: emits `saved` event on successful note creation
    - Test: shows error toast on API failure, dialog stays open
    - Test: pre-selects parts from `preSelectedPartIds`
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.3, 5.1, 5.2, 5.4_

- [x] 2. Integrate AddNoteDialog into ProcessAdvancementPanel
  - [x] 2.1 Add "Add Note" button and dialog wiring to `app/components/ProcessAdvancementPanel.vue`
    - Add `UButton` with label "Add Note", icon `i-lucide-message-square-plus`, variant `outline` in the actions bar
    - Add `showAddNoteDialog` ref and wire it to `AddNoteDialog` v-model
    - Pass `localPartIds` as `partIds`, spread of `selectedParts` as `preSelectedPartIds`
    - Pass `job.jobId`, `job.pathId`, `job.stepId`, `job.stepName` as context props
    - Add `noteAdded` emit; on `AddNoteDialog` `saved` event, emit `noteAdded` with the created StepNote
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 2.2 Write unit tests for ProcessAdvancementPanel "Add Note" integration
    - Test: "Add Note" button renders in actions bar
    - Test: clicking "Add Note" opens AddNoteDialog with correct props
    - Test: `noteAdded` event emitted when dialog saves
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 3. Wire Step View page to handle noteAdded event
  - [x] 3.1 Update `app/pages/parts/step/[stepId].vue` to handle `noteAdded` from ProcessAdvancementPanel
    - Listen for `@noteAdded` on `ProcessAdvancementPanel`
    - On `noteAdded`, call `fetchStep()` to refresh step data including notes
    - _Requirements: 4.4_

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Property-based tests for note creation without advancement
  - [x] 5.1 Write property test: note creation never modifies part position
    - **Property 1: Note creation never modifies part position**
    - For any set of parts at a process step and any valid note text, creating a note via `noteService.createNote` leaves `current_step_id` unchanged for every referenced part
    - File: `tests/properties/noteWithoutAdvance.property.test.ts`
    - Use `createTestContext()` from integration helpers; generate arbitrary note text and part subsets with fast-check
    - **Validates: Requirement 1.4**

  - [x] 5.2 Write property test: note attribution and valid timestamp
    - **Property 2: Note attribution and valid timestamp**
    - For any valid user ID and note text, the created StepNote has `createdBy` equal to the input user ID and `createdAt` is a valid ISO 8601 timestamp
    - File: `tests/properties/noteWithoutAdvance.property.test.ts` (same file, second describe block)
    - **Validates: Requirement 3.1**

  - [x] 5.3 Write property test: note visible from each referenced part
    - **Property 3: Note visible from each referenced part**
    - For any non-empty subset of part IDs used to create a note, `getNotesForPart` for each part ID returns a list containing that note
    - File: `tests/properties/noteWithoutAdvance.property.test.ts` (same file, third describe block)
    - **Validates: Requirements 2.4, 4.2**

  - [x] 5.4 Write property test: audit trail records note creation
    - **Property 4: Audit trail records note creation**
    - For any valid note creation input, the audit log contains exactly one new `note_created` entry with matching user ID, job ID, path ID, and step ID
    - File: `tests/properties/noteWithoutAdvance.property.test.ts` (same file, fourth describe block)
    - **Validates: Requirement 3.3**

  - [x] 5.5 Write property test: whitespace-only text is rejected
    - **Property 5: Whitespace-only text is rejected**
    - For any string composed entirely of whitespace characters, `noteService.createNote` throws a ValidationError and no StepNote is persisted
    - File: `tests/properties/noteWithoutAdvance.property.test.ts` (same file, fifth describe block)
    - **Validates: Requirements 5.1, 5.5**

- [x] 6. Integration test for standalone note creation flow
  - [x] 6.1 Write integration test: create note without advancing, verify parts unchanged and note queryable
    - Create job → path → steps → parts → add note via `noteService.createNote` without advancing → verify all parts remain at same step → verify note appears in `getNotesForPart` for each referenced part and in `getNotesForStep`
    - Verify audit trail contains `note_created` entry
    - File: `tests/integration/noteAndDefect.test.ts` (add new describe block to existing file)
    - _Requirements: 1.4, 2.4, 3.1, 3.3, 4.2_

- [ ] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- No backend changes needed — `noteService.createNote`, `POST /api/notes`, `useNotes` composable, and `NoteRepository` are all reused as-is
- No schema migration required
- Each task references specific requirements for traceability
- Property tests validate the 5 correctness properties from the design document
