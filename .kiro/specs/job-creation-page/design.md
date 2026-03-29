# Design Document: Job Creation Page

## Overview

The Job Creation Page replaces the current inline "New Job" form (name + goal quantity only) with a dedicated full-page experience at `/jobs/new` and `/jobs/[id]/edit`. Users configure the entire job — name, goal quantity, paths, process steps, step options, advancement modes, and template application — in a single draft-based form before submitting. On submit, the system creates/updates the job and all paths sequentially via existing API composables.

The key architectural shift is from "create then configure" to "configure then create." All form state lives in a client-side draft managed by a new `useJobForm` composable. No server calls happen until the user clicks Save/Submit.

## Architecture

### Page Routing

Two new Nuxt pages share a single component:

| Route             | File                           | Mode                                   |
| ----------------- | ------------------------------ | -------------------------------------- |
| `/jobs/new`       | `app/pages/jobs/new.vue`       | Create — empty form, default values    |
| `/jobs/[id]/edit` | `app/pages/jobs/[id]/edit.vue` | Edit — pre-populated from existing job |

Both pages render a `<JobCreationForm>` component, passing a `mode` prop (`'create'` or `'edit'`) and, in edit mode, the existing job data with its paths.

### Data Flow

```
┌─────────────────────────────────────────────────────┐
│  JobCreationForm (orchestrator component)            │
│  ┌───────────────────────────────────────────────┐  │
│  │  useJobForm composable (all draft state)       │  │
│  │  - jobDraft: { name, goalQuantity }            │  │
│  │  - pathDrafts: PathDraft[]                     │  │
│  │  - validate() → ValidationResult              │  │
│  │  - submit() → calls useJobs + usePaths         │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────┐ ┌──────────────┐ ┌────────────────┐  │
│  │ Job      │ │ PathDraft    │ │ StepDraft      │  │
│  │ Fields   │ │ Cards        │ │ Rows           │  │
│  │ Section  │ │ (per path)   │ │ (per step)     │  │
│  └──────────┘ └──────────────┘ └────────────────┘  │
│                                                     │
│  Reuses: ProcessLocationDropdown, UInput, USelect,  │
│          UButton, UIcon, UBadge                     │
└─────────────────────────────────────────────────────┘
```

### Layer Compliance

| Rule                                       | How it's followed                                                                                        |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Components must NOT call `$fetch` directly | `JobCreationForm` calls `useJobForm().submit()`, which delegates to `useJobs` and `usePaths` composables |
| Components must NOT import from `server/`  | Only type imports via `~/server/types/*`                                                                 |
| Composables handle API calls               | `useJobForm` orchestrates `useJobs.createJob/updateJob` and `usePaths.createPath/updatePath`             |
| `app/composables/` auto-imported           | `useJobForm` placed in `app/composables/useJobForm.ts`                                                   |

## Components and Interfaces

### New Files

| File                                 | Type       | Purpose                                          |
| ------------------------------------ | ---------- | ------------------------------------------------ |
| `app/pages/jobs/new.vue`             | Page       | Create mode entry point                          |
| `app/pages/jobs/[id]/edit.vue`       | Page       | Edit mode entry point                            |
| `app/components/JobCreationForm.vue` | Component  | Full form orchestrator                           |
| `app/composables/useJobForm.ts`      | Composable | Draft state, validation, submission logic        |
| `server/api/paths/[id].delete.ts`    | API Route  | Delete path endpoint (new, needed for edit mode) |

### Backend Gap: Delete Path API Route

The `PathRepository` interface already has a `delete(id)` method and the SQLite implementation exists. The `PathDeleteButton` component already calls `DELETE /api/paths/:id`. However, there is no `server/api/paths/[id].delete.ts` route file, and `pathService` has no `deletePath` method.

The design requires:

1. Add `deletePath(id: string)` to `pathService` — validates path exists, checks no serials are attached, then calls `repos.paths.delete(id)`
2. Add `server/api/paths/[id].delete.ts` — thin handler calling `getServices().pathService.deletePath(id)`
3. Add `deletePath(id: string)` to the `usePaths` composable

### Backend Gap: Step Optional/DependencyType in CreatePathInput

The current `CreatePathInput.steps` only accepts `{ name, location? }`. The design needs `optional` and `dependencyType` fields on step creation. Two options:

