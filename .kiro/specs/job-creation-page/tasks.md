# Implementation Plan: Job Creation Page

## Overview

Replace the inline "New Job" form with a dedicated full-page experience at `/jobs/new` and `/jobs/[id]/edit`. Backend changes come first (API types, service, route), then the composable, then the component, then the pages, then tests, then integration/cleanup. All code is TypeScript/Vue 3 (Nuxt 4).

## Tasks

- [x] 1. Extend backend API types and path service
  - [x] 1.1 Extend `CreatePathInput` and `UpdatePathInput` in `server/types/api.ts`
    - Add `optional?: boolean`, `dependencyType?: 'physical' | 'preferred' | 'completion_gate'` to the `steps` array items in both interfaces
    - Add `advancementMode?: 'strict' | 'flexible' | 'per_step'` to both `CreatePathInput` and `UpdatePathInput`
    - _Requirements: 6.1, 6.2, 7.1, 7.2, 9.1, 9.2_

  - [x] 1.2 Update `pathService.createPath` and `pathService.updatePath` in `server/services/pathService.ts`
    - Read `optional`, `dependencyType`, and `advancementMode` from input and map them into the `ProcessStep` / `Path` objects
    - Default `optional` to `false`, `dependencyType` to `'preferred'`, `advancementMode` to `'strict'` when not provided
    - _Requirements: 6.2, 7.2, 9.2_

  - [x] 1.3 Add `deletePath` method to `pathService`
    - Validate path exists, check no serials are attached (via `repos.serials.countByPathId` or equivalent), then call `repos.paths.delete(id)`
    - Throw `ValidationError` if serials exist on the path
    - _Requirements: 13.3_

  - [x] 1.4 Add `server/api/paths/[id].delete.ts` API route
    - Thin handler calling `getServices().pathService.deletePath(id)` with standard error handling pattern
    - _Requirements: 13.3_

- [x] 2. Checkpoint — Ensure backend changes compile and existing tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add `deletePath` to `usePaths` composable and create `useJobForm` composable
  - [x] 3.1 Add `deletePath(id: string)` to `app/composables/usePaths.ts`
    - Send `DELETE /api/paths/:id` request
    - _Requirements: 13.3_

  - [x] 3.2 Create `app/composables/useJobForm.ts`
    - Implement `StepDraft`, `PathDraft`, `JobDraft`, `ValidationError`, `ValidationResult` interfaces
    - Implement `useJobForm(mode, existingJob?)` returning: `jobDraft`, `pathDrafts`, `errors`, `submitting`, `submitError`
    - Implement path operations: `addPath()`, `removePath(clientId)`
    - Implement step operations: `addStep(pathClientId)`, `removeStep(pathClientId, stepClientId)`, `moveStep(pathClientId, stepClientId, direction)`
    - Implement `applyTemplate(pathClientId, template)` — replaces steps from TemplateRoute
    - Implement `validate()` — checks all validation rules from design (empty names, quantities < 1, paths with zero steps)
    - Implement `submit()` — create mode: createJob then createPath for each draft; edit mode: diff paths (delete/update/create)
    - Implement `getFieldError(field)` and `clearFieldError(field)` helpers
    - Use `nanoid` for `_clientId` generation
    - Edit mode initialization: populate drafts from existing job + paths
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.3, 4.4, 4.5, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3, 10.1, 10.2, 10.3, 11.1, 11.2, 11.3, 12.1, 12.2, 12.3, 12.4, 13.1, 13.2, 13.3, 13.4, 13.5, 14.1, 14.4_

  - [x] 3.3 Write property test: Edit mode initialization round-trip
    - **Property 1: Edit mode initialization round-trip**
    - **Validates: Requirements 1.2, 2.5, 3.7, 6.3, 7.3, 8.3, 9.3, 10.3**
    - Test file: `tests/properties/jobFormEditRoundTrip.property.test.ts`

  - [x] 3.4 Write property test: Validation rejects empty/whitespace names
    - **Property 2: Validation rejects empty/whitespace names**
    - **Validates: Requirements 2.3, 3.4, 4.4**
    - Test file: `tests/properties/jobFormEmptyNames.property.test.ts`

  - [x] 3.5 Write property test: Validation rejects invalid goal quantities
    - **Property 3: Validation rejects invalid goal quantities**
    - **Validates: Requirements 2.4, 3.5**
    - Test file: `tests/properties/jobFormInvalidQuantities.property.test.ts`

  - [x] 3.6 Write property test: addPath produces correct defaults
    - **Property 4: addPath produces correct defaults**
    - **Validates: Requirements 3.1, 6.2, 7.2, 9.2, 10.2**
    - Test file: `tests/properties/jobFormAddPath.property.test.ts`

  - [x] 3.7 Write property test: removePath removes exactly one path
    - **Property 5: removePath removes exactly one path**
    - **Validates: Requirements 3.6**
    - Test file: `tests/properties/jobFormRemovePath.property.test.ts`

  - [x] 3.8 Write property test: Validation rejects paths with zero steps
    - **Property 6: Validation rejects paths with zero steps**
    - **Validates: Requirements 4.3**
    - Test file: `tests/properties/jobFormZeroSteps.property.test.ts`

  - [x] 3.9 Write property test: removeStep enforces minimum-one constraint
    - **Property 7: removeStep enforces minimum-one constraint**
    - **Validates: Requirements 4.5**
    - Test file: `tests/properties/jobFormRemoveStep.property.test.ts`

  - [x] 3.10 Write property test: moveStep is a valid swap permutation
    - **Property 8: moveStep is a valid swap permutation**
    - **Validates: Requirements 5.3, 5.4, 5.5**
    - Test file: `tests/properties/jobFormMoveStep.property.test.ts`

  - [x] 3.11 Write property test: Template application faithfully maps template steps
    - **Property 9: Template application faithfully maps template steps**
    - **Validates: Requirements 11.2, 11.3**
    - Test file: `tests/properties/jobFormTemplateApply.property.test.ts`

  - [x] 3.12 Write property test: Edit diff correctly classifies path changes
    - **Property 10: Edit diff correctly classifies path changes**
    - **Validates: Requirements 13.1, 13.2, 13.3**
    - Test file: `tests/properties/jobFormEditDiff.property.test.ts`

  - [x] 3.13 Write property test: Error clearing on field correction
    - **Property 11: Error clearing on field correction**
    - **Validates: Requirements 14.4**
    - Test file: `tests/properties/jobFormErrorClearing.property.test.ts`

