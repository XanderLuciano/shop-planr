# Design Document: First Step Serial Creation

## Overview

This feature introduces a `SerialCreationPanel` component that replaces the standard `ProcessAdvancementPanel` when an operator views a first step (stepOrder === 0) in the work queue. The first step in a manufacturing process represents cutting raw material — there are no incoming parts to "receive," only new parts to create. The panel lets operators spawn batches of serial numbers, view all accumulated serials at the step, select some or all, and advance them to the next step when ready. A combined "Create & Advance" shortcut supports quick-turnaround workflows.

No new backend API routes are needed. The panel reuses:
- `POST /api/serials` — batch serial creation (via `useSerials().batchCreateSerials()`)
- `POST /api/serials/[id]/advance` — sequential advancement (via `useWorkQueue().advanceBatch()`)
- `POST /api/notes` — step notes (via `useWorkQueue().advanceBatch()` note handling)

The operator page (`operator.vue`) conditionally renders `SerialCreationPanel` instead of `ProcessAdvancementPanel` when the selected job's `stepOrder === 0`. The serial detail page (`serials/[id].vue`) continues using `ProcessAdvancementPanel` for single-serial advancement at step 0 — no changes there.

## Architecture

The change is confined to the UI layer. One new component is added; the operator page gains a conditional branch.

```
┌─────────────────────────────────────────────────────────┐
│  app/pages/operator.vue                                 │
│                                                         │
│  selectedJob.stepOrder === 0?                           │
│    ├─ YES → SerialCreationPanel (NEW)                   │
│    │         ├─ useSerials().batchCreateSerials()        │
│    │         ├─ useWorkQueue().advanceBatch()            │
│    │         └─ refreshes queue after create/advance     │
│    └─ NO  → ProcessAdvancementPanel (existing)          │
└─────────────────────────────────────────────────────────┘
```

Dependency flow (left-to-right, no layer skipping):

```
SerialCreationPanel → useSerials composable → POST /api/serials → serialService
                    → useWorkQueue composable → POST /api/serials/[id]/advance → serialService
                                              → POST /api/notes → noteService
```

### Design Decisions

1. **Single new component, not a mode flag on ProcessAdvancementPanel**: The creation-point workflow is fundamentally different from advancement-only (it has a quantity input for spawning, accumulated serial list, create & advance shortcut). Bolting this onto ProcessAdvancementPanel would bloat it. A dedicated `SerialCreationPanel` keeps both components focused.

2. **Reuse `useWorkQueue().advanceBatch()` for advancement**: The existing `advanceBatch` already handles iterating over serial IDs, posting notes, and re-fetching the queue. The creation panel calls it directly after selecting serials, avoiding duplicated advancement logic.

3. **Reuse `useSerials().batchCreateSerials()` for creation**: The existing composable already wraps `POST /api/serials`. No new composable needed.

4. **Queue re-fetch after creation**: After creating a batch, the panel calls `fetchQueue()` to refresh the work queue data. This ensures the accumulated serials list (derived from `WorkQueueJob.serialIds`) reflects the new serials. This is simpler than optimistically merging IDs client-side.

5. **No changes to serial detail page**: Requirement 9 explicitly states the detail page continues using `ProcessAdvancementPanel` for single-serial advancement at step 0. The creation workflow is operator-page-only.

6. **Advancement destination derived from WorkQueueJob**: The `nextStepName`, `nextStepLocation`, and `isFinalStep` fields already exist on `WorkQueueJob`. No additional API call needed to show where parts will go.

## Components and Interfaces

### New Component: `SerialCreationPanel`

**File:** `app/components/SerialCreationPanel.vue`

**Purpose:** Combined serial creation + selection + advancement panel for first-step work queue jobs.

```typescript
// Props
interface SerialCreationPanelProps {
  job: WorkQueueJob       // The first-step work queue job
  loading: boolean        // External loading state for advancement
}

// Emits
interface SerialCreationPanelEmits {
  advance: [payload: { serialIds: string[], note?: string }]
  cancel: []
  created: [count: number]  // Emitted after successful batch creation
}
```

**Internal state:**
- `quantity: ref<number>` — batch size input, defaults to 1
- `creating: ref<boolean>` — loading state for creation API call
- `selectedSerials: ref<Set<string>>` — checked serial IDs for advancement
- `note: ref<string>` — optional note text for advancement
- `validationError: ref<string | null>` — quantity validation message
- `successMessage: ref<string | null>` — transient success feedback
- `errorMessage: ref<string | null>` — creation/advancement error feedback

