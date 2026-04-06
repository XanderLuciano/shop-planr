# Implementation Plan: Edit Step Properties

## Overview

Implement editing of step properties (assignee and location) from three surfaces: inline edit mode on the Step View page, an Assignee column in the Job create/edit form's step grid, and an Assignee dropdown in the Job Detail inline path editor. Step tracker cards display assignee as static text. Backend changes extend `StepInput` (with `string | null` for clearing), `reconcileSteps()`, `createPath()`, the config endpoint, and the SQLite repository to support these flows.

## Tasks

- [x] 1. Extend backend types and services
  - [x] 1.1 Add `assignedTo` field to `StepInput` in `server/types/domain.ts`
    - Add `assignedTo?: string | null` to the `StepInput` interface (undefined = preserve, null = clear, string = set)
    - _Requirements: 7.1_

  - [x] 1.2 Update `reconcileSteps()` in `server/services/pathService.ts` to accept `assignedTo` from input
    - For `toUpdate`: use `input.assignedTo ?? existing.assignedTo` instead of always preserving `existing.assignedTo`
    - For `toInsert`: include `input.assignedTo` on newly created steps
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 1.3 Extend `PATCH /api/steps/:id/config` to accept `location` field
    - In `server/api/steps/[id]/config.patch.ts`, add handling for `body.location` (type string) in the update object
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 1.4 Write unit tests for `reconcileSteps()` assignedTo handling
    - Test: input with `assignedTo` + existing step → uses input value
    - Test: input without `assignedTo` + existing step → preserves existing value
    - Test: new step with `assignedTo` → included in insert
    - Test: new step without `assignedTo` → no `assignedTo` on insert
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 1.5 Write unit test for config endpoint accepting `location`
    - Test: PATCH with `{ location: 'Bay 3' }` passes location to `pathService.updateStep`
    - Test: PATCH without `location` does not modify existing location
    - _Requirements: 5.1, 5.2_

- [x] 2. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Extend `useJobForm` composable for assignee support
  - [x] 3.1 Add `assignedTo` to `StepDraft` interface and `createStepDraft()` helper
    - Add `assignedTo: string` to `StepDraft` (default `''`)
    - Update `createStepDraft()` to include `assignedTo: overrides?.assignedTo ?? ''`
    - _Requirements: 6.3, 6.4_

  - [x] 3.2 Update `hasPathChanges()` to compare `assignedTo`
    - Add `if ((s.assignedTo?.trim() || '') !== (o.assignedTo || '')) return true` to the step diff loop
    - _Requirements: 9.1, 9.2_

  - [x] 3.3 Update edit mode hydration to populate `assignedTo` from existing steps
    - In the `pathDrafts` initialization for edit mode, map `s.assignedTo ?? ''` into `createStepDraft()`
    - _Requirements: 10.1, 10.2_

  - [x] 3.4 Update submit payloads (create and edit) to include `assignedTo`
    - In both `submitCreate()` and `submitEdit()`, add `assignedTo: s.assignedTo || undefined` to the step payload
    - Map empty string to `undefined` so unassigned steps omit the field
    - _Requirements: 7.2, 7.3_

  - [x] 3.5 Write unit tests for `useJobForm` assignee changes
    - Test: `hasPathChanges` returns true when `assignedTo` differs
    - Test: `hasPathChanges` returns false when `assignedTo` matches
    - Test: `createStepDraft()` defaults `assignedTo` to `''`
    - Test: edit mode hydration populates `assignedTo` from existing step
    - _Requirements: 9.1, 9.2, 6.4, 10.1, 10.2_