- [x] 4. Checkpoint — Ensure composable compiles and property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create `JobCreationForm` component
  - [x] 5.1 Create `app/components/JobCreationForm.vue`
    - Accept props: `mode: 'create' | 'edit'`, `existingJob?: Job & { paths: Path[] }`
    - Emit: `saved(jobId)`, `cancel()`
    - Render job-level fields (name input, goal quantity input)
    - Render list of PathDraft cards, each with: path name, path goal quantity, advancement mode dropdown, step rows, add/remove step controls, move step controls, apply template control
    - Each step row: ProcessLocationDropdown for name, ProcessLocationDropdown for location, optional checkbox, dependency type dropdown, move up/down buttons, remove button
    - Render submit and cancel buttons with loading/disabled state during submission
    - Display inline validation errors from `useJobForm`
    - Display `submitError` as a banner/alert
    - Scroll to first error on validation failure
    - Reuse existing components: `ProcessLocationDropdown`, `UInput`, `USelect`, `UButton`, `UIcon`, `UBadge`
    - _Requirements: 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 7.1, 7.2, 8.1, 8.2, 9.1, 9.2, 10.1, 10.2, 11.1, 11.2, 11.3, 11.4, 12.3, 12.4, 13.5, 14.2, 14.3, 14.4_

- [x] 6. Create pages and update navigation
  - [x] 6.1 Create `app/pages/jobs/new.vue`
    - Render `<JobCreationForm mode="create" />` with back link to `/jobs`
    - Handle `saved` event by navigating to `/jobs/:id`
    - Handle `cancel` event by navigating to `/jobs`
    - _Requirements: 1.1, 1.4, 12.2_

  - [x] 6.2 Create `app/pages/jobs/[id]/edit.vue`
    - Fetch existing job + paths on mount, show loading/error states
    - If job not found, display error with link back to `/jobs`
    - Render `<JobCreationForm mode="edit" :existing-job="jobWithPaths" />` once loaded
    - Handle `saved` event by navigating to `/jobs/:id`
    - Handle `cancel` event by navigating to `/jobs/:id`
    - _Requirements: 1.2, 1.3, 1.4, 13.4_

  - [x] 6.3 Update `app/pages/jobs/index.vue` to navigate to `/jobs/new`
    - Replace the inline `showNewJobForm` toggle and `<JobForm>` with a `<NuxtLink>` or `<UButton>` that navigates to `/jobs/new`
    - Remove the `onCreateJob` function and related refs (`showNewJobForm`, `createJobSaving`, `createJobError`)
    - _Requirements: 1.1_

  - [x] 6.4 Update `app/pages/jobs/[id].vue` to add "Edit" link to `/jobs/[id]/edit`
    - Add a link/button in the job header that navigates to the edit page
    - _Requirements: 1.2_

- [x] 7. Checkpoint — Ensure all pages render, navigation works, and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Final integration and cleanup
  - [x] 8.1 Write unit tests for `useJobForm` composable
    - Test create mode initializes with correct empty state (Req 1.1)
    - Test submit in create mode calls createJob then createPath sequentially (Req 12.1)
    - Test submit navigates to job detail on success (Req 12.2)
    - Test submit shows error and preserves form on failure (Req 12.3)
    - Test edit submit with path deletion, update, and creation (Req 13.1, 13.2, 13.3)
    - Test validation runs before any API calls (Req 14.1)
    - Test file: `tests/unit/composables/useJobForm.test.ts`

  - [x] 8.2 Write unit tests for `deletePath` service method
    - Test successful deletion when no serials exist
    - Test rejection when serials are attached to the path
    - Test not-found error for non-existent path ID
    - Test file: `tests/unit/services/pathService.test.ts` (extend existing)

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The design uses TypeScript throughout, so no language selection was needed
- Backend changes (tasks 1–2) are independent of frontend and should be completed first
- The `useJobForm` composable (task 3.2) is the core of the feature — all form logic lives there
