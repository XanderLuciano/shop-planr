# Requirements Document

## Introduction

This document defines the requirements for the "Part Notes Without Advance" feature (GitHub Issue #51). The feature enables operators to attach timestamped, attributed notes to one or more parts at a process step without triggering any part advancement. Currently, standalone note creation is supported by the backend (`noteService.createNote`) but the UI only exposes note creation as part of the advancement flow or via the part detail page's inline form. These requirements capture the UI-layer additions needed to close that gap: a dedicated `AddNoteDialog` component, integration into the `ProcessAdvancementPanel`, and notes history visibility on the part detail page.

## Glossary

- **AddNoteDialog**: A new modal dialog component that allows operators to select parts and enter note text without advancing parts.
- **ProcessAdvancementPanel**: The existing panel on the Step View page that manages part selection and advancement actions.
- **Step_View**: The page at `/parts/step/[stepId]` that displays parts at a given process step and hosts the advancement panel.
- **Part_Detail_Page**: The page at `/serials/[id]` that shows full details for a single part, including its notes history.
- **NoteService**: The server-side service (`noteService`) responsible for creating and querying `StepNote` records.
- **UseNotes**: The client-side composable (`useNotes`) that wraps API calls for note creation and retrieval.
- **Operator**: A `ShopUser` who interacts with the system at a workstation; identified by `operatorId`.
- **StepNote**: A domain entity representing a note attached to one or more parts at a process step, stored in the `step_notes` table.

## Requirements

### Requirement 1: Add Note to Single Part Without Advancing

**User Story:** As an operator, I want to add a note to a single part without advancing it, so that I can record observations or issues at the current step without affecting the part's routing position.

#### Acceptance Criteria

1. WHEN an operator clicks the "Add Note" button on the Step View page, THE AddNoteDialog SHALL open with all parts at the current step available for selection.
2. WHEN an operator selects exactly one part and enters non-empty note text and clicks Save, THE AddNoteDialog SHALL call UseNotes.createNote with the selected part ID, note text, step context, and operator identity.
3. WHEN a note is successfully created for a single part, THE AddNoteDialog SHALL close, emit a `saved` event with the created StepNote, and display a success toast notification.
4. WHEN a note is created via the AddNoteDialog, THE NoteService SHALL persist the note without modifying the `current_step_id` of any part.

### Requirement 2: Add Note to Multiple Parts at Once

**User Story:** As an operator, I want to add a note to multiple selected parts at once, so that I can efficiently record a shared observation across a batch without repeating the action for each part.

#### Acceptance Criteria

1. WHEN the AddNoteDialog is open, THE AddNoteDialog SHALL display a checkbox list of all available parts at the step, allowing the operator to select multiple parts.
2. WHEN an operator selects two or more parts and enters non-empty note text and clicks Save, THE AddNoteDialog SHALL call UseNotes.createNote with all selected part IDs in a single request.
3. WHEN the ProcessAdvancementPanel has parts already selected, THE AddNoteDialog SHALL pre-select those parts via the `preSelectedPartIds` prop.
4. WHEN a multi-part note is created, THE NoteService SHALL store a single StepNote record with all selected part IDs in the `partIds` JSON array.

### Requirement 3: Note Attribution and Timestamping

**User Story:** As a shop manager, I want every note to be timestamped and attributed to the operator who created it, so that I can trace observations back to specific people and times.

#### Acceptance Criteria

1. WHEN a note is created, THE NoteService SHALL set the `createdBy` field to the operator's user ID and the `createdAt` field to a valid ISO 8601 timestamp.
2. WHILE no operator identity is selected, THE AddNoteDialog Save button SHALL be disabled, preventing note creation without attribution.
3. WHEN a note is created, THE NoteService SHALL record an audit entry with action `note_created` containing the operator's user ID, job ID, path ID, and step ID.

### Requirement 4: Notes History Visibility

**User Story:** As an operator, I want to see the full notes history when viewing part details, so that I can review all observations and issues recorded against a part.

#### Acceptance Criteria

1. WHEN an operator views a part on the Part_Detail_Page, THE Part_Detail_Page SHALL display all notes associated with that part, including notes created via the AddNoteDialog.
2. WHEN a multi-part note exists, THE Part_Detail_Page SHALL display that note for each part referenced in the note's `partIds` array.
3. WHEN notes are displayed, THE Part_Detail_Page SHALL show the note text, the operator's identity (`createdBy`), and the timestamp (`createdAt`) for each note.
4. WHEN a new note is created on the Step View page, THE Step_View SHALL refresh the displayed notes list to include the newly created note.

### Requirement 5: Input Validation

**User Story:** As a system operator, I want the note creation form to enforce valid input, so that incomplete or empty notes are never persisted.

#### Acceptance Criteria

1. WHILE the note text field is empty or contains only whitespace, THE AddNoteDialog SHALL disable the Save button.
2. WHILE no parts are selected in the AddNoteDialog, THE AddNoteDialog SHALL disable the Save button.
3. THE AddNoteDialog SHALL enforce a maximum note text length of 1000 characters via a `maxlength` attribute on the textarea.
4. IF the API call to create a note fails, THEN THE AddNoteDialog SHALL display an error toast notification and keep the dialog open with the note text preserved for retry.
5. WHEN the NoteService receives empty text after trimming, THE NoteService SHALL throw a ValidationError.
6. WHEN the NoteService receives an empty partIds array, THE NoteService SHALL throw a ValidationError.

### Requirement 6: ProcessAdvancementPanel Integration

**User Story:** As an operator, I want to access the "Add Note" action directly from the advancement panel, so that I can quickly add notes without leaving my current workflow context.

#### Acceptance Criteria

1. THE ProcessAdvancementPanel SHALL display an "Add Note" button in its actions bar alongside the existing Advance, Skip, and Cancel buttons.
2. WHEN the operator clicks the "Add Note" button, THE ProcessAdvancementPanel SHALL open the AddNoteDialog with the current step's part IDs and job/path/step context.
3. WHEN the AddNoteDialog emits a `saved` event, THE ProcessAdvancementPanel SHALL emit a `noteAdded` event so the parent Step_View page can refresh notes.
4. WHEN the AddNoteDialog is opened from the ProcessAdvancementPanel, THE AddNoteDialog SHALL receive the currently selected parts as `preSelectedPartIds`.