**Chosen approach: Extend `CreatePathInput` and `UpdatePathInput`**

Extend the step shape in both input types to include optional fields:

```typescript
steps: {
  name: string
  location?: string
  optional?: boolean           // defaults to false in service
  dependencyType?: 'physical' | 'preferred' | 'completion_gate'  // defaults to 'preferred'
}[]
```

This is preferred over separate PATCH calls because:

- It's a single atomic operation per path
- The `pathService.createPath` already maps step inputs to `ProcessStep` objects — just needs to read two more fields
- No extra round-trips

### Existing Components Reused

| Component                 | Usage in Job Creation Page                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| `ProcessLocationDropdown` | Step name (type=`process`) and step location (type=`location`) inputs within each StepDraft row |
| `UInput`                  | Job name, goal quantities                                                                       |
| `USelect`                 | Advancement mode, dependency type dropdowns                                                     |
| `UButton`                 | Add/remove/move/submit/cancel controls                                                          |
| `UIcon`                   | Move arrows, remove icons, step order indicators                                                |
| `UBadge`                  | Path count, step count indicators                                                               |

### Component: JobCreationForm

Props:

```typescript
interface JobCreationFormProps {
  mode: 'create' | 'edit'
  existingJob?: Job & { paths: Path[] }
}
```

Emits:

```typescript
interface JobCreationFormEmits {
  saved: [jobId: string]
  cancel: []
}
```

Responsibilities:

- Renders job-level fields (name, goal quantity)
- Renders list of PathDraftCard sub-sections
- Renders submit/cancel buttons
- Calls `useJobForm` for all state management

### Composable: useJobForm

```typescript
interface StepDraft {
  _clientId: string              // nanoid for keying, not sent to server
  name: string
  location: string
  optional: boolean
  dependencyType: 'physical' | 'preferred' | 'completion_gate'
}

interface PathDraft {
  _clientId: string              // nanoid for keying
  _existingId?: string           // set in edit mode for existing paths
  name: string
  goalQuantity: number
  advancementMode: 'strict' | 'flexible' | 'per_step'
  steps: StepDraft[]
}

interface JobDraft {
  name: string
  goalQuantity: number
}

interface ValidationError {
  field: string                  // dot-path like "paths[0].name" or "paths[1].steps[2].name"
  message: string
}

interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

function useJobForm(mode: 'create' | 'edit', existingJob?: Job & { paths: Path[] }) {
  // Returns:
  jobDraft: Ref<JobDraft>
  pathDrafts: Ref<PathDraft[]>
  errors: Ref<ValidationError[]>
  submitting: Ref<boolean>
  submitError: Ref<string | null>

  // Path operations
  addPath(): void
  removePath(clientId: string): void

  // Step operations
  addStep(pathClientId: string): void
  removeStep(pathClientId: string, stepClientId: string): void
  moveStep(pathClientId: string, stepClientId: string, direction: -1 | 1): void

  // Template
  applyTemplate(pathClientId: string, template: TemplateRoute): void

  // Validation + submission
  validate(): ValidationResult
  submit(): Promise<string>      // returns job ID on success

  // Error helpers
  getFieldError(field: string): string | undefined
  clearFieldError(field: string): void
}
```

### Submission Flow

#### Create Mode

```
1. validate() → if invalid, scroll to first error, return
2. createJob({ name, goalQuantity }) → get jobId
3. For each pathDraft (sequentially):
   a. createPath({ jobId, name, goalQuantity, steps, advancementMode })
   b. If createPath fails → show error, stop, keep form populated
4. On success → navigateTo(`/jobs/${jobId}`)
```

Note: Advancement mode is set during path creation. The current `CreatePathInput` doesn't include `advancementMode`, so this field also needs to be added to the input type. The `pathService.createPath` will read it and pass it through to the repository.

#### Edit Mode

```
1. validate() → if invalid, scroll to first error, return
2. updateJob(jobId, { name, goalQuantity })
3. Diff pathDrafts against original paths:
   a. New paths (_existingId is undefined) → createPath(...)
   b. Modified paths (_existingId set, content changed) → updatePath(id, ...)
   c. Removed paths (original path ID not in drafts) → deletePath(id)
4. Execute: deletes first, then updates, then creates (order matters for name uniqueness)
5. On success → navigateTo(`/jobs/${jobId}`)
```

