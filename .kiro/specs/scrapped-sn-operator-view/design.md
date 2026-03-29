# Scrapped SN Operator View Bugfix Design

## Overview

The `listByStepIndex` method in `SQLiteSerialRepository` returns all serials matching a given `pathId` and `currentStepIndex`, regardless of status. When a serial is scrapped, its `status` is set to `'scrapped'` but `currentStepIndex` is left unchanged, so the scrapped serial continues to appear in the operator work queue. The fix adds a `AND status != 'scrapped'` filter to the SQL query in `listByStepIndex`. This is a single-line repository change with no service or API modifications.

## Glossary

- **Bug_Condition (C)**: A serial has `status = 'scrapped'` and `listByStepIndex` is called for that serial's `pathId` and `currentStepIndex` — the scrapped serial is incorrectly included in the result set
- **Property (P)**: `listByStepIndex` should only return serials with `status != 'scrapped'`, so scrapped serials never appear in the operator work queue
- **Preservation**: All non-scrapped serials (`in_progress`, `completed`) must continue to be returned by `listByStepIndex` exactly as before; `listByPathId`, `listByJobId`, and all other repository methods remain unchanged
- **`listByStepIndex`**: Method in `server/repositories/sqlite/serialRepository.ts` that queries serials by `path_id` and `current_step_index` — used by the operator queue API route
- **`scrapSerial`**: Method in `lifecycleService` that sets `status = 'scrapped'` and records scrap metadata/audit — this method is unchanged by the fix
- **Operator Work Queue**: The `/api/operator/queue/[userId]` endpoint that aggregates serials per step across all jobs/paths using `listByStepIndex`

## Bug Details

### Bug Condition

The bug manifests when a serial has been scrapped (status = 'scrapped') but its `currentStepIndex` still matches a step query. The `listByStepIndex` SQL query filters only on `path_id` and `current_step_index`, so scrapped serials pass through and appear in the operator queue.

**Formal Specification:**

```
FUNCTION isBugCondition(input)
  INPUT: input of type { pathId: string, stepIndex: number, serial: SerialNumber }
  OUTPUT: boolean

  RETURN input.serial.pathId = input.pathId
         AND input.serial.currentStepIndex = input.stepIndex
         AND input.serial.status = 'scrapped'
END FUNCTION
```

### Examples

- Serial `SN-00001` is at step 2 of path `path_abc`, status `'scrapped'`. Calling `listByStepIndex('path_abc', 2)` returns `[SN-00001]` — **expected**: empty list
- Serial `SN-00002` is at step 0 of path `path_xyz`, status `'in_progress'`. Calling `listByStepIndex('path_xyz', 0)` returns `[SN-00002]` — **expected**: `[SN-00002]` (correct, unchanged)
- Two serials at step 1 of path `path_abc`: `SN-00003` (in_progress) and `SN-00004` (scrapped). Calling `listByStepIndex('path_abc', 1)` returns both — **expected**: only `[SN-00003]`
- Path `path_abc` has 3 serials at step 0, all scrapped. Calling `listByStepIndex('path_abc', 0)` returns all 3 — **expected**: empty list, and the operator queue omits this step group entirely

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- `listByStepIndex` continues to return `in_progress` serials at the queried step
- `listByPathId` returns all serials regardless of status (used for job-level views)
- `listByJobId` returns all serials regardless of status (used for job-level views)
- `scrapSerial` in `lifecycleService` continues to set `status = 'scrapped'`, record scrap metadata, and write an audit entry
- Mouse/UI interactions with the operator queue remain unchanged
- Completed serials (which already have `currentStepIndex = -1`) continue to be excluded from step queries naturally

**Scope:**
All inputs where the serial's status is NOT `'scrapped'` should be completely unaffected by this fix. This includes:

- Serials with `status = 'in_progress'` at any step
- Serials with `status = 'completed'` (already excluded by `currentStepIndex = -1`)
- All calls to `listByPathId`, `listByJobId`, `listAll`, `getById`, `countByJobId`, etc.

## Hypothesized Root Cause

Based on the bug description and code inspection, the root cause is confirmed (not hypothesized):

1. **Missing status filter in SQL query**: The `listByStepIndex` method at line ~107 of `serialRepository.ts` uses:

   ```sql
   SELECT * FROM serials WHERE path_id = ? AND current_step_index = ? ORDER BY created_at ASC
   ```

   This query has no `status` filter. When `scrapSerial` sets `status = 'scrapped'` without changing `currentStepIndex`, the scrapped serial still matches the `path_id + current_step_index` predicate.

