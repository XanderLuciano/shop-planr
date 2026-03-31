# Requirements: Step Done Count Fix

> Derived from [design.md](./design.md) — GitHub Issue #50

## Requirement 1: Step Done Count Accuracy

### 1.1 Compute step-level completed count from part positions

When `getStepDistribution()` is called for a path, each `StepDistribution` entry at order `N` MUST have `completedCount` equal to the number of non-scrapped parts on that path where `currentStepIndex > N` OR `currentStepIndex === -1`.

**Acceptance Criteria:**
- Given a 3-step path with parts at various positions, each step's `completedCount` reflects parts that have moved past it
- Given a path where 3 of 5 parts have completed all steps, the first step's `completedCount` includes those 3 plus any parts at later steps

### 1.2 Exclude scrapped parts from step done counts

Scrapped parts (`status === 'scrapped'`) MUST NOT be included in any step's `completedCount` or `partCount`.

**Acceptance Criteria:**
- Given a path with 5 parts where 2 are scrapped and 3 are completed, step done counts only reflect the 3 non-scrapped completed parts
- Scrapping a part that was previously counted as "done" at a step reduces that step's `completedCount`

### 1.3 Monotonically non-increasing done counts across steps

For any path with steps ordered `[s_0, s_1, ..., s_N]`, the `completedCount` values MUST satisfy: `completedCount(s_0) >= completedCount(s_1) >= ... >= completedCount(s_N)`.

**Acceptance Criteria:**
- For any valid distribution of parts across steps, earlier steps always have equal or higher done counts than later steps
- This holds regardless of how many parts exist or where they are positioned

### 1.4 Last step done count equals path completed count

The last step's `completedCount` MUST equal `getPathCompletedCount(pathId)` — the count of parts with `currentStepIndex === -1`.

**Acceptance Criteria:**
- Given a 4-step path where 3 parts have completed all steps, the last step's `completedCount` is 3 and `getPathCompletedCount` also returns 3

### 1.5 Count conservation

The sum of `partCount` across all steps plus `getPathCompletedCount(pathId)` MUST equal the total number of non-scrapped parts on the path.

**Acceptance Criteria:**
- No parts are lost or double-counted between step counts and the completed count
- This invariant holds after any sequence of advancement operations

## Requirement 2: Performance

### 2.1 Single-query part fetching

`getStepDistribution()` MUST fetch parts using a single `listByPathId()` call and compute all per-step counts in-memory, rather than issuing one `listByStepIndex()` query per step.

**Acceptance Criteria:**
- The implementation uses `listByPathId` once, then filters in-memory for each step
- The `listByStepIndex` call is no longer used within `getStepDistribution`

## Requirement 3: Backward Compatibility

### 3.1 No interface changes

The `StepDistribution` type, `getStepDistribution()` signature, and `GET /api/paths/:id` response shape MUST remain unchanged.

**Acceptance Criteria:**
- No new fields added to `StepDistribution`
- No changes to the API route handler
- Frontend components render correctly without modification

### 3.2 Path-level completed count unchanged

`getPathCompletedCount()` MUST continue to return the count of parts with `currentStepIndex === -1`, independent of step-level done counts.

**Acceptance Criteria:**
- `getPathCompletedCount` behavior is identical before and after the fix
- The path-level "Done" column in StepTracker still shows the correct total

### 3.3 Existing tests updated, not broken

All existing tests that assert `completedCount === 0` MUST be updated to assert the correct computed values. No test should be deleted — only updated.

**Acceptance Criteria:**
- `pathService.test.ts` step distribution tests updated with correct expected values
- `pathDoneCount.property.test.ts` CP-DONE-2 updated to verify correct done counts instead of hardcoded 0
- `progressTracking.test.ts` integration test updated with correct expected values
- All 878+ existing tests continue to pass

### 3.4 TypeScript typecheck passes

The codebase MUST pass `npm run typecheck` (`nuxt typecheck`) with no new errors after the fix.

**Acceptance Criteria:**
- `npm run typecheck` exits with code 0
- No new type errors introduced by the changes

## Correctness Properties

### CP-STEP-DONE-1: Step done count accuracy (property test)

```
∀ path, ∀ step_i in path.steps:
  getStepDistribution(path.id)[i].completedCount ===
    count(parts where (currentStepIndex > step_i.order OR currentStepIndex === -1)
          AND status !== 'scrapped')
```

### CP-STEP-DONE-2: Monotonic non-increasing done counts (property test)

```
∀ path with steps [s_0, s_1, ..., s_N]:
  completedCount(s_0) >= completedCount(s_1) >= ... >= completedCount(s_N)
```

### CP-STEP-DONE-3: Last step done count equals path completed count (property test)

```
∀ path with steps [s_0, ..., s_N]:
  getStepDistribution(path.id)[N].completedCount === getPathCompletedCount(path.id)
```

### CP-STEP-DONE-4: Count conservation (property test)

```
∀ path:
  sum(distribution[i].partCount for all i) + getPathCompletedCount(path.id) ===
    count(non-scrapped parts on path)
```