### Edit Mode Diffing Logic

The composable tracks the original path IDs loaded at init. On submit:

```typescript
function computePathChanges(originalPaths: Path[], currentDrafts: PathDraft[]) {
  const originalIds = new Set(originalPaths.map((p) => p.id))
  const draftExistingIds = new Set(
    currentDrafts.filter((d) => d._existingId).map((d) => d._existingId!)
  )

  const toDelete = originalPaths.filter((p) => !draftExistingIds.has(p.id))
  const toCreate = currentDrafts.filter((d) => !d._existingId)
  const toUpdate = currentDrafts.filter((d) => d._existingId && hasChanges(d, originalPaths))

  return { toDelete, toCreate, toUpdate }
}
```

### Template Application

When the user clicks "Apply Template" on a PathDraft:

1. Show a dropdown of available templates (fetched via `useTemplates().fetchTemplates()`)
2. On selection, replace the PathDraft's `steps` array with the template's steps, mapping:
   - `TemplateStep.name` → `StepDraft.name`
   - `TemplateStep.location` → `StepDraft.location`
   - `TemplateStep.optional` → `StepDraft.optional`
   - `TemplateStep.dependencyType` → `StepDraft.dependencyType`
3. Generate new `_clientId` for each step
4. The path name and goal quantity are NOT changed by template application

## Data Models

### Draft Types (client-side only, in useJobForm)

```typescript
// Client-side draft types — NOT sent to server directly
interface StepDraft {
  _clientId: string
  name: string
  location: string
  optional: boolean
  dependencyType: 'physical' | 'preferred' | 'completion_gate'
}

interface PathDraft {
  _clientId: string
  _existingId?: string // present only in edit mode for pre-existing paths
  name: string
  goalQuantity: number
  advancementMode: 'strict' | 'flexible' | 'per_step'
  steps: StepDraft[]
}
```

### API Input Type Changes

Extend `CreatePathInput` in `server/types/api.ts`:

```typescript
export interface CreatePathInput {
  jobId: string
  name: string
  goalQuantity: number
  advancementMode?: 'strict' | 'flexible' | 'per_step' // NEW, defaults to 'strict'
  steps: {
    name: string
    location?: string
    optional?: boolean // NEW, defaults to false
    dependencyType?: 'physical' | 'preferred' | 'completion_gate' // NEW, defaults to 'preferred'
  }[]
}
```

Extend `UpdatePathInput` similarly:

```typescript
export interface UpdatePathInput {
  name?: string
  goalQuantity?: number
  advancementMode?: 'strict' | 'flexible' | 'per_step' // NEW
  steps?: {
    name: string
    location?: string
    optional?: boolean // NEW
    dependencyType?: 'physical' | 'preferred' | 'completion_gate' // NEW
  }[]
}
```

### Mapping Draft → API Input

```typescript
// StepDraft → CreatePathInput step
function toStepInput(draft: StepDraft) {
  return {
    name: draft.name.trim(),
    location: draft.location.trim() || undefined,
    optional: draft.optional,
    dependencyType: draft.dependencyType,
  }
}

// PathDraft → CreatePathInput
function toCreatePathInput(draft: PathDraft, jobId: string): CreatePathInput {
  return {
    jobId,
    name: draft.name.trim(),
    goalQuantity: draft.goalQuantity,
    advancementMode: draft.advancementMode,
    steps: draft.steps.map(toStepInput),
  }
}
```

### Validation Rules

| Field               | Rule                 | Error Message                            |
| ------------------- | -------------------- | ---------------------------------------- |
| `job.name`          | Non-empty after trim | "Job name is required"                   |
| `job.goalQuantity`  | ≥ 1                  | "Goal quantity must be at least 1"       |
| `path.name`         | Non-empty after trim | "Path name is required"                  |
| `path.goalQuantity` | ≥ 1                  | "Path goal quantity must be at least 1"  |
| `path.steps`        | Length ≥ 1           | "At least one step is required per path" |
| `step.name`         | Non-empty after trim | "Step name is required"                  |

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Edit mode initialization round-trip

