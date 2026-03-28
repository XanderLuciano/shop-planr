# Requirements: Job Edit Functionality

> Derived from [design.md](./design.md) — Fixes **GitHub Issue #3**

## Acceptance Criteria

### 1. Route Restructure
- 1.1 The edit page file MUST be located at `app/pages/jobs/edit/[id].vue` (sibling route, not nested child)
- 1.2 The old file `app/pages/jobs/[id]/edit.vue` MUST be deleted
- 1.3 The `app/pages/jobs/[id]/` directory MUST be removed (no leftover empty directory)
- 1.4 Navigating to `/jobs/edit/:id` MUST render the edit page independently without requiring `<NuxtPage/>` in any parent

### 2. Edit Button Navigation
- 2.1 The Edit button on the job detail page (`/jobs/:id`) MUST navigate to `/jobs/edit/:id`
- 2.2 The `navigateTo` call MUST use `encodeURIComponent(jobId)` for the ID parameter

### 3. Edit Page Behavior
- 3.1 On mount, the edit page MUST fetch the job via `GET /api/jobs/:id` and display a loading indicator while fetching
- 3.2 If the job is not found (404), the edit page MUST display an error message
- 3.3 On successful load, the edit page MUST render `JobCreationForm` with `mode="edit"` and the fetched job data as `existing-job` prop
- 3.4 The page title MUST show "Edit Job — {job name}"

### 4. Save Flow
- 4.1 Clicking "Save Changes" MUST call `PUT /api/jobs/:id` with updated `name` and `goalQuantity`
- 4.2 Path changes MUST be computed via `computePathChanges()` and applied as DELETE → UPDATE → CREATE operations
- 4.3 On successful save, the page MUST navigate to `/jobs/:id` (the job detail page)

### 5. Cancel / Back Navigation
- 5.1 Clicking "Cancel" MUST navigate to `/jobs/:id` without making any API calls
- 5.2 The "Back to Jobs" link MUST navigate to `/jobs` (the jobs list)

### 6. Page Toggle Compatibility
- 6.1 The route `/jobs/edit/:id` MUST respect the `jobs` page toggle — disabled when `jobs` toggle is `false`
- 6.2 No changes to `ROUTE_TOGGLE_MAP` or `ALWAYS_ENABLED_ROUTES` are needed (existing `/jobs` prefix matching covers it)

### 7. No Regressions
- 7.1 The job detail page (`/jobs/:id`) MUST continue to render correctly
- 7.2 The job creation page (`/jobs/new`) MUST continue to work
- 7.3 The jobs list page (`/jobs`) MUST continue to work
- 7.4 All existing tests MUST continue to pass

## Correctness Properties

### Property 1: Edit route renders independently
```
∀ jobId ∈ ValidJobIds:
  navigate(/jobs/edit/{jobId}) → editPage.isMounted === true
  ∧ editPage contains JobCreationForm with mode="edit"
```

### Property 2: Round-trip data integrity
```
∀ job ∈ Jobs, field ∈ {name, goalQuantity}:
  let original = load(job)
  let edited = modify(original, field, newValue)
  save(edited)
  let reloaded = load(job)
  ⟹ reloaded[field] === newValue
```

### Property 3: Path diff correctness
```
∀ originalPaths, draftPaths:
  let changes = computePathChanges(originalPaths, draftPaths)
  ⟹ changes.toDelete ∩ draftExistingIds === ∅
  ∧ changes.toCreate.every(d => !d._existingId)
  ∧ changes.toUpdate.every(d => hasChanges(d, findOriginal(d)))
```

### Property 4: Page toggle inheritance
```
∀ id ∈ Strings:
  isPageEnabled({jobs: false, ...defaults}, '/jobs/edit/' + id) === false
  ∧ isPageEnabled({jobs: true, ...defaults}, '/jobs/edit/' + id) === true
```
