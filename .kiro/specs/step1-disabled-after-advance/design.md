# Step 1 Disabled After Advance — Bugfix Design

## Overview

When all serial numbers at a step are advanced, the `GET /api/operator/step/[stepId]` endpoint throws a 404 ("No active parts at this step") because it treats zero serials as a not-found condition. This is incorrect for two reasons: (1) the first step (step_order = 0) is the only place new serials can be created, so it must always be accessible; (2) non-first steps with zero serials are valid steps waiting for upstream work, not missing resources. The fix changes the API to return valid responses with `partCount: 0` for both cases, and updates the `_all` endpoint to always include first steps. Only truly invalid step IDs (not in the database) should produce a 404.

## Glossary

- **Bug_Condition (C)**: A valid process step exists in the database but has zero active serials — the API incorrectly returns 404 instead of a valid response
- **Property (P)**: Valid steps with zero serials return a 200 response with `partCount: 0` and contextual information (previous step WIP count for non-first steps)
- **Preservation**: Steps with active serials continue to return the same response shape and data; truly invalid step IDs continue to return 404
- **`[stepId].get.ts`**: The API route handler in `server/api/operator/step/[stepId].get.ts` that looks up step data for the Step View page
- **`_all.get.ts`**: The API route handler in `server/api/operator/queue/_all.get.ts` that aggregates all active work for the Parts View page
- **step_order**: The zero-based index of a process step within its path; step_order = 0 is the first step where serials are created
- **WIP count**: Work-in-progress count — the number of active serials at a given step

## Bug Details

### Bug Condition

The bug manifests when a user navigates to the Step View page for a process step that has zero active serial numbers. The `[stepId].get.ts` handler finds the step in the database but throws `NotFoundError('No active parts at this step')` when `serials.length === 0`, regardless of whether the step is valid. Similarly, `_all.get.ts` skips steps with zero serials via `if (serials.length === 0) continue`, making first steps unreachable from the Parts View after all serials are advanced.

**Formal Specification:**

```
FUNCTION isBugCondition(input)
  INPUT: input of type { stepId: string }
  OUTPUT: boolean

  step := lookupProcessStepInDatabase(input.stepId)
  IF step IS NULL THEN RETURN false   // truly invalid → not this bug

  path := getPathForStep(step)
  serials := listSerialsByStepIndex(path.id, step.order)

  RETURN serials.length === 0
END FUNCTION
```

### Examples

- **First step, all advanced**: Job has 5 serials, all advanced to step 2. User navigates to step 1 → API returns 404, SerialCreationPanel is hidden. Expected: 200 with `partCount: 0`, SerialCreationPanel visible.
- **First step, never had serials**: New job with a path but no serials created yet. User navigates to step 1 → API returns 404. Expected: 200 with `partCount: 0`, SerialCreationPanel visible.
- **Non-first step, waiting for upstream**: Step 2 has zero serials because step 1 hasn't advanced any yet. Step 1 has 3 WIP serials. User navigates to step 2 → API returns 404. Expected: 200 with `partCount: 0` and `previousStepWipCount: 3`.
- **Invalid step ID**: User navigates to `/parts/step/step_NONEXISTENT` → API returns 404 "ProcessStep not found". Expected: same 404 (unchanged).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- Steps with one or more active serials return the same `StepViewResponse` shape with correct `serialIds`, `partCount`, and step metadata
- Truly invalid step IDs (not in the database) return 404 "ProcessStep not found"
- Serial advancement logic (advancing serials between steps) is completely unaffected
- The SerialCreationPanel component behavior when serials exist is unchanged
- Mouse/keyboard interactions, operator selection, and note creation are unaffected

**Scope:**
All inputs where `isBugCondition` returns false (steps with active serials, or invalid step IDs) should be completely unaffected by this fix. This includes:

- Steps with one or more active serials at any step_order
- Non-existent step IDs
- All serial creation and advancement operations
- All other API endpoints

## Hypothesized Root Cause

Based on the code analysis, the root causes are confirmed (not hypothesized):

1. **`[stepId].get.ts` — Premature 404 on zero serials**: Line `if (serials.length === 0) { throw new NotFoundError('No active parts at this step') }` treats zero serials as a not-found condition. The step exists in the database — it's the serial count that's zero. The fix must remove this check and return a valid response with `partCount: 0` and empty `serialIds`.