**Key behaviors:**
- Calls `useSerials().batchCreateSerials()` with `{ jobId, pathId, quantity, userId }` on "Create" action
- After successful creation, calls `useWorkQueue().fetchQueue(userId)` to refresh, then emits `created`
- "Create & Advance" action: creates batch, then immediately emits `advance` with the newly created serial IDs
- Advancement selection uses checkboxes on `job.serialIds` (accumulated serials)
- Select All / Select None controls
- Advance button emits `advance` with selected IDs and optional note
- Advance button disabled when no serials selected

**Template sections (top to bottom):**
1. Header — job name, path name, step name, step location
2. Destination info — next step name + location (or "Completed" if final)
3. Creation form — quantity input + "Create" button + "Create & Advance" button
4. Success/error messages (transient)
5. Accumulated serials list — checkboxes, serial IDs, select all/none, count display
6. Empty state — shown when no accumulated serials exist
7. Note input — optional textarea with character count (1000 max)
8. Advance action — button with selected count, disabled when none selected

### Modified Page: `operator.vue`

**File:** `app/pages/operator.vue`

**Change:** Add conditional rendering in the template. When `selectedJob.stepOrder === 0`, render `SerialCreationPanel` instead of `ProcessAdvancementPanel`.

The `handleAdvance` function already handles the advancement flow. A new `handleCreated` function re-fetches the queue after batch creation (the panel handles this internally, but the page may want to update toast notifications).

```typescript
// New handler in operator.vue
async function handleCreated(count: number) {
  toast.add({
    title: 'Serials created',
    description: `${count} serial number${count !== 1 ? 's' : ''} created`,
    color: 'success',
  })
}
```

**Template change:**
```vue
<!-- Replace single ProcessAdvancementPanel with conditional -->
<SerialCreationPanel
  v-if="selectedJob && selectedJob.stepOrder === 0"
  :job="selectedJob"
  :loading="advanceLoading"
  @advance="handleAdvance"
  @cancel="handleCancelJob"
  @created="handleCreated"
/>
<ProcessAdvancementPanel
  v-else-if="selectedJob"
  :job="selectedJob"
  :loading="advanceLoading"
  :notes="stepNotes"
  @advance="handleAdvance"
  @cancel="handleCancelJob"
/>
```

### Unchanged: `serials/[id].vue`

No modifications. The serial detail page continues using `ProcessAdvancementPanel` for single-serial advancement at step 0 (Requirement 9).

### Unchanged: Composables

- `useSerials()` — already has `batchCreateSerials()` and `advanceSerial()`
- `useWorkQueue()` — already has `fetchQueue()` and `advanceBatch()`
- No new composables needed

### Unchanged: API Routes and Services

- `POST /api/serials` — `serialService.batchCreateSerials()` already creates at `currentStepIndex: 0`
- `POST /api/serials/[id]/advance` — `serialService.advanceSerial()` already handles sequential advance
- `POST /api/notes` — `noteService` already handles step notes
- No backend changes needed

## Data Models

No data model changes. All existing types are sufficient:

- **`WorkQueueJob`** — already has `stepOrder`, `serialIds`, `nextStepName`, `nextStepLocation`, `isFinalStep`, `jobId`, `pathId`, `stepId`. The `stepOrder` field is the key discriminator for first-step detection.
- **`BatchCreateSerialsInput`** — already has `jobId`, `pathId`, `quantity`, `certId?`. Used by the creation form.
- **`SerialNumber`** — returned by `batchCreateSerials()`. The panel uses the returned IDs for the "Create & Advance" flow.

No new API types, domain types, or computed types are needed.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Panel type selection based on step order

*For any* `WorkQueueJob`, if `stepOrder === 0` then the operator page shall render `SerialCreationPanel`; otherwise it shall render `ProcessAdvancementPanel`. The two panels are mutually exclusive — exactly one is rendered for any selected job.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Context display contains job, path, and step names

*For any* `WorkQueueJob` passed to `SerialCreationPanel`, the rendered output shall contain the `jobName`, `pathName`, and `stepName` strings from the job object.

**Validates: Requirements 2.2**

### Property 3: Accumulated serials rendering and count

*For any* `WorkQueueJob` with `serialIds` of length N (where N ≥ 1), the `SerialCreationPanel` shall render all N serial identifiers in the accumulated list, and shall display the total count as N. When N = 0, an empty state message shall be displayed instead.

**Validates: Requirements 3.1, 3.3, 3.4, 3.5**

### Property 4: Invalid quantity rejection

*For any* integer quantity less than 1 (including 0 and negative numbers), the `SerialCreationPanel` shall display a validation error and the creation submit controls shall be disabled, preventing the API call.

**Validates: Requirements 2.7**

### Property 5: Selection state drives advance payload and button state

*For any* set of accumulated serial IDs and any subset selection of size K: the advance action shall emit exactly the K selected IDs in its payload; the displayed selected count shall equal K; and when K = 0, the advance button shall be disabled.