_For any_ valid Job with Paths (each containing ProcessSteps with name, location, optional, and dependencyType), initializing `useJobForm` in edit mode should produce a `jobDraft` and `pathDrafts` array where: the job name and goalQuantity match the original, each pathDraft's name, goalQuantity, and advancementMode match the corresponding original Path, and each stepDraft's name, location, optional flag, and dependencyType match the corresponding original ProcessStep.

**Validates: Requirements 1.2, 2.5, 3.7, 6.3, 7.3, 8.3, 9.3, 10.3**

### Property 2: Validation rejects empty/whitespace names

_For any_ form state where the job name, any path name, or any step name is a string composed entirely of whitespace (including the empty string), calling `validate()` should return `{ valid: false }` with at least one error referencing the offending field.

**Validates: Requirements 2.3, 3.4, 4.4**

### Property 3: Validation rejects invalid goal quantities

_For any_ form state where the job-level goalQuantity or any path-level goalQuantity is less than 1, calling `validate()` should return `{ valid: false }` with at least one error referencing the offending quantity field.

**Validates: Requirements 2.4, 3.5**

### Property 4: addPath produces correct defaults

_For any_ current job draft with goalQuantity G and any current list of pathDrafts, calling `addPath()` should: increase the pathDrafts length by exactly 1, and the new PathDraft should have an empty name, goalQuantity equal to G, advancementMode equal to `'strict'`, and exactly one StepDraft with empty name, empty location, optional=false, and dependencyType=`'preferred'`.

**Validates: Requirements 3.1, 6.2, 7.2, 9.2, 10.2**

### Property 5: removePath removes exactly one path

_For any_ list of pathDrafts with length ≥ 1 and any valid pathDraft clientId in that list, calling `removePath(clientId)` should decrease the pathDrafts length by exactly 1, the removed path should no longer be present, and all other paths should remain unchanged.

**Validates: Requirements 3.6**

### Property 6: Validation rejects paths with zero steps

_For any_ form state containing at least one PathDraft that has zero StepDrafts, calling `validate()` should return `{ valid: false }` with at least one error indicating that path needs at least one step.

**Validates: Requirements 4.3**

### Property 7: removeStep enforces minimum-one constraint

_For any_ PathDraft with exactly one StepDraft, calling `removeStep` for that step should leave the steps array unchanged (length remains 1). _For any_ PathDraft with more than one StepDraft and any valid step clientId, calling `removeStep` should decrease the steps length by exactly 1 and the removed step should no longer be present.

**Validates: Requirements 4.5**

### Property 8: moveStep is a valid swap permutation

_For any_ PathDraft with N steps (N ≥ 2) and any step at index i, calling `moveStep(pathClientId, stepClientId, direction)` should: if the move is valid (not first moving up, not last moving down), swap the step with its neighbor at index i+direction, preserving the complete set of steps (same clientIds, same data). If the move is invalid (first step moving up, last step moving down), the steps array should remain unchanged.

**Validates: Requirements 5.3, 5.4, 5.5**

### Property 9: Template application faithfully maps template steps

_For any_ TemplateRoute with N steps and any PathDraft, calling `applyTemplate(pathClientId, template)` should replace the PathDraft's steps with exactly N StepDrafts where each StepDraft's name, location, optional, and dependencyType match the corresponding TemplateStep. The PathDraft's name, goalQuantity, and advancementMode should remain unchanged.

**Validates: Requirements 11.2, 11.3**

### Property 10: Edit diff correctly classifies path changes

_For any_ set of original Paths and any set of current PathDrafts, the diff function should partition changes such that: paths whose IDs appear in originals but not in drafts are classified as deletes, drafts without `_existingId` are classified as creates, and drafts with `_existingId` that differ from their original are classified as updates. The union of delete IDs, update IDs, and create drafts should account for all paths with no overlaps.

**Validates: Requirements 13.1, 13.2, 13.3**

### Property 11: Error clearing on field correction

_For any_ form state that has validation errors, when a field that was invalid is changed to a valid value and `clearFieldError` is called for that field path, the errors array should no longer contain an error for that specific field, while errors for other fields remain.

**Validates: Requirements 14.4**

## Error Handling

### Client-Side Errors

| Scenario              | Handling                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Validation failure    | `validate()` returns errors array; component scrolls to first error, displays inline messages |
| Empty job name        | Error on `job.name` field: "Job name is required"                                             |
| Invalid goal quantity | Error on quantity field: "Goal quantity must be at least 1"                                   |
| Empty path name       | Error on `paths[i].name`: "Path name is required"                                             |
| Path with no steps    | Error on `paths[i].steps`: "At least one step is required per path"                           |
| Empty step name       | Error on `paths[i].steps[j].name`: "Step name is required"                                    |