- [x] 4. Add Assignee column to `JobCreationForm.vue`
  - [x] 4.1 Add Assignee column header and dropdown to the step grid
    - Update grid template from 7-column to 8-column layout: `grid-cols-[2rem_1fr_1fr_1fr_5rem_9rem_4.5rem_2rem]`
    - Add "Assignee" header label between Location and Optional
    - Add `USelect` dropdown per step row bound to `step.assignedTo`, populated from `useUsers()` active users
    - Include an unassigned placeholder option (using sentinel value pattern per Known Quirks)
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Create `StepPropertiesEditor` component for Step View page
  - [x] 6.1 Create `app/components/StepPropertiesEditor.vue`
    - Props: `stepId`, `currentAssignedTo?`, `currentLocation?`
    - Emits: `saved`, `cancel`
    - Render assignee dropdown (from `useOperatorIdentity().activeUsers`) and location dropdown (from `useLibrary().locations`)
    - Include save and cancel buttons with loading state
    - On save: PATCH `/api/steps/:id/assign` if assignee changed, PATCH `/api/steps/:id/config` if location changed
    - Show toast on success/error
    - _Requirements: 1.2, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 11.1, 11.2, 11.3, 11.4_

- [x] 7. Integrate `StepPropertiesEditor` into Step View page
  - [x] 7.1 Add edit mode toggle and `StepPropertiesEditor` to `app/pages/parts/step/[stepId].vue`
    - Add `editing` ref to toggle edit mode
    - Add edit (pencil) icon button next to step name in the header
    - When `editing` is true, render `StepPropertiesEditor` in place of static assignee/location display
    - On `saved` emit: set `editing = false`, call `fetchStep()` to refresh
    - On `cancel` emit: set `editing = false`
    - Display assignee name in the header when not editing (resolve user ID to display name)
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 13.1, 13.2_

  - [x] 7.2 Write unit tests for `StepPropertiesEditor`
    - Test: renders assignee and location dropdowns
    - Test: emits `cancel` when cancel button clicked
    - Test: skips assignee PATCH when assignee unchanged
    - Test: skips location PATCH when location unchanged
    - _Requirements: 2.3, 3.3, 4.1, 4.2_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Post-review fixes
  - [x] 9.1 Widen `StepInput.assignedTo` to `string | null` for explicit clearing
    - `undefined` = preserve existing, `null` = clear assignment, `string` = set
    - Updated `reconcileSteps()` to use `input.assignedTo !== undefined` check
    - _Requirements: 7.1, 8.2, 8.3_

  - [x] 9.2 Fix `createPath()` to include `assignedTo` in step mapping
    - Added `assignedTo: s.assignedTo ?? undefined` to the step builder in `createPath()`
    - _Requirements: 16.1_

  - [x] 9.3 Fix SQLite repository to persist `assigned_to` in step INSERT/UPDATE
    - Updated both `create()` and `update()` step INSERT statements to include `assigned_to`
    - Updated `update()` step UPDATE statement to include `assigned_to`
    - _Requirements: 16.2, 16.3_

  - [x] 9.4 Fix `useJobForm` edit payload to send `null` for clearing
    - Existing steps with empty assignee send `null` (clear), new steps send `undefined` (omit)
    - _Requirements: 7.3_

  - [x] 9.5 Move reconcileSteps assignedTo tests to dedicated test file
    - Moved from `pathService.test.ts` to `reconcileSteps.test.ts`
    - Added test for explicit null clearing

- [x] 10. Add Assignee dropdown to `PathEditor.vue`
  - [x] 10.1 Add `assignedTo` to PathEditor's StepDraft and step grid
    - Added `assignedTo: string` to local StepDraft, hydration from existing steps
    - Added `USelect` dropdown with sentinel pattern between Location and Opt
    - Included `assignedTo` in save payload with null/undefined clearing semantics
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 11. Replace StepTracker dropdowns with static assignee text
  - [x] 11.1 Remove `StepAssignmentDropdown` from StepTracker step cards
    - Replaced with static text showing resolved user name or "Unassigned"
    - Removed `assigned` emit from StepTracker
    - Removed `@assigned` listener from Job Detail page
    - _Requirements: 15.1, 15.2, 15.3_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The design uses TypeScript and Vue throughout — no language selection needed
- Per Known Quirks: `USelect` items must never have `value: ''` — use a sentinel for the unassigned placeholder
- Existing `pathService.assignStep()` and `pathService.updateStep()` already handle the DB writes; this feature wires them into new UI surfaces