**Validates: Requirements 4.4, 4.5, 4.8**

### Property 6: Destination display matches WorkQueueJob fields

*For any* `WorkQueueJob`: if `isFinalStep` is true, the destination shall display "Completed"; if `nextStepLocation` is defined, the destination shall include both `nextStepName` and `nextStepLocation`; otherwise the destination shall display `nextStepName` alone.

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 7: Note character count and limit enforcement

*For any* note text of length L entered in the `SerialCreationPanel`, the displayed character count shall equal L, and the maximum allowed length shall be 1000 characters.

**Validates: Requirements 8.3, 8.4**

### Property 8: Loading states disable corresponding controls

*For any* state where the creation request is in progress (`creating` is true), the creation submit controls shall be disabled and show a loading indicator. *For any* state where the advancement request is in progress (`loading` prop is true), the advance controls shall be disabled and show a loading indicator.

**Validates: Requirements 10.1, 10.2**

## Error Handling

### Creation Errors

When `batchCreateSerials()` throws (e.g., invalid path, server error), the panel catches the error and displays the error message in an inline error banner. The creation form remains available for retry. The accumulated serials list is not affected.

### Advancement Errors

When `advanceBatch()` throws during normal advancement, the parent (`operator.vue`) catches the error and shows an error toast. The panel's selection state is preserved so the operator can retry.

### Create & Advance Partial Failure

When the "Create & Advance" flow succeeds at creation but fails during advancement:
1. The created serials are already persisted (creation succeeded).
2. The panel displays an error message identifying the failure.
3. The queue is re-fetched, so the newly created serials appear in the accumulated list.
4. The operator can then select them and retry advancement manually.

### Validation Errors

- Quantity < 1: inline validation error, submit disabled. No API call made.
- Note > 1000 characters: enforced by `maxlength` attribute on the textarea. The character counter shows the current length.

### Network/Loading States

- Creation loading: `creating` ref controls the create button's loading/disabled state.
- Advancement loading: `loading` prop (from parent) controls the advance button's loading/disabled state.
- Queue loading: handled by the parent page's existing loading state. The panel only renders when a job is available.

## Testing Strategy

### Dual Testing Approach

This feature uses both unit tests and property-based tests:

- **Property-based tests** verify universal properties (panel selection, serial rendering, selection state, destination display) across randomly generated `WorkQueueJob` objects using `fast-check`.
- **Unit tests** verify specific examples, edge cases, and integration behaviors (create & advance flow, error display, empty state, default quantity).

### Property-Based Testing

**Library:** `fast-check` (already in the project)

**Configuration:** Minimum 100 iterations per property test.

**Tag format:** Each test is tagged with a comment: `Feature: first-step-serial-creation, Property {N}: {title}`

Each correctness property maps to a single property-based test:

| Property | Test Description |
|----------|-----------------|
| 1 | Generate random WorkQueueJob with varying stepOrder; assert panel type selection |
| 2 | Generate random job/path/step names; assert all appear in rendered output |
| 3 | Generate random serialIds arrays (0 to N); assert all IDs rendered and count matches |
| 4 | Generate random integers < 1; assert validation error shown and submit disabled |
| 5 | Generate random serialIds and random subsets; assert advance payload and button state |
| 6 | Generate random WorkQueueJob with varying isFinalStep/nextStepName/nextStepLocation; assert destination text |
| 7 | Generate random strings of varying length; assert character count display |
| 8 | Generate random boolean states for creating/loading; assert button disabled states |

**Test file:** `tests/properties/firstStepSerialCreation.property.test.ts`

### Unit Tests

**Test file:** `tests/unit/components/SerialCreationPanel.test.ts`

Unit tests cover:
- Default quantity is 1 (Req 2.6)
- Create button calls batchCreateSerials with correct parameters (Req 2.3)
- Success message appears after creation (Req 2.4)
- Error message appears on creation failure (Req 2.5)
- Empty state shown when no serials exist (Req 3.5)
- Select All selects all serials (Req 4.2)
- Select None deselects all serials (Req 4.3)
- Create & Advance button exists and triggers both operations (Req 6.1, 6.2)
- Create & Advance success message includes count and destination (Req 6.3)
- Partial failure during create & advance shows error and preserves created serials (Req 6.4)
- Note textarea exists with placeholder text (Req 8.1)
- Creation form remains available after batch creation (Req 5.2)

### What NOT to Test

- Backend API behavior (already covered by existing service tests)
- `useSerials` and `useWorkQueue` composable internals (already tested)
- Serial detail page behavior at step 0 (no changes made — Req 9)
- Queue loading/error states (handled by parent page, already tested)
- CSS styling and visual layout