2. **`_all.get.ts` — Skipping zero-serial steps**: Line `if (serials.length === 0) continue` skips all steps with zero serials, including first steps. This makes first steps unreachable from the Parts View after all serials are advanced. The fix must include first steps (step_order = 0) even when they have zero serials.

3. **`[stepId].vue` — "All parts advanced" empty state blocks first step**: The template condition `v-else-if="allAdvanced || (job && job.partCount === 0)"` shows a "go back" empty state when partCount is 0, even for first steps where the user should see the SerialCreationPanel. The fix must check `stepOrder === 0` and show the creation panel instead.

4. **Missing previous-step WIP context**: For non-first steps with zero serials, there's no mechanism to show the user how many serials the previous step is working on. The `StepViewResponse` type needs a new optional field for this context.

## Correctness Properties

Property 1: Bug Condition — First Step Always Accessible

_For any_ valid process step with step_order = 0 and zero active serials, the fixed `[stepId].get.ts` endpoint SHALL return a 200 response with `partCount: 0`, an empty `serialIds` array, and correct step/job/path metadata, allowing the SerialCreationPanel to render.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition — Non-First Step Returns WIP Context

_For any_ valid process step with step_order > 0 and zero active serials, the fixed `[stepId].get.ts` endpoint SHALL return a 200 response with `partCount: 0`, an empty `serialIds` array, and a `previousStepWipCount` field indicating how many serials the prior step currently has.

**Validates: Requirements 2.4, 2.5**

Property 3: Bug Condition — First Step Included in Parts View

_For any_ valid first step (step_order = 0), the fixed `_all.get.ts` endpoint SHALL include that step in the response even when it has zero active serials, so it remains navigable from the Parts View.

**Validates: Requirements 2.3**

Property 4: Preservation — Steps With Active Serials Unchanged

_For any_ valid process step with one or more active serials, the fixed endpoints SHALL produce the same response as the original endpoints, preserving all existing `WorkQueueJob` fields and values.

**Validates: Requirements 3.2, 3.4**

Property 5: Preservation — Invalid Step IDs Still 404

_For any_ step ID that does not correspond to any existing process step in the database, the fixed `[stepId].get.ts` endpoint SHALL return a 404 "ProcessStep not found" error, identical to the original behavior.

**Validates: Requirements 3.1**

## UI Mockups

### UI Cleanup: Deduplicated Step Header

Currently the step header info (step name, job name, path name, location) is rendered twice — once in the page-level `[stepId].vue` template and again inside `SerialCreationPanel.vue`'s own header. The fix removes the duplicate header from the panel components so the page owns the single source of truth for step metadata. The page header also gains prev/next step navigation buttons.

### Current (Buggy) State — Any Step with 0 Serials

When any step has zero serials, the user sees a dead-end empty state with no actions available:

```
┌─────────────────────────────────────────────────────┐
│ ← Back to Parts                                     │
│                                                     │
│                  ✓ (green check)                     │
│              All parts advanced                      │
│          No parts remain at this step.               │
│                                                     │
│              [ ← Back to Parts ]                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Fixed State A — First Step (step_order = 0) with 0 Serials

The page header shows step info with prev/next navigation. The SerialCreationPanel renders below it (without its own duplicate header), showing the creation form and an empty serials list:

```
┌─────────────────────────────────────────────────────┐
│ ← Back to Parts                                     │
│                                                     │
│  Cutting                          Step 1 of 4       │
│  Assembly Job #42 · Main Path · 📍 Bay 3            │
│                                                     │
│  [← Prev]                              [Next →]     │
│   (disabled — first step)          (goes to Welding) │
│                                                     │
│         [ 👷 Select Operator ▾ ]                     │
│                                                     │
│  ─────────────────────────────────────────────────  │
│  (after operator selected)                          │
│                                                     │
│  Advancing to: Welding → Bay 5                      │
│                                                     │
│  Create Serial Numbers                              │
│  [ 1 ] [ + Create ] [ → Create & Advance ]          │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  No parts created yet. Use the form above   │    │
│  │  to create serial numbers.                  │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Note (optional)                                    │
│  ┌─────────────────────────────────────────────┐    │
│  │ Add observations or issues...               │    │
│  └─────────────────────────────────────────────┘    │
│                                                  0/1000│
│                                                     │
│  [ → Advance 0 selected ] [ Cancel ]                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Fixed State B — Non-First Step (step_order > 0) with 0 Serials