2. **Design assumption mismatch**: The `scrapSerial` method intentionally preserves `currentStepIndex` (to record which step the serial was scrapped at via `scrapStepId`). The `listByStepIndex` query was written under the assumption that only active serials would match, but this assumption was never enforced in the WHERE clause.

## Correctness Properties

Property 1: Bug Condition - Scrapped Serials Excluded from Step Query

_For any_ serial where `status = 'scrapped'` and `currentStepIndex` matches the queried step index, the fixed `listByStepIndex` method SHALL NOT include that serial in the returned list.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Non-Scrapped Serials Unchanged

_For any_ serial where `status != 'scrapped'` (i.e., `in_progress` or `completed`), the fixed `listByStepIndex` method SHALL return exactly the same results as the original method, preserving all existing operator queue behavior for active serials.

**Validates: Requirements 3.1, 3.2, 3.3, 3.5**

## Fix Implementation

### Changes Required

**File**: `server/repositories/sqlite/serialRepository.ts`

**Function**: `listByStepIndex`

**Specific Changes**:

1. **Add status filter to SQL WHERE clause**: Change the query from:
   ```sql
   SELECT * FROM serials WHERE path_id = ? AND current_step_index = ? ORDER BY created_at ASC
   ```
   to:
   ```sql
   SELECT * FROM serials WHERE path_id = ? AND current_step_index = ? AND status != 'scrapped' ORDER BY created_at ASC
   ```

No other files require changes. The `SerialRepository` interface contract (`listByStepIndex(pathId, stepIndex): SerialNumber[]`) remains the same — the semantic meaning narrows to "active serials at this step" which aligns with all existing callers (the operator queue API route).

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the root cause by showing that scrapped serials appear in `listByStepIndex` results.

**Test Plan**: Create serials, scrap some, then call `listByStepIndex` and assert that scrapped serials are present (demonstrating the bug). Run these tests on the UNFIXED code to observe the defect.

**Test Cases**:

1. **Single scrapped serial**: Create a serial at step 0, scrap it, call `listByStepIndex` — scrapped serial is returned (will fail assertion on unfixed code that it should NOT be returned)
2. **Mixed status at same step**: Create 3 serials at step 1, scrap 1, call `listByStepIndex` — all 3 returned including the scrapped one (will fail on unfixed code)
3. **All scrapped at step**: Create 2 serials at step 0, scrap both, call `listByStepIndex` — both returned, list is non-empty (will fail on unfixed code)

**Expected Counterexamples**:

- `listByStepIndex` returns serials with `status = 'scrapped'`
- Cause: missing `AND status != 'scrapped'` in the SQL WHERE clause

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**

```
FOR ALL serial WHERE isBugCondition(serial) DO
  result := listByStepIndex_fixed(serial.pathId, serial.currentStepIndex)
  ASSERT serial NOT IN result
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**

```
FOR ALL serial WHERE NOT isBugCondition(serial) DO
  ASSERT listByStepIndex_original(serial.pathId, serial.currentStepIndex)
       = listByStepIndex_fixed(serial.pathId, serial.currentStepIndex)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:

- It generates many combinations of serial statuses, step indices, and path configurations
- It catches edge cases like empty paths, single-serial paths, or all-scrapped paths
- It provides strong guarantees that non-scrapped serial behavior is unchanged

**Test Plan**: Observe behavior on UNFIXED code first for non-scrapped serials, then write property-based tests capturing that behavior.

**Test Cases**:

1. **In-progress serial preservation**: Verify `in_progress` serials at a step continue to appear in `listByStepIndex` results after the fix
2. **Empty result preservation**: Verify steps with no matching serials continue to return an empty list
3. **Multiple paths preservation**: Verify `listByStepIndex` correctly scopes to the given `pathId` and does not leak serials from other paths
4. **listByPathId/listByJobId unchanged**: Verify these methods still return all serials including scrapped ones

### Unit Tests

- Test `listByStepIndex` excludes scrapped serials
- Test `listByStepIndex` includes `in_progress` serials (preservation)
- Test `listByStepIndex` with mixed statuses at the same step
- Test `listByStepIndex` returns empty list when all serials at a step are scrapped
- Test `listByPathId` still returns scrapped serials (regression guard)

### Property-Based Tests

- Generate random serial configurations (varying statuses, step indices, path IDs) and verify `listByStepIndex` never returns a serial with `status = 'scrapped'` (fix property)
- Generate random non-scrapped serial sets and verify `listByStepIndex` returns the same results as the original query without the status filter (preservation property)

### Integration Tests

- Full lifecycle: create job → create serials → scrap one → verify operator queue excludes the scrapped serial
- Scrap all serials at a step → verify the step group disappears from the operator queue
- Scrap a serial during an active session → verify next queue fetch excludes it
