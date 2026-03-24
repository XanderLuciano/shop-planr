# Design Document: Serial Number Notes — Add Note

## Overview

This feature adds inline note creation to the Notes SectionCard on the serial detail page (`app/pages/serials/[id].vue`). Currently the Notes section only displays existing notes via `PartDetailNotes`. The change introduces an "Add Note" button (visible only for in-progress serials), an expandable inline form with a textarea and Save/Cancel buttons, and wires submission through the existing `useNotes().createNote()` composable. No backend changes are required — the existing `POST /api/notes` endpoint and `noteService` handle persistence.

### Design Decisions

1. **Inline form over modal**: Keeps the operator in context. The form appears directly inside the SectionCard, below the button and above the existing notes list.
2. **Modify the page, not the component**: The add-note UI lives in `[id].vue`'s Notes SectionCard slot, not inside `PartDetailNotes.vue`. This avoids coupling display-only component to write concerns and keeps `PartDetailNotes` reusable as a read-only viewer.
3. **Shared state via module-level ref**: `useNotes()` uses a module-level `notes` ref. When `createNote` succeeds it prepends the new note to this ref, so `PartDetailNotes` (which reads the same ref) automatically shows the new note — no explicit refresh call needed.
4. **Conditional visibility**: The "Add Note" button only renders when the serial is in-progress (`isInProgress` computed already exists on the page). Completed and scrapped serials get read-only notes.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  app/pages/serials/[id].vue                     │
│                                                 │
│  SectionCard "Notes"                            │
│  ├─ UButton "Add Note" (v-if isInProgress)      │
│  ├─ Inline form (v-if showNoteForm)             │
│  │   ├─ UTextarea (v-model noteText)            │
│  │   ├─ UButton "Save" → calls createNote()     │
│  │   └─ UButton "Cancel" → closes form          │
│  └─ <PartDetailNotes /> (reads shared notes ref)│
└──────────────────┬──────────────────────────────┘
                   │ createNote()
                   ▼
┌─────────────────────────────────────────────────┐
│  app/composables/useNotes.ts                    │
│  createNote({ jobId, pathId, stepId,            │
│               serialIds, text, userId })         │
│  → POST /api/notes                              │
│  → prepends result to module-level notes ref    │
└─────────────────────────────────────────────────┘
```

No new components are created. All UI additions are inline in the page's existing Notes SectionCard template slot.

## Components and Interfaces

### Modified: `app/pages/serials/[id].vue`

New local state added to `<script setup>`:

```typescript
const showNoteForm = ref(false)
const noteText = ref('')
const noteSaving = ref(false)
```

New function:

```typescript
async function handleSaveNote(): Promise<void>
```

- Guards: returns early if `noteText` is blank, or if `currentStep`, `job`, `path` are null
- Calls `createNote({ jobId, pathId, stepId, serialIds: [serialId], text, userId })`
- On success: closes form, clears text, shows success toast
- On error: shows error toast, keeps form open with text preserved

Template changes inside the Notes SectionCard:

1. `UButton` "Add Note" with `i-lucide-plus` icon — shown when `isInProgress && !showNoteForm`
2. Inline form div — shown when `showNoteForm`
   - `UTextarea` bound to `noteText`, `:readonly="noteSaving"`
   - "Save" `UButton` — `:disabled` when text is whitespace-only or `noteSaving`, `:loading="noteSaving"`
   - "Cancel" `UButton` — `:disabled="noteSaving"`
3. `PartDetailNotes` remains unchanged below

### Unchanged: `app/components/PartDetailNotes.vue`

No modifications. It reads from the shared `notes` ref in `useNotes()`, which `createNote` already updates on success.

### Unchanged: `app/composables/useNotes.ts`

No modifications. The existing `createNote` function handles the POST, error handling, and prepending the new note to the shared ref.

## Data Models

No new data models. The feature uses the existing `StepNote` domain type and the existing `POST /api/notes` API input shape:

```typescript
// Existing — server/types/domain.ts
interface StepNote {
  id: string
  jobId: string
  pathId: string
  stepId: string
  serialIds: string[]
  text: string
  createdBy: string
  createdAt: string
  pushedToJira: boolean
}

