# Implementation Plan: Serial Number Notes — Add Note

## Overview

Add inline note creation to the Notes SectionCard on the serial detail page (`app/pages/serials/[id].vue`). This is a frontend-only change — no new backend routes, components, or composable modifications. Three new refs, one new function, and template additions inside the existing Notes SectionCard. Uses TypeScript / Vue 3 / Nuxt UI 4.

## Tasks

- [x] 1. Add note creation state and handler to serial detail page
  - [x] 1.1 Add local refs and `handleSaveNote` function to `app/pages/serials/[id].vue`
    - Add `showNoteForm` (ref<boolean>, default false), `noteText` (ref<string>, default ''), `noteSaving` (ref<boolean>, default false)
    - Destructure `createNote` from `useNotes()` (already imported on the page)
    - Destructure `operatorId` from `useOperatorIdentity()` (already used in `handleAdvance`)
    - Implement `handleSaveNote`: guard on blank text / null `currentStep` / null `job` / null `path`; call `createNote({ jobId, pathId, stepId, serialIds: [serialId], text: noteText.value.trim(), userId: operatorId.value ?? 'system' })`; on success: set `showNoteForm = false`, `noteText = ''`, show success toast; on error: show error toast, keep form open with text preserved; always set `noteSaving = false` in finally
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.2, 4.3_

  - [x] 1.2 Add template markup inside the Notes SectionCard
    - Add `UButton` "Add Note" with `icon="i-lucide-plus"` — shown when `isInProgress && !showNoteForm`
    - Add inline form div — shown when `showNoteForm`
      - `UTextarea` bound to `noteText`, `:readonly="noteSaving"`, placeholder text
      - "Save" `UButton` — `:disabled` when `!noteText.trim()` or `noteSaving`, `:loading="noteSaving"`
      - "Cancel" `UButton` — `:disabled="noteSaving"`, on click: set `showNoteForm = false`, `noteText = ''`
    - Keep existing `<PartDetailNotes :serial-id="serialId" hide-heading />` below the form
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 4.1, 5.1, 5.2, 5.3_

- [x] 2. Checkpoint — Verify the add note form works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Write property-based tests for note creation
  - [x] 3.1 Write property test for Add Note button visibility
    - **Property 1: Add Note button visibility matches serial status**
    - **Validates: Requirements 1.1, 1.2**
    - Test file: `tests/properties/serialNoteAddButton.property.test.ts`
    - Generate random serial statuses (`in_progress`, `completed`, `scrapped`); verify button is visible only for `in_progress`

  - [x] 3.2 Write property test for Cancel resets form state
    - **Property 2: Cancel resets form state**
    - **Validates: Requirements 2.2**
    - Test file: `tests/properties/serialNoteCancel.property.test.ts`
    - Generate random strings; verify after cancel, form is hidden and textarea is empty

  - [x] 3.3 Write property test for button/form mutual exclusivity
    - **Property 3: Add Note button and form are mutually exclusive**
    - **Validates: Requirements 2.3**
    - Test file: `tests/properties/serialNoteFormExclusive.property.test.ts`
    - Generate random boolean `showNoteForm` states; verify button and form are never both visible

  - [x] 3.4 Write property test for note creation round trip
    - **Property 4: Note creation round trip**
    - **Validates: Requirements 3.1, 3.2**
    - Test file: `tests/properties/serialNoteRoundTrip.property.test.ts`
    - Generate valid non-whitespace strings; mock `createNote`; verify shared `notes` ref contains the new note with matching text, serialIds, and stepId

  - [x] 3.5 Write property test for whitespace-only text disables Save
    - **Property 5: Whitespace-only text disables Save**
    - **Validates: Requirements 4.1**
    - Test file: `tests/properties/serialNoteWhitespace.property.test.ts`
    - Generate whitespace-only strings (spaces, tabs, newlines); verify Save button is disabled

  - [x] 3.6 Write property test for error preserves form state
    - **Property 6: Error preserves form state**
    - **Validates: Requirements 4.3**
    - Test file: `tests/properties/serialNoteErrorPreserve.property.test.ts`
    - Generate valid note text and error responses; mock `createNote` to throw; verify form stays open with text preserved

  - [x] 3.7 Write property test for successful save resets form state
    - **Property 7: Successful save resets form state**
    - **Validates: Requirements 3.3**
    - Test file: `tests/properties/serialNoteSaveReset.property.test.ts`
    - Generate valid note text; mock `createNote` to succeed; verify form is hidden and textarea is empty

- [x] 4. Write unit tests for note creation UI
  - [x] 4.1 Write unit tests for form toggle, button rendering, toasts, and loading state
    - Test file: `tests/unit/components/serialNoteAdd.test.ts`
    - Test: clicking "Add Note" shows the form; clicking "Cancel" hides it (Req 2.1, 2.2)
    - Test: button renders with `i-lucide-plus` icon and "Add Note" label (Req 1.3)
    - Test: success toast after save (Req 3.4)
    - Test: error toast when createNote fails (Req 4.2)
    - Test: loading state — Save shows loading + disabled, Cancel disabled, textarea readonly (Req 5.1, 5.2, 5.3)
    - _Requirements: 1.3, 2.1, 2.2, 3.4, 4.2, 5.1, 5.2, 5.3_

- [x] 5. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1–7)
- Unit tests validate specific examples, edge cases, and loading/toast side effects
- This is a frontend-only change — only `app/pages/serials/[id].vue` is modified
- No new components or composable changes needed — `PartDetailNotes` and `useNotes` remain unchanged
- The shared module-level `notes` ref in `useNotes()` means `createNote` automatically updates the displayed list