The page header shows step info with prev/next navigation. Below it, a "waiting" state with upstream WIP context:

```
┌─────────────────────────────────────────────────────┐
│ ← Back to Parts                                     │
│                                                     │
│  Welding                          Step 2 of 4       │
│  Assembly Job #42 · Main Path · 📍 Bay 5            │
│                                                     │
│  [← Prev]                              [Next →]     │
│   (goes to Cutting)              (goes to Finishing) │
│                                                     │
│         [ 👷 Select Operator ▾ ]                     │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│              ⏳ (clock icon)                         │
│       Waiting for the previous step                  │
│                                                     │
│   The prior step "Cutting" currently has             │
│   3 serial number(s) in progress.                    │
│                                                     │
│   Parts will appear here once they are               │
│   advanced from the previous step.                   │
│                                                     │
│              [ ← Back to Parts ]                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Unchanged — Step with Active Serials (header deduplicated, nav added)

Steps with active serials render the same panel content as today, but the duplicate header inside the panel is removed and prev/next navigation is added to the page header:

```
┌─────────────────────────────────────────────────────┐
│ ← Back to Parts                                     │
│                                                     │
│  Welding                          Step 2 of 4       │
│  Assembly Job #42 · Main Path · 📍 Bay 5            │
│                                                     │
│  [← Prev]                              [Next →]     │
│   (goes to Cutting)              (goes to Finishing) │
│                                                     │
│         [ 👷 John D. ▾ ]          [x]               │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  (SerialCreationPanel or ProcessAdvancementPanel     │
│   content renders here WITHOUT its own header)       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Fix Implementation

### Changes Required

**File**: `server/api/operator/step/[stepId].get.ts`

**Specific Changes**:

1. **Remove premature 404 on zero serials**: Delete the `if (serials.length === 0) { throw new NotFoundError(...) }` block. Instead, always build the `WorkQueueJob` response, with `serialIds: []` and `partCount: 0` when no serials exist.
2. **Add step lookup via path repository**: When the step is not found by iterating jobs/paths (which only finds steps belonging to active jobs), fall back to `pathService.getStepById()` or `repos.paths.getStepById()` to confirm the step exists in the database before returning 404. Actually, the current loop already iterates all jobs and all paths — the step will be found if it exists. The only issue is the zero-serial check.
3. **Add previous step WIP count**: When `step.order > 0` and `serials.length === 0`, look up the previous step's serial count and include it as `previousStepWipCount` in the response.

**File**: `server/api/operator/queue/_all.get.ts`

**Specific Changes**:

1. **Include first steps with zero serials**: Change the `if (serials.length === 0) continue` to `if (serials.length === 0 && step.order !== 0) continue` so that first steps always appear in the Parts View.

**File**: `server/types/computed.ts`

**Specific Changes**:

1. **Add optional `previousStepWipCount` to `StepViewResponse`**: Add `previousStepWipCount?: number` to the response type so non-first steps with zero serials can communicate upstream WIP.
2. **Add step navigation fields to `WorkQueueJob`**: Add `previousStepId?: string`, `previousStepName?: string`, `nextStepId?: string` so the frontend can render prev/next navigation buttons. (`nextStepName` already exists; `nextStepId` is new.)

**File**: `app/pages/parts/step/[stepId].vue`

**Specific Changes**:

1. **Deduplicate step header**: The page already renders step name, job name, path name, and location in its own header. Remove the duplicate header rendering from inside `SerialCreationPanel` and `ProcessAdvancementPanel` by not passing header-related props or by having the panels skip their own header when rendered inside this page. The page header becomes the single source of truth.
2. **Add "Step X of Y" indicator**: Display `Step ${job.stepOrder + 1} of ${job.totalSteps}` next to the step name in the page header.
3. **Add prev/next step navigation**: Below the header, render two navigation buttons — "← Prev" linking to `previousStepId` (disabled when `stepOrder === 0`) and "Next →" linking to `nextStepId` (disabled when `isFinalStep`).
4. **Show SerialCreationPanel for first step with zero serials**: Modify the template so that when `job.stepOrder === 0` and `job.partCount === 0`, the SerialCreationPanel is shown instead of the "All parts advanced" empty state.
5. **Show "waiting for prior step" state for non-first steps with zero serials**: Add a new template block that displays when `job.stepOrder > 0` and `job.partCount === 0`, showing the previous step name and WIP count.

**File**: `app/components/SerialCreationPanel.vue`

**Specific Changes**:

1. **Remove duplicate header**: Remove the header `<div>` that renders step name, job name, path name, and location — this is now owned by the parent page.

**File**: `app/components/ProcessAdvancementPanel.vue`

**Specific Changes**:

1. **Remove duplicate header**: Remove the header `<div>` that renders step name, job name, path name, and location — this is now owned by the parent page.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the root cause analysis by observing the 404 behavior on zero-serial steps.

**Test Plan**: Write tests that create jobs with paths and serials, advance all serials past step 1, then call the replicated step endpoint lookup function. Run these tests on the UNFIXED code to observe 404 (null) returns.

**Test Cases**:

1. **First step after full advance**: Create a job, create serials at step 0, advance all to step 1, query step 0 — returns null/404 (will fail on unfixed code)
2. **Non-first step with no upstream advance**: Create a job with 2+ steps, create serials at step 0, query step 1 — returns null/404 (will fail on unfixed code)
3. **First step with no serials ever created**: Create a job with a path but no serials, query step 0 — returns null/404 (will fail on unfixed code)
4. **Parts View omits first step**: Create a job, advance all serials, check `_all` response — step 0 is missing (will fail on unfixed code)

**Expected Counterexamples**:

- `lookupStep(ctx, firstStepId)` returns `null` when all serials are advanced
- `_all` response omits first steps with zero serials
- Root cause confirmed: the `serials.length === 0` check in both endpoints

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**

```
FOR ALL input WHERE isBugCondition(input) DO
  result := lookupStep_fixed(input.stepId)
  ASSERT result IS NOT NULL
  ASSERT result.job.partCount === 0
  ASSERT result.job.serialIds === []
  ASSERT result.job.stepId === input.stepId
  IF step.order > 0 THEN
    ASSERT result.previousStepWipCount IS defined
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**

```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT lookupStep_original(input) = lookupStep_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:

- It generates many random job/path/serial configurations automatically
- It catches edge cases like single-step paths, many-step paths, partially advanced serials
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for steps with active serials and invalid step IDs, then write property-based tests capturing that behavior.

**Test Cases**:

1. **Active serial step preservation**: Generate random job/path/serial configs, query steps that have serials, verify response matches original logic
2. **Invalid step ID preservation**: Generate random non-existent step IDs, verify 404 is returned by both original and fixed logic
3. **Parts View preservation for non-first steps**: Verify `_all` endpoint still skips non-first steps with zero serials
4. **Serial advancement preservation**: Verify advancing serials still works correctly after the fix

### Unit Tests

- Test `[stepId].get.ts` returns 200 with `partCount: 0` for first step with zero serials
- Test `[stepId].get.ts` returns 200 with `previousStepWipCount` for non-first step with zero serials
- Test `[stepId].get.ts` returns 404 for truly invalid step IDs
- Test `_all.get.ts` includes first steps with zero serials
- Test `_all.get.ts` still skips non-first steps with zero serials

### Property-Based Tests

- Generate random job/path/serial configurations and verify first steps always return valid responses regardless of serial count
- Generate random configurations and verify non-first steps with zero serials include correct `previousStepWipCount`
- Generate random configurations with active serials and verify response matches original behavior (preservation)
- Generate random invalid step IDs and verify 404 is returned (preservation)

### Integration Tests

- Full flow: create job → create serials → advance all → verify step 1 still accessible → create new serials
- Full flow: create job with 3 steps → verify step 2 shows "waiting" state with step 1 WIP count
- Full flow: verify Parts View includes first step after all serials advanced
- Full flow: verify invalid step ID returns 404 throughout
