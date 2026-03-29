# Step Assignment Dropdown Bugfix Design

## Overview

The StepAssignmentDropdown component fails to persist user assignments because of a data type mismatch in its `handleSelection` handler. Nuxt UI's `USelectMenu` with `value-key="value"` emits the raw primitive value (a string userId or `null`) on `@update:model-value`, but `handleSelection` treats the argument as a `SelectMenuItem` object and accesses `item?.value` — which is `undefined` on a plain string, so `null` is always sent to the API. The fix corrects the handler signature and, as enhancements, moves the dropdown into the StepTracker component and widens step columns to accommodate it.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — when a user selects an assignee from the dropdown, the emitted raw string value is treated as an object, causing `undefined` to be sent as `null` to the API
- **Property (P)**: The desired behavior — the correct userId string (or `null` for unassign) is sent to the PATCH `/api/steps/{id}/assign` endpoint
- **Preservation**: Existing step distribution display, step click navigation, mouse interactions, error handling/revert, and notes functionality must remain unchanged
- **handleSelection**: The function in `StepAssignmentDropdown.vue` that processes the `@update:model-value` event from `USelectMenu`
- **USelectMenu**: Nuxt UI's select menu component; with `value-key="value"` it emits the primitive value, not the full item object
- **StepTracker**: The component in `StepTracker.vue` that renders step columns with distribution data

## Bug Details

### Bug Condition

The bug manifests when a user selects any assignee from the StepAssignmentDropdown. The `USelectMenu` component with `value-key="value"` emits the raw value (a string userId or `null`), but `handleSelection` declares its parameter as `SelectMenuItem | null` and accesses `item?.value`. On a plain string, `.value` is `undefined`, which falls through to `?? null`, so `null` is always sent to the API regardless of which user was selected.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { selectedValue: string | null, handlerReceives: any }
  OUTPUT: boolean

  RETURN typeof input.handlerReceives === 'string'
         AND input.handlerReceives !== null
         AND input.handlerReceives.value === undefined
