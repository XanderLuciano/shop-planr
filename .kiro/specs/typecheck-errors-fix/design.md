# TypeScript Typecheck Errors Bugfix Design

## Overview

The codebase has 283 TypeScript errors reported by `npm run typecheck` (`nuxt typecheck`), spanning 6 error categories. The fix strategy is purely type-level: create a shared types layer (`app/types/`) to break cross-layer imports, add explicit type annotations to callback parameters, narrow `unknown` types via generics or type guards, add null/undefined checks on array index access, supply missing required properties on constructed objects, and fix template binding types. No runtime behavior changes.

## Glossary

- **Bug_Condition (C)**: Any TypeScript source file that produces one or more `tsc` errors when `npm run typecheck` is run
- **Property (P)**: After the fix, `npm run typecheck` exits with zero errors and zero status code
- **Preservation**: All existing runtime behavior, test results (873+ tests), and server-side import patterns remain unchanged
- **Cross-layer import**: An `app/` file importing from `~/server/...`, which violates both Nuxt 4 module resolution (`~` → `app/`) and the project's separation-of-concerns rule
- **Shared types layer**: `app/types/` directory containing re-exported type definitions that both app-layer and (indirectly) server-layer agree on, accessible via `~/types/...` from app code

## Bug Details

### Bug Condition

The bug manifests when `npm run typecheck` is executed. The TypeScript compiler reports 283 errors across 6 categories because the codebase contains type-level violations that were not caught during development (dev server and tests still work at runtime).

**Formal Specification:**
```
FUNCTION isBugCondition(file)
  INPUT: file of type TypeScriptSourceFile
  OUTPUT: boolean

  errors := runTypescriptCompiler(file)
  RETURN errors.length > 0
         AND errors.any(e =>
           e.code IN [TS2307, TS7006, TS18046, TS2532, TS18048, TS2322, TS2741]
         )
END FUNCTION
```

### Error Categories

**Category 1 — Cross-layer imports (TS2307, ~20 errors):**
- 23 composables + 20+ components/pages import types via `~/server/types/domain`, `~/server/types/computed`, `~/server/types/api`, or `~/server/services/jiraService`
- In Nuxt 4, `~` resolves to `app/`, so `~/server/types/domain` resolves to `app/server/types/domain` which doesn't exist

**Category 2 — Implicit any (TS7006, ~30 errors):**
- Callback parameters in `.map()`, `.filter()`, `.find()`, `.reduce()` lack type annotations
- Source arrays typed as `Ref<any[]>` or generics not inferred

**Category 3 — Unsafe unknown access (TS18046, ~15 errors):**
- UTable slot `row.original` is typed as `unknown` when the generic isn't specified
- Filter callbacks receive `unknown` params

**Category 4 — Possibly undefined (TS2532/TS18048, ~80 errors):**
- Array index access (`path.steps[i]`, `j1parts[i]`) without null checks
- Optional chain results used without guards
- Concentrated in `server/services/`, `server/scripts/seed.ts`, and `app/composables/`

**Category 5 — Missing properties (TS2322/TS2741, ~5 errors):**
- `partService.ts`: Part objects constructed without `status` and `forceCompleted`
- `templateService.ts`: TemplateStep objects constructed without `optional` and `dependencyType`
- `pathService.ts`: Path objects constructed without `advancementMode`

**Category 6 — Type assignment mismatches (TS2322, ~5 errors):**
- `v-for :key` bindings using values typed as `unknown`
- UTable column definitions not matching expected generic type

### Examples

- **Category 1**: `app/composables/useJobs.ts` has `import type { Job } from '~/server/types/domain'` → TS2307 because `~/server/types/domain` resolves to `app/server/types/domain` which doesn't exist
- **Category 1**: `app/pages/jira.vue` has `import type { JiraTicket } from '~/server/services/jiraService'` → TS2307, and this also imports from a service file (not just types)
- **Category 2**: `parts.map(s => s.jobName)` where `parts` is `Ref<any[]>` → TS7006 on `s`
- **Category 3**: UTable slot `row.original.key` where `row.original` is `unknown` → TS18046
- **Category 4**: `path.steps[i]` in a loop without `!` or guard → TS2532 "Object is possibly undefined"
- **Category 5**: `{ id, jobId, pathId, currentStepIndex: 0, createdAt: now, updatedAt: now }` missing `status` and `forceCompleted` → TS2741
- **Category 6**: `v-for="s in filteredParts" :key="s.id"` where `s` is `unknown` → TS2322

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All server-side relative imports (`../types/domain`, `../types/api`, etc.) continue to resolve correctly
- Test files (`tests/`) continue to use `~/server/...` and `~/app/...` via vitest's `~` alias pointing to project root
- All 873+ existing tests continue to pass without modification
- All runtime behavior (composable `$fetch` calls, service business logic, seed script output) remains identical
- The seed script continues to generate the same sample data
- Server code in `server/` never uses `~` imports (relative paths only)

