# Requirements: Step Properties Cleanup

## Context

Code review of commits `fff4eca` (#108 — edit step properties) and `e54ceed` (#107 — add note to parts) found one bug, three dead-code items, and three lint errors.

## Functional Requirements

1. **FR-1: Atomic step property save** — When both assignee and location are changed in `StepPropertiesEditor`, a failure in one PATCH must not leave the other silently persisted. The user must see accurate feedback and the UI must reflect the actual server state.

2. **FR-2: Normalize empty location to NULL** — `PATCH /api/steps/:id/config` must treat empty/whitespace-only `location` strings as `null` so the DB stays consistent with the existing convention (NULL = no location).

## Cleanup Requirements

3. **CR-1: Remove dead `onStepAssigned`** — Delete the unreachable `onStepAssigned` function from `app/pages/jobs/[id].vue`.

4. **CR-2: Delete orphaned `StepAssignmentDropdown.vue`** — Remove `app/components/StepAssignmentDropdown.vue` and any related test files. No template references remain.

5. **CR-3: Fix lint errors** — Resolve the three ESLint errors:
   - `app/components/AddNoteDialog.vue:90` — `@typescript-eslint/no-explicit-any`
   - `app/components/StepPropertiesEditor.vue:81` — `@typescript-eslint/no-explicit-any`
   - `app/pages/jobs/[id].vue:114` — `no-unused-vars` (covered by CR-1)