END FUNCTION
```

### Examples

- User selects "Alice" (userId: `"user_abc"`) → `handleSelection` receives `"user_abc"` → accesses `"user_abc"?.value` → `undefined` → sends `null` to API → assignment not persisted
- User selects "Bob" (userId: `"user_xyz"`) → same flow → sends `null` → assignment not persisted
- User selects "Unassigned" → `handleSelection` receives `null` → accesses `null?.value` → `undefined` → sends `null` → correct by coincidence, but logic is wrong
- Edge case: only one active user in list → same bug, `null` always sent

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Step distribution display (serial counts, completed counts, bottleneck badges) must continue to render correctly in StepTracker
- Clicking a step column must continue to navigate to `/parts/step/{stepId}`
- The `assigned` event must continue to trigger `onStepAssigned` in the parent page, reloading distributions and path data
- API error handling must continue to revert optimistic updates and show error toasts
- The PATCH `/api/steps/{id}/assign` endpoint must continue to validate user existence and active status
- Path notes section, advancement mode selector, and path editor must remain unaffected
- The "Done" (completed) column in StepTracker must continue to display correctly

**Scope:**
All inputs that do NOT involve the `handleSelection` value extraction are completely unaffected by this fix. This includes:
- Mouse clicks on step columns (navigation)
- Step distribution data rendering
- Path CRUD operations
- Serial number management
- Notes and audit functionality

## Hypothesized Root Cause

Based on the bug description, the root cause is confirmed:

1. **Type Mismatch in handleSelection**: The `USelectMenu` component with `value-key="value"` emits the raw primitive value (the `value` field of the selected item), not the full `SelectMenuItem` object. The handler signature `handleSelection(item: SelectMenuItem | null)` is incorrect — it should accept `string | null`.

2. **Property Access on Primitive**: `item?.value` on a string like `"user_abc"` evaluates to `undefined` (strings don't have a `.value` property). The `?? null` fallback then converts this to `null`, which is sent to the API.

3. **UI Placement Issue**: The StepAssignmentDropdown is rendered in a separate `<div>` below the StepTracker in `jobs/[id].vue`, making it visually disconnected from the step columns it controls.

4. **Column Width Issue**: StepTracker step columns use `min-w-[80px]` which is too narrow to accommodate an integrated dropdown.

## Correctness Properties

Property 1: Bug Condition - handleSelection Sends Correct userId

_For any_ selection event where a user is chosen from the dropdown (the emitted value is a non-null string userId), the fixed `handleSelection` function SHALL send that exact userId string to the PATCH `/api/steps/{id}/assign` endpoint, and the assignment SHALL be persisted in the database.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Non-Assignment Behavior Unchanged

_For any_ interaction that is NOT a dropdown selection (step clicks, distribution rendering, path operations, notes), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing StepTracker functionality, navigation, and data display.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `app/components/StepAssignmentDropdown.vue`

**Function**: `handleSelection`

**Specific Changes**:
1. **Fix handler parameter type**: Change `handleSelection(item: SelectMenuItem | null)` to `handleSelection(value: string | null)` — the parameter is the raw value emitted by `USelectMenu` with `value-key="value"`
2. **Fix value extraction**: Change `const userId = item?.value ?? null` to `const userId = value ?? null` — use the raw value directly instead of accessing `.value` on it
3. **Remove unused import**: Remove the `SelectMenuItem` import from `@nuxt/ui` if it's no longer used elsewhere in the component (it's still used by `filterDropdownOptions` return type and `menuItems` computed, so it stays)

**File**: `app/components/StepTracker.vue`

**Specific Changes**:
4. **Add new props**: Add `users` (ShopUser[]) and `stepAssignments` (Record<string, string | undefined>) props so StepTracker can render the dropdown inside each step column
5. **Add assigned event**: Add an `assigned` emit so the parent page can react to assignment changes
6. **Render StepAssignmentDropdown**: Inside each step column `<div>`, add a `<StepAssignmentDropdown>` component below the existing step data
7. **Widen step columns**: Change `min-w-[80px]` to `min-w-[120px]` on step column divs to accommodate the dropdown

**File**: `app/pages/jobs/[id].vue`

**Specific Changes**:
8. **Remove separate dropdown rendering**: Remove the `<div v-if="activeUsers.length || p.steps.length">` block that renders StepAssignmentDropdown below StepTracker
9. **Pass new props to StepTracker**: Add `:users="activeUsers"` prop to the `<StepTracker>` component
10. **Wire assigned event**: Add `@assigned="onStepAssigned"` to StepTracker to handle assignment events bubbled up from the integrated dropdown

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write a pure-function test that simulates the `handleSelection` value extraction logic. Pass a raw string value (as `USelectMenu` emits) and assert the extracted userId. Run on UNFIXED code to observe the failure.

**Test Cases**:
1. **String Value Extraction Test**: Call the extraction logic with `"user_abc"` — expect `"user_abc"`, but unfixed code produces `null` (will fail on unfixed code)
2. **Null Value Extraction Test**: Call the extraction logic with `null` — expect `null`, unfixed code produces `null` (passes by coincidence)
3. **Multiple Users Test**: Simulate selecting different users in sequence — all should produce their respective userIds (will fail on unfixed code)

**Expected Counterexamples**:
- `handleSelection("user_abc")` → `userId` is `null` instead of `"user_abc"`
- Root cause confirmed: `"user_abc"?.value` is `undefined`, `undefined ?? null` is `null`

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE typeof input === 'string' DO
  result := handleSelection_fixed(input)
  ASSERT result.sentUserId === input
END FOR

FOR ALL input WHERE input === null DO
  result := handleSelection_fixed(input)
  ASSERT result.sentUserId === null
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE input === null DO
  ASSERT handleSelection_original(input).sentUserId = handleSelection_fixed(input).sentUserId
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for null/unassign selections, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Unassign Preservation**: Verify selecting "Unassigned" (null value) continues to send `null` to the API after the fix
2. **Dropdown Filter Preservation**: Verify the existing `filterDropdownOptions` logic continues to work correctly (already covered by existing Property 4 test in `dropdownFilter.property.test.ts`)
3. **Step Click Preservation**: Verify clicking step columns still emits `step-click` events with correct payload after StepTracker changes
4. **Distribution Display Preservation**: Verify step distribution data (serial counts, bottleneck badges) renders correctly after column width change

### Unit Tests

- Test `handleSelection` value extraction with string userId inputs
- Test `handleSelection` value extraction with `null` input (unassign)
- Test that StepTracker renders StepAssignmentDropdown inside each step column
- Test that step columns use `min-w-[120px]`

### Property-Based Tests

- Generate random userId strings and verify `handleSelection` sends the correct value to the API
- Generate random user lists and verify dropdown filter continues to work (existing Property 4)
- Generate random step distributions and verify StepTracker renders all data correctly after changes

### Integration Tests

- Test full assignment flow: select user → API call → database persistence → UI update
- Test unassign flow: select "Unassigned" → API call with `null` → database cleared
- Test error handling: API failure → optimistic revert → error toast displayed