**Scope:**
All changes are type-level only. No runtime logic changes. The only structural change is creating `app/types/` files that re-export types from a shared location. Null checks added to array index access guard against impossible states and do not alter control flow for valid inputs.

## Hypothesized Root Cause

Based on the bug description, the root causes are:

1. **Nuxt 4 module resolution mismatch**: The project was developed with `~` aliased to project root (as in Nuxt 3), but Nuxt 4 changed `~` to resolve to `app/`. Cross-layer imports `~/server/...` worked at runtime via dev server but fail under strict `nuxt typecheck`.

2. **Missing type annotations on callbacks**: Many composables and components use `.map()`, `.filter()` etc. on arrays where the element type isn't inferred (often because the source is `Ref<any[]>` or the generic isn't propagated). TypeScript's `noImplicitAny` (or strict mode) flags these.

3. **UTable generic not specified**: Nuxt UI's `UTable` component uses generics for row data. When the generic isn't provided, slot params default to `unknown`, causing TS18046 on `row.original.*` access.

4. **Strict array index checking**: TypeScript's `noUncheckedIndexedAccess` (or similar strict checks) treats `array[i]` as `T | undefined`. The codebase accesses array elements by index extensively in services and the seed script without null guards.

5. **Incomplete object construction**: Service factory functions construct domain objects (Part, TemplateStep, Path) with object literals that omit required properties added later to the domain interfaces (e.g., `status`, `forceCompleted`, `optional`, `dependencyType`, `advancementMode`).

6. **JiraTicket type in service file**: `app/pages/jira.vue` and `app/composables/useJira.ts` import `JiraTicket` from `~/server/services/jiraService` — this is both a cross-layer violation and imports from a service (not a types file).

## Correctness Properties

Property 1: Bug Condition - Zero Typecheck Errors

_For any_ run of `npm run typecheck` after all fixes are applied, the TypeScript compiler SHALL report zero errors and exit with status code 0.

**Validates: Requirements 2.1**

Property 2: Preservation - Existing Tests Pass

_For any_ run of `npm run test` after all fixes are applied, all existing tests (873+ across 149 files) SHALL continue to pass without modification to test files, preserving all runtime behavior.

**Validates: Requirements 3.3, 3.4, 3.5, 3.6**

Property 3: Preservation - Server Import Patterns Unchanged

_For any_ file in `server/`, no import statement SHALL use the `~` alias. All server imports SHALL remain relative paths. No server file SHALL be modified to change its export signatures.

**Validates: Requirements 3.1**

Property 4: Preservation - Test Import Patterns Unchanged

_For any_ file in `tests/`, import paths using `~/server/...` or `~/app/...` SHALL continue to resolve correctly via the vitest `~` alias.

**Validates: Requirements 3.2**

Property 5: Bug Condition - No Cross-Layer Imports

_For any_ file in `app/` (components, pages, composables), no import statement SHALL reference `~/server/` directly. All type imports SHALL use `~/types/...` paths pointing to the shared types layer in `app/types/`.

**Validates: Requirements 2.2**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

#### Category 1 Fix: Shared Types Layer (`app/types/`)

**Decision**: Create `app/types/` files that re-export the needed types. App code imports from `~/types/...` (which resolves to `app/types/...`). Server code continues using relative imports. The server type files (`server/types/domain.ts`, `server/types/computed.ts`, `server/types/api.ts`) remain the single source of truth — `app/types/` files re-export from relative paths that resolve at build time.

**Files to create:**
1. `app/types/domain.ts` — re-exports all domain types needed by app code from `../../server/types/domain`
2. `app/types/computed.ts` — re-exports all computed types needed by app code from `../../server/types/computed`
3. `app/types/api.ts` — re-exports all API input types needed by app code from `../../server/types/api`
4. `app/types/jira.ts` — re-exports `JiraTicket`, `FetchTicketsResult`, `JiraPushResult` from `../../server/services/jiraService`

**Files to update (~43 files):**
- All 23 composables: change `~/server/types/domain` → `~/types/domain`, `~/server/types/computed` → `~/types/computed`, `~/server/types/api` → `~/types/api`, `~/server/services/jiraService` → `~/types/jira`
- All 20+ components/pages with cross-layer imports: same pattern

#### Category 2 Fix: Explicit Type Annotations

**Files to update:** Composables and components with `.map()`, `.filter()`, `.find()`, `.reduce()` callbacks on untyped arrays.

**Specific Changes:**
- Add explicit parameter types to callback functions where inference fails
- Ensure source `Ref<>` generics are properly typed (e.g., `ref<Part[]>([])` instead of `ref([])`)

#### Category 3 Fix: UTable Generic Types and Unknown Narrowing

**Files to update:** `app/pages/jira.vue`, `app/pages/jobs/index.vue`, `app/pages/parts-browser/index.vue`, and any other component using UTable slots.

