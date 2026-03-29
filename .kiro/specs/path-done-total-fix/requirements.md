# Requirements: Path "Done" Total Fix

## GitHub Issue #24

The Path "Done" total incorrectly displays the sum of `completedCount` across all steps in the `StepDistribution[]` array, when it should display the count of distinct parts that have completed all path steps (i.e., `currentStepIndex === -1`).

## Requirements

### Requirement 1: Service layer returns path-level completed count separately

The `pathService` must provide a method that returns the count of non-scrapped parts with `currentStepIndex === -1` for a given path. This count represents parts that have finished all steps in the path.

**Acceptance Criteria:**

- [ ] A `getPathCompletedCount(pathId)` method exists on `pathService`
- [ ] It returns the count of parts where `currentStepIndex === -1` for the given path
- [ ] It throws `NotFoundError` if the path does not exist
- [ ] The count excludes scrapped parts (consistent with existing `listByStepIndex` behavior)

### Requirement 2: `getStepDistribution` no longer copies path-level completed count onto every step

The `getStepDistribution` method currently copies the total completed count onto every `StepDistribution` entry. This must be removed so that `completedCount` on each entry is `0` (per-step completion is not independently tracked in the current data model).

**Acceptance Criteria:**

- [ ] `getStepDistribution` no longer queries for completed parts (`listByStepIndex(pathId, -1)`)
- [ ] Every `StepDistribution` entry has `completedCount` set to `0`
- [ ] `partCount`, `isBottleneck`, and all other fields remain unchanged
- [ ] Bottleneck detection logic is unaffected

### Requirement 3: API response includes top-level `completedCount`

The `GET /api/paths/:id` endpoint must return `completedCount` as a top-level integer field alongside the existing `distribution` array.

**Acceptance Criteria:**

- [ ] Response shape is `{ ...path, distribution, completedCount }`
- [ ] `completedCount` is an integer representing parts that completed all steps
- [ ] Existing response fields are unchanged
- [ ] Error handling (404, 400) remains the same

### Requirement 4: StepTracker "Done" card uses path-level completed count

The "Done" card in `StepTracker.vue` currently computes its value via `distribution.reduce((s, d) => s + d.completedCount, 0)`. This must be replaced with the path-level `completedCount` prop.

**Acceptance Criteria:**

- [ ] `StepTracker` accepts a `completedCount` number prop
- [ ] The "Done" card displays the `completedCount` prop value directly
- [ ] The `.reduce()` sum over `distribution` is removed from the "Done" card
- [ ] Per-step `completedCount` display within each step card is updated (shows `0` or is removed)

### Requirement 5: JobExpandableRow ProgressBar uses path-level completed count

The `ProgressBar` `:completed` prop in `JobExpandableRow.vue` currently uses the same buggy `.reduce()` sum. It must use the path-level `completedCount` from the API response.

**Acceptance Criteria:**

- [ ] `JobExpandableRow` stores `completedCount` from the API response per path
- [ ] `ProgressBar` `:completed` uses the stored path-level `completedCount`
- [ ] The `.reduce()` sum for `:completed` is removed
- [ ] The expanded step table's per-step "Completed" column reflects the corrected per-step value (`0`)

### Requirement 6: Parent components pass completedCount to StepTracker

Any page or component that renders `StepTracker` must pass the `completedCount` prop from the API response.

**Acceptance Criteria:**

- [ ] All call sites of `<StepTracker>` pass `:completedCount` from the path detail response
- [ ] No call site falls back to the old `.reduce()` pattern