// Existing createNote input shape (useNotes.ts)
{
  jobId: string
  pathId: string
  stepId: string
  serialIds: string[]
  text: string
  userId: string
}
```

The page already has all required IDs available: `job.value.id`, `path.value.id`, `currentStep.value.id`, `serialId` (route param), and `operatorId` from `useOperatorIdentity()`.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Add Note button visibility matches serial status

*For any* serial number, the "Add Note" button should be visible if and only if the serial's status is in-progress. For completed or scrapped serials, the button must not be rendered.

**Validates: Requirements 1.1, 1.2**

### Property 2: Cancel resets form state

*For any* string entered in the note textarea, clicking "Cancel" should result in the form being hidden and the textarea content being empty.

**Validates: Requirements 2.2**

### Property 3: Add Note button and form are mutually exclusive

*For any* UI state, the "Add Note" button and the inline note form must never both be visible simultaneously. When the form is shown, the button is hidden, and vice versa.

**Validates: Requirements 2.3**

### Property 4: Note creation round trip

*For any* valid (non-whitespace) note text, after a successful `createNote` call, the shared `notes` ref should contain a note whose `text` matches the submitted text, whose `serialIds` includes the current serial ID, and whose `stepId` matches the current step.

**Validates: Requirements 3.1, 3.2**

### Property 5: Whitespace-only text disables Save

*For any* string composed entirely of whitespace characters (including the empty string), the "Save" button should be disabled and the form should not attempt submission.

**Validates: Requirements 4.1**

### Property 6: Error preserves form state

*For any* note text and any error response from the Note_Service, the form should remain open and the textarea should still contain the original text, allowing the operator to retry.

**Validates: Requirements 4.3**

### Property 7: Successful save resets form state

*For any* valid note text, after a successful `createNote` call, the form should be hidden and the textarea content should be empty.

**Validates: Requirements 3.3**

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `createNote` throws | Show error toast with `e?.data?.message ?? e?.message ?? 'Failed to create note'`. Form stays open, text preserved. `noteSaving` set to `false`. |
| `currentStep` is null (serial completed/scrapped) | "Add Note" button not rendered — form cannot be opened. |
| `operatorId` is null | Falls back to `'system'` as userId (matches existing `handleAdvance` pattern on the page). |
| Network timeout / 500 | Caught by the same try/catch — error toast shown, form preserved for retry. |

The error message extraction follows the same pattern already used in `useNotes.ts`: `e?.data?.message ?? e?.message ?? fallback`.

## Testing Strategy

### Unit Tests (Examples & Edge Cases)

Specific example-based tests using Vitest + happy-dom:

1. **Form toggle**: Clicking "Add Note" shows the form; clicking "Cancel" hides it (Req 2.1, 2.2)
2. **Button icon and label**: The button renders with `i-lucide-plus` icon and "Add Note" text (Req 1.3)
3. **Success toast**: After successful save, a success toast is displayed (Req 3.4)
4. **Error toast**: When createNote fails, an error toast with the error message is shown (Req 4.2)
5. **Loading state**: While saving, Save button shows loading + disabled, Cancel is disabled, textarea is readonly (Req 5.1, 5.2, 5.3)

### Property-Based Tests (Universal Properties)

Using `fast-check` with minimum 100 iterations per property. Each test references its design property.

| Property | Test Description | Generator |
|----------|-----------------|-----------|
| P1 | Button visibility vs serial status | `fc.oneof(fc.constant('in_progress'), fc.constant('completed'), fc.constant('scrapped'))` |
| P2 | Cancel clears any text | `fc.string({ minLength: 0, maxLength: 500 })` |
| P3 | Button/form mutual exclusivity | `fc.boolean()` (showNoteForm state) |
| P4 | Note round trip after create | `fc.string({ minLength: 1 }).filter(s => s.trim().length > 0)` |
| P5 | Whitespace disables Save | `fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'))` |
| P6 | Error preserves form text | `fc.string({ minLength: 1 }).filter(s => s.trim().length > 0)` |
| P7 | Success clears form | `fc.string({ minLength: 1 }).filter(s => s.trim().length > 0)` |

**PBT Library**: `fast-check` (already in project dependencies)

**Tag format**: `Feature: serial-number-notes-add, Property {N}: {title}`

Each correctness property is implemented by a single property-based test. Property tests verify universal behavior across randomized inputs; unit tests cover specific examples, integration points, and loading/toast side effects.
