# Requirements Document

## Introduction

The serial number detail page (`app/pages/serials/[id].vue`) displays a Notes section within the Routing tab that currently only renders existing notes via the `PartDetailNotes` component. Users need the ability to create new notes directly from this page, associated with the serial number's current process step. This feature adds an inline note creation form to the Notes SectionCard, using the existing `useNotes` composable's `createNote` function and the page's available job, path, step, and operator context.

## Glossary

- **Notes_Section**: The SectionCard titled "Notes" on the serial detail page's Routing tab, which contains the `PartDetailNotes` component and the new note creation UI.
- **Add_Note_Form**: An inline form within the Notes_Section that allows the operator to type and submit a new note.
- **PartDetailNotes_Component**: The `PartDetailNotes.vue` component that fetches and displays notes for a given serial number.
- **Operator**: The currently identified user via `useOperatorIdentity`, whose ID is used as the `userId` when creating notes.
- **Current_Step**: The process step the serial number is currently at, derived from the serial's `currentStepIndex` and the path's step list.
- **Note_Service**: The backend API at `POST /api/notes` that persists new `StepNote` records.

## Requirements

### Requirement 1: Display Add Note Button

**User Story:** As an operator, I want to see an "Add Note" button in the Notes section of the serial detail page, so that I can initiate note creation without navigating away.

#### Acceptance Criteria

1. WHEN the serial number status is in progress, THE Notes_Section SHALL display an "Add Note" button.
2. WHEN the serial number status is completed or scrapped, THE Notes_Section SHALL hide the "Add Note" button.
3. THE "Add Note" button SHALL use the `i-lucide-plus` icon and the label "Add Note".

### Requirement 2: Inline Note Creation Form

**User Story:** As an operator, I want an inline form to appear when I click "Add Note", so that I can type and submit a note without a modal or page navigation.

#### Acceptance Criteria

1. WHEN the Operator clicks the "Add Note" button, THE Add_Note_Form SHALL appear below the button, containing a text area and "Save" and "Cancel" buttons.
2. WHEN the Operator clicks "Cancel", THE Add_Note_Form SHALL close and clear the text area content.
3. WHILE the Add_Note_Form is visible, THE "Add Note" button SHALL be hidden to prevent duplicate forms.

### Requirement 3: Submit Note

**User Story:** As an operator, I want to submit a note so that it is saved and immediately visible in the notes list.

#### Acceptance Criteria

1. WHEN the Operator clicks "Save" with non-empty text, THE Add_Note_Form SHALL call the Note_Service with the serial's jobId, pathId, Current_Step stepId, the serial's ID in the serialIds array, the entered text, and the Operator's userId.
2. WHEN the Note_Service returns successfully, THE PartDetailNotes_Component SHALL refresh its notes list to include the newly created note.
3. WHEN the Note_Service returns successfully, THE Add_Note_Form SHALL close and clear the text area content.
4. WHEN the Note_Service returns successfully, THE Notes_Section SHALL display a success toast notification.

### Requirement 4: Validation and Error Handling

**User Story:** As an operator, I want clear feedback when note creation fails or when I try to submit an empty note, so that I understand what went wrong.

#### Acceptance Criteria

1. WHILE the text area is empty or contains only whitespace, THE "Save" button SHALL be disabled.
2. IF the Note_Service returns an error, THEN THE Notes_Section SHALL display an error toast notification with the error message.
3. IF the Note_Service returns an error, THEN THE Add_Note_Form SHALL remain open with the entered text preserved so the Operator can retry.

### Requirement 5: Loading State During Submission

**User Story:** As an operator, I want visual feedback while my note is being saved, so that I know the system is processing my request.

#### Acceptance Criteria

1. WHILE a note creation request is in progress, THE "Save" button SHALL display a loading indicator and be disabled.
2. WHILE a note creation request is in progress, THE "Cancel" button SHALL be disabled.
3. WHILE a note creation request is in progress, THE text area SHALL be read-only.
