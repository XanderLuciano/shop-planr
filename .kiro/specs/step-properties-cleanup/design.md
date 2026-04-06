# Design Document

## Introduction

GitHub Issue #109 — This design addresses one bug (partial save failure in `StepPropertiesEditor`) and three cleanup items (dead `onStepAssigned` function, orphaned `StepAssignmentDropdown.vue`, empty-string location values). All changes are scoped to four files plus one file deletion.

## Affected Files

| File | Change Type | Description |
|------|-------------|-------------|
| `app/components/StepPropertiesEditor.vue` | Modify | Refactor `handleSave()` to attempt both requests independently, report per-field failures, and always re-fetch on error |
| `server/api/steps/[id]/config.patch.ts` | Modify | Normalize empty/whitespace-only `location` to `undefined` before writing |
| `app/pages/jobs/[id].vue` | Modify | Remove dead `onStepAssigned` function |
| `app/components/StepAssignmentDropdown.vue` | Delete | Orphaned component with no remaining consumers |

## Change Details

### 1. Fix partial save in `StepPropertiesEditor.handleSave()` (Req 2.1, 2.2)

Current `handleSave()` runs two sequential `$fetch` calls inside a single try/catch. If the first succeeds and the second throws, the catch shows a generic toast and the UI never re-fetches.

The fix: attempt each changed field independently, collect per-field errors, then report results and always emit `saved` (which triggers the parent to re-fetch step data).

```typescript
async function handleSave() {
  const newAssignee = selectedOrNull(selectedUserId.value as string)
  const originalAssignee = props.currentAssignedTo ?? null
  const assigneeChanged = newAssignee !== originalAssignee

  const newLocation = selectedLocation.value
  const originalLocation = props.currentLocation ?? ''
  const locationChanged = newLocation !== originalLocation

  if (!assigneeChanged && !locationChanged) {
    emit('saved')
    return
  }

  saving.value = true
  const failures: string[] = []

  if (assigneeChanged) {
    try {
      await $fetch(`/api/steps/${props.stepId}/assign`, {
        method: 'PATCH',
        body: { userId: newAssignee },
      })
    } catch {
      failures.push('assignee')
    }
  }

  if (locationChanged) {
    try {
      await $fetch(`/api/steps/${props.stepId}/config`, {
        method: 'PATCH',
        body: { location: newLocation },
      })
    } catch {
      failures.push('location')
    }
  }

  if (failures.length) {
    toast.add({
      title: 'Partial save failure',
      description: `Failed to update: ${failures.join(', ')}. The page will refresh to show the current state.`,
      color: 'error',
    })
  } else {
    toast.add({
      title: 'Step updated',
      description: 'Step properties saved successfully.',
      color: 'success',
    })
  }

  saving.value = false
  // Always emit saved so the parent re-fetches, ensuring UI reflects actual DB state
  emit('saved')
}
```

Key decisions:
- Both requests are attempted independently — a failure in assignee does not block the location update.
- The toast names the specific field(s) that failed.
- `emit('saved')` always fires, which triggers the parent (`jobs/[id].vue`) to call `loadJob()` and re-fetch all step data. This ensures the UI reflects the actual persisted state even on partial failure.

### 2. Normalize empty location in API handler (Req 2.3)

In `server/api/steps/[id]/config.patch.ts`, add normalization after the `typeof` check:

```typescript
if (typeof body.location === 'string') {
  const trimmed = body.location.trim()
  update.location = trimmed === '' ? null : trimmed
}
```

This converts empty or whitespace-only strings to `null` so the DB stores NULL instead of `''`. Non-empty strings pass through unchanged (Req 3.3). The `optional` and `dependencyType` fields are untouched (Req 3.4).

### 3. Remove dead `onStepAssigned` function (Req 2.4)

Delete the entire `onStepAssigned` function from `app/pages/jobs/[id].vue` (lines ~114-121). No template binding references it — the `@assigned` event was removed from `StepTracker` in the step properties PR. The function body (`loadAllDistributions` + re-fetch paths) is already handled by `onStepConfigUpdated` and `loadJob`.

### 4. Delete orphaned `StepAssignmentDropdown.vue` (Req 2.5)

Delete `app/components/StepAssignmentDropdown.vue`. Confirmed no template references remain in the codebase. The property tests (`dropdownFilter.property.test.ts`, `stepAssignmentBugCondition.property.test.ts`, `stepAssignmentPreservation.property.test.ts`) duplicate the filter logic inline and do not import the component file, so they are unaffected (Req 3.6).

## Sequence Diagram — Fixed `handleSave()` Flow

```
User clicks Save
       │
       ▼
  assigneeChanged? ──yes──▶ PATCH /api/steps/:id/assign
       │                         │
       │                    success/fail → record result
       │                         │
       ▼                         ▼
  locationChanged? ──yes──▶ PATCH /api/steps/:id/config
       │                         │
       │                    success/fail → record result
       │                         │
       ▼                         ▼
  Any failures? ──yes──▶ Toast: "Failed to update: [fields]"
       │
       no──▶ Toast: "Step updated"
       │
       ▼
  emit('saved')  ──▶  Parent re-fetches step data
```

## Tasks

- [ ] 1. Refactor `handleSave()` in `app/components/StepPropertiesEditor.vue`
  - Replace single try/catch with independent per-field try/catch blocks
  - Collect failures into an array and report specific field names in the toast
  - Always emit `saved` at the end so the parent re-fetches
  - _Requirements: 2.1, 2.2, 3.1, 3.2_

- [ ] 2. Normalize empty location in `server/api/steps/[id]/config.patch.ts`
  - After the `typeof body.location === 'string'` check, trim the value
  - If trimmed string is empty, set `update.location = null` instead of the empty string
  - _Requirements: 2.3, 3.3, 3.4_

- [ ] 3. Remove dead `onStepAssigned` function from `app/pages/jobs/[id].vue`
  - Delete the `onStepAssigned` function definition (approx lines 114-121)
  - _Requirements: 2.4_

- [ ] 4. Delete orphaned `app/components/StepAssignmentDropdown.vue`
  - Remove the file entirely
  - Verify property tests still pass (they duplicate logic inline, no component import)
  - _Requirements: 2.5, 3.6_