**Specific Changes:**
- Type UTable column definitions with the proper generic: `TableColumn<JiraTicket>[]` instead of bare object arrays
- Where UTable slots expose `row.original` as `unknown`, either specify the generic on UTable or cast `row.original` to the known type
- Add type narrowing for filter callbacks that receive `unknown` params

#### Category 4 Fix: Null/Undefined Guards on Array Access

**Files to update:** `server/services/partService.ts`, `server/services/pathService.ts`, `server/services/lifecycleService.ts`, `server/scripts/seed.ts`, and composables with array index access.

**Specific Changes:**
- For array access in loops where the index is guaranteed valid by loop bounds, use non-null assertion (`!`) with a comment explaining the invariant
- For array access where the value could genuinely be undefined, add proper null checks or guard clauses
- In the seed script, use non-null assertions since the data was just created and indices are known valid

#### Category 5 Fix: Supply Missing Required Properties

**File**: `server/services/partService.ts`
- Add `status: 'in_progress'` and `forceCompleted: false` to Part object construction in `batchCreateParts`

**File**: `server/services/templateService.ts`
- Add `optional: false` and `dependencyType: 'preferred'` to TemplateStep construction in `createTemplate` (already present in `updateTemplate`)

**File**: `server/services/pathService.ts`
- Add `advancementMode: 'strict'` (or use input value) to Path construction where missing

#### Category 6 Fix: Template Binding Types

**Files to update:** `app/pages/parts-browser/index.vue`, `app/pages/jira.vue`

**Specific Changes:**
- Cast `:key` values to `string` where the source type is `unknown`
- Type UTable column arrays with the correct generic to satisfy column type constraints

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, confirm the bug exists by running `npm run typecheck` on unfixed code and observing the 283 errors, then verify the fix eliminates all errors while preserving existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Confirm the 283 typecheck errors exist on unfixed code and categorize them to validate our root cause analysis.

**Test Plan**: Run `npm run typecheck` on the unfixed codebase and capture the output. Categorize errors by TS error code to confirm the 6-category breakdown.

**Test Cases**:
1. **Cross-layer import test**: Run typecheck, filter for TS2307 errors in `app/` files importing `~/server/` (will fail on unfixed code)
2. **Implicit any test**: Run typecheck, filter for TS7006 errors in callback parameters (will fail on unfixed code)
3. **Unknown access test**: Run typecheck, filter for TS18046 errors on `row.original` access (will fail on unfixed code)
4. **Possibly undefined test**: Run typecheck, filter for TS2532/TS18048 errors on array index access (will fail on unfixed code)

**Expected Counterexamples**:
- `app/composables/useJobs.ts`: TS2307 on `~/server/types/domain`
- `app/pages/jira.vue`: TS2307 on `~/server/services/jiraService`
- `server/services/partService.ts`: TS2741 missing `status` on Part construction
- `server/scripts/seed.ts`: TS2532 on `j1parts[i]` array access

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed codebase produces zero typecheck errors.

**Pseudocode:**
```
FOR ALL file WHERE isBugCondition(file) DO
  result := runTypescriptCompiler(file)
  ASSERT result.errors.length == 0
END FOR
```

**Concrete verification**: Run `npm run typecheck` after all fixes. Assert exit code 0 and zero errors in output.

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (non-type-error code paths), the fixed codebase produces identical runtime behavior.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalBehavior(input) = fixedBehavior(input)
END FOR
```

**Testing Approach**: Since all changes are type-level only (import paths, type annotations, non-null assertions, missing property defaults), preservation is verified by running the full test suite. Property-based tests provide strong coverage across random inputs.

**Test Plan**: Run `npm run test` after all fixes. Assert all 873+ tests pass. Specifically verify:

**Test Cases**:
1. **Service test preservation**: All 10 service unit test files pass — confirms adding missing properties and null guards doesn't change business logic
2. **Property test preservation**: All 30+ property test files pass — confirms type-level changes don't affect domain invariants
3. **Integration test preservation**: All 16 integration test files pass — confirms end-to-end flows work identically
4. **Composable test preservation**: All 4 composable test files pass — confirms import path changes don't break composable behavior

### Unit Tests

- Verify `app/types/domain.ts` re-exports all types used by app code (import and use each type)
- Verify `app/types/computed.ts` re-exports all computed types used by app code
- Verify `app/types/api.ts` re-exports all API input types used by app code
- Verify `app/types/jira.ts` re-exports JiraTicket and related types
- Verify no `app/` file imports from `~/server/` (grep-based assertion)

### Property-Based Tests

- Generate random Part objects and verify `batchCreateParts` always includes `status` and `forceCompleted` properties
- Generate random TemplateStep inputs and verify `createTemplate` always includes `optional` and `dependencyType`
- Generate random array lengths and verify null-guarded index access never throws on valid indices

### Integration Tests

- Run full job lifecycle (create job → create path → batch create parts → advance → complete) and verify identical results
- Run seed script and verify it completes without errors
- Run typecheck and verify zero errors (the ultimate integration test for this bugfix)