### Server-Side Errors

| Scenario                         | Handling                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Job creation fails               | `submitError` set to server message; form remains populated; submit button re-enabled                                        |
| Path creation fails mid-sequence | `submitError` set; form remains populated; already-created job and paths persist (user can retry or navigate to partial job) |
| Path update fails                | `submitError` set; form remains populated                                                                                    |
| Path delete fails (has serials)  | `submitError` set with message like "Cannot delete path with serial numbers"                                                 |
| Network error                    | `submitError` set to generic "Network error — please try again"                                                              |
| Non-existent job in edit mode    | Page shows error message with link back to `/jobs`                                                                           |

### Partial Failure in Create Mode

If the job is created but a subsequent path creation fails, the job exists on the server with fewer paths than intended. The design handles this by:

1. Showing the error message on the form
2. Keeping the form populated so the user can see what failed
3. The user can navigate to the partially-created job and add remaining paths from the detail page

This is an acceptable trade-off vs. implementing server-side transactions across multiple API calls. A future improvement could add a batch endpoint.

### Partial Failure in Edit Mode

Edit mode executes deletes → updates → creates. If a middle operation fails:

1. Error is shown, form stays populated
2. Some changes may have been applied server-side
3. User can retry (idempotent updates) or navigate to the job detail page

## Testing Strategy

### Property-Based Testing

Library: `fast-check` (already in the project's test dependencies)

Each correctness property maps to a single property-based test in `tests/properties/`. Tests run with minimum 100 iterations.

| Property                       | Test File                    | What's Generated                                            |
| ------------------------------ | ---------------------------- | ----------------------------------------------------------- |
| P1: Edit round-trip            | `jobForm.properties.test.ts` | Random Job + Path[] with valid fields                       |
| P2: Empty name rejection       | `jobForm.properties.test.ts` | Random whitespace strings injected into name fields         |
| P3: Invalid quantity rejection | `jobForm.properties.test.ts` | Random numbers ≤ 0 injected into quantity fields            |
| P4: addPath defaults           | `jobForm.properties.test.ts` | Random goalQuantity values, random existing pathDraft lists |
| P5: removePath                 | `jobForm.properties.test.ts` | Random pathDraft lists, random valid index                  |
| P6: Zero-step rejection        | `jobForm.properties.test.ts` | Random form states with empty step arrays                   |
| P7: removeStep min-1           | `jobForm.properties.test.ts` | Random pathDrafts with 1 or more steps                      |
| P8: moveStep permutation       | `jobForm.properties.test.ts` | Random step lists, random index + direction                 |
| P9: Template application       | `jobForm.properties.test.ts` | Random TemplateRoute, random existing PathDraft             |
| P10: Edit diff                 | `jobForm.properties.test.ts` | Random original Path[], random modified PathDraft[]         |
| P11: Error clearing            | `jobForm.properties.test.ts` | Random invalid form states, random field corrections        |

Tag format for each test:

```
// Feature: job-creation-page, Property 1: Edit mode initialization round-trip
```

### Unit Tests

Unit tests complement property tests for specific examples and edge cases:

- Create mode initializes with correct empty state (example for 1.1)
- Edit mode with non-existent job shows error (example for 1.3)
- Template application when no templates exist hides control (example for 11.4)
- Submit in create mode calls createJob then createPath sequentially (example for 12.1)
- Submit navigates to job detail on success (example for 12.2)
- Submit shows error and preserves form on failure (example for 12.3)
- Edit submit navigates on success (example for 13.4)
- Validation runs before any API calls (example for 14.1)

### Integration Tests

- Full create flow: fill form → submit → verify job + paths created via API
- Full edit flow: load job → modify → submit → verify changes persisted
- Edit flow with path deletion: remove path → submit → verify path deleted
- Edit flow with new path addition: add path → submit → verify path created

### Test Configuration

```typescript
// vitest.config.ts already configured with fast-check
// Property tests: minimum 100 iterations (fast-check default is 100)
// Test file: tests/properties/jobForm.properties.test.ts
```
