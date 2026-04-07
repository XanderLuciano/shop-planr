# Design: Step Properties Cleanup

## FR-1: Atomic step property save

### Current behavior

`StepPropertiesEditor.handleSave()` fires two sequential `$fetch` calls:
1. `PATCH /api/steps/:id/assign` (assignee)
2. `PATCH /api/steps/:id/config` (location)

If (1) succeeds and (2) throws, the catch block shows "Save failed" but the assignee is already persisted. `fetchStep()` only runs on success, so the UI shows stale data.

### Solution

After any error in `handleSave()`, call `fetchStep()` (via a new `error` event or by re-fetching in the parent) so the UI reflects the actual server state. Additionally, surface which field failed in the toast message.

Changes:
- `app/components/StepPropertiesEditor.vue` — wrap each PATCH in its own try/catch, track which succeeded, and on partial failure: emit `saved` (to trigger re-fetch) and show a toast naming the failed field.
- `app/pages/parts/step/[stepId].vue` — no change needed; `@saved` already calls `fetchStep()`.

### Why not a single endpoint?

A combined endpoint would require a new API route and service method. The two existing endpoints are well-tested and used elsewhere. The re-fetch-on-error approach is simpler and keeps the API surface stable.

## FR-2: Normalize empty location to NULL

### Change

In `server/api/steps/[id]/config.patch.ts`, after reading `body.location`, trim and convert empty string to `undefined` before adding to the update object:

```ts
if (typeof body.location === 'string') {
  const trimmed = body.location.trim()
  update.location = trimmed || undefined
}
```

This ensures `updateStep` receives `undefined` for empty locations, which the repository maps to `NULL` via `updated.location ?? null`.

## CR-1: Remove dead `onStepAssigned`

Delete the `onStepAssigned` function (~lines 114-121) from `app/pages/jobs/[id].vue`. No other code references it.

## CR-2: Delete orphaned `StepAssignmentDropdown.vue`

Delete `app/components/StepAssignmentDropdown.vue`. Check for and delete any dedicated test file (e.g., `tests/unit/components/StepAssignmentDropdown.test.ts` or property tests referencing it).

## CR-3: Fix lint errors

- `AddNoteDialog.vue:90` — Replace `catch (e: any)` with `catch (e: unknown)` and use a type-safe error message extraction.
- `StepPropertiesEditor.vue:81` — Same pattern: `catch (e: unknown)`.
- `jobs/[id].vue:114` — Resolved by CR-1 (removing the unused function).

## Files changed

| File | Change |
|---|---|
| `app/components/StepPropertiesEditor.vue` | Partial-save resilience + lint fix |
| `app/components/AddNoteDialog.vue` | Lint fix (no-explicit-any) |
| `app/pages/jobs/[id].vue` | Remove dead `onStepAssigned` |
| `app/components/StepAssignmentDropdown.vue` | Delete file |
| `server/api/steps/[id]/config.patch.ts` | Normalize empty location |
| Related test files for StepAssignmentDropdown | Delete if present |
