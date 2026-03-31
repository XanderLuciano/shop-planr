# Implementation Plan: TypeScript Typecheck Errors Bugfix

## Overview

Fix 283 TypeScript errors reported by `npm run typecheck` across 6 categories. The fix strategy is purely type-level: create a shared types layer (`app/types/`), update cross-layer imports, add explicit type annotations, narrow `unknown` types, add null/undefined guards, supply missing required properties, and fix template binding types. No runtime behavior changes. Uses the bug condition methodology: explore the bug with a failing test, write preservation tests, then implement the fix and verify.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** — Typecheck Produces Errors on Unfixed Code
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases — grep `app/` files for `~/server/` imports and assert none exist
  - Test file: `tests/properties/typecheckBugCondition.property.test.ts`
  - Write a property-based test using `fast-check` that generates random selections from the list of known cross-layer import files (composables, pages, components) and asserts that none of them contain `~/server/` import paths
  - The test reads actual file contents from disk and checks for the `~/server/` import pattern
  - On UNFIXED code, files like `app/composables/useJobs.ts`, `app/pages/jira.vue`, etc. contain `~/server/types/domain` imports — the test will FAIL
  - Also assert that `app/types/domain.ts`, `app/types/computed.ts`, `app/types/api.ts`, and `app/types/jira.ts` exist (they won't on unfixed code — FAIL)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this proves the cross-layer import bug exists and shared types layer is missing)
  - Document counterexamples found (e.g., `app/composables/useJobs.ts` contains `import type { Job } from '~/server/types/domain'`)
  - _Requirements: 1.2, 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** — Server Imports and Test Suite Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `tests/properties/typecheckPreservation.property.test.ts`
  - **Test 1 — Server files use relative imports only**: Generate random selections from `server/` TypeScript files. Assert none contain `~/` or `~\\` import paths. Verify passes on UNFIXED code (server code already uses relative imports).
  - **Test 2 — Test files resolve vitest aliases**: Generate random selections from `tests/` TypeScript files that import `~/server/` or `~/app/`. Assert the import paths follow the vitest alias pattern (`~/server/...` or `~/app/...`). Verify passes on UNFIXED code.
  - **Test 3 — Domain type exports are complete**: Import all domain types from `server/types/domain.ts`, `server/types/computed.ts`, `server/types/api.ts` and assert they are defined (not undefined). Verify passes on UNFIXED code.
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.6_

- [x] 3. Create shared types layer in `app/types/`

  - [x] 3.1 Create `app/types/domain.ts`
    - Re-export all domain types used by app code from `../../server/types/domain`
    - Include: `Job`, `Path`, `ProcessStep`, `Part`, `SerialNumber`, `Certificate`, `CertAttachment`, `TemplateRoute`, `TemplateStep`, `BOM`, `BomEntry`, `AuditEntry`, `AuditAction`, `ShopUser`, `StepNote`, `PageToggles`, `AppSettings`, `JiraConnectionSettings`, `JiraFieldMapping`, `FilterState`, `PartStepStatus`, `PartStepStatusValue`, `PartStepOverride`, `ScrapReason`, `BomVersion`, `ProcessLibraryEntry`, `LocationLibraryEntry`
    - Use `export type { ... } from '../../server/types/domain'` syntax
    - _Requirements: 2.2_

  - [x] 3.2 Create `app/types/computed.ts`
    - Re-export all computed/view types used by app code from `../../server/types/computed`
    - Include: `JobProgress`, `StepDistribution`, `BomSummary`, `BomEntrySummary`, `OperatorStepView`, `OperatorPartInfo`, `EnrichedPart`, `EnrichedSerial`, `WorkQueueJob`, `WorkQueueResponse`, `OperatorGroup`, `WorkQueueGroupedResponse`, `StepViewResponse`, `AdvancementResult`, `PartStepStatusView`, `SnStepStatusView`
    - _Requirements: 2.2_

  - [x] 3.3 Create `app/types/api.ts`
    - Re-export all API input types used by app code from `../../server/types/api`
    - Include: `CreateJobInput`, `UpdateJobInput`, `CreatePathInput`, `UpdatePathInput`, `BatchCreatePartsInput`, `AdvancePartInput`, `AttachCertInput`, `CreateCertInput`, `BatchAttachCertInput`, `CreateTemplateInput`, `ApplyTemplateInput`, `CreateBomInput`, `AssignStepInput`, `LinkJiraInput`, `PushToJiraInput`, `PushNoteToJiraInput`, `ScrapPartInput`, `ForceCompleteInput`, `AdvanceToStepInput`, `CompleteDeferredStepInput`, `WaiveStepInput`, `CreateStepOverrideInput`, `EditBomInput`, `UpdateAdvancementModeInput`, `CreateLibraryEntryInput`
    - _Requirements: 2.2_

  - [x] 3.4 Create `app/types/jira.ts`
    - Re-export `JiraTicket`, `FetchTicketsResult`, `JiraPushResult` from `../../server/services/jiraService`
    - These types are used by `app/pages/jira.vue` and `app/composables/useJira.ts`
    - _Requirements: 2.2_

- [x] 4. Update app-layer imports to use shared types layer (~43 files)

  - [x] 4.1 Update composable imports
    - Update all ~23 composables in `app/composables/` to import from `~/types/domain`, `~/types/computed`, `~/types/api`, or `~/types/jira` instead of `~/server/types/domain`, `~/server/types/computed`, `~/server/types/api`, or `~/server/services/jiraService`
    - Search for `from '~/server/types/` and `from '~/server/services/` in `app/composables/`
    - Replace each import path: `~/server/types/domain` → `~/types/domain`, `~/server/types/computed` → `~/types/computed`, `~/server/types/api` → `~/types/api`, `~/server/services/jiraService` → `~/types/jira`
    - _Bug_Condition: isBugCondition(file) where file imports from ~/server/ and file is in app/_
    - _Requirements: 1.2, 2.2_

  - [x] 4.2 Update component and page imports
    - Update all ~20 components/pages in `app/components/` and `app/pages/` with cross-layer imports
    - Same pattern: `~/server/types/domain` → `~/types/domain`, `~/server/types/computed` → `~/types/computed`, `~/server/types/api` → `~/types/api`, `~/server/services/jiraService` → `~/types/jira`
    - Search for `from '~/server/` in `app/components/` and `app/pages/`
    - _Bug_Condition: isBugCondition(file) where file imports from ~/server/ and file is in app/_
    - _Requirements: 1.2, 2.2_

- [x] 5. Add explicit type annotations to callback parameters (~30 errors)

  - [x] 5.1 Fix implicit `any` in composables
    - Search `app/composables/` for TS7006-prone patterns: `.map(`, `.filter(`, `.find(`, `.reduce(`, `.forEach(`, `.some(`, `.every(` on arrays typed as `Ref<any[]>` or with unresolved generics
    - Add explicit type annotations to callback parameters (e.g., `(s: Part) =>` instead of `(s) =>`)
    - Where the source `ref()` lacks a generic, add it (e.g., `ref<Part[]>([])` instead of `ref([])`)
    - _Requirements: 1.3, 2.3_

  - [x] 5.2 Fix implicit `any` in components and pages
    - Search `app/components/` and `app/pages/` for the same TS7006-prone callback patterns
    - Add explicit type annotations to callback parameters in `<script setup>` blocks
    - _Requirements: 1.3, 2.3_

- [x] 6. Fix UTable generic types and unknown narrowing (~15 errors)

  - [x] 6.1 Type UTable column definitions with proper generics
    - In `app/pages/jira.vue`, `app/pages/jobs/index.vue`, `app/pages/parts-browser/index.vue`, and other UTable users
    - Type column arrays with the correct generic: e.g., `TableColumn<JiraTicket>[]`
    - Where UTable slots expose `row.original` as `unknown`, specify the generic on UTable or cast `row.original` to the known type
    - _Requirements: 1.4, 2.4_

  - [x] 6.2 Add type narrowing for filter callbacks
    - Where filter callbacks receive `unknown` params, add type assertions or narrowing
    - _Requirements: 1.4, 2.4_

- [x] 7. Add null/undefined guards on array access (~80 errors)

  - [x] 7.1 Fix possibly-undefined in server services
    - Files: `server/services/partService.ts`, `server/services/pathService.ts`, `server/services/lifecycleService.ts`, and other services with array index access
    - For array access in loops where the index is guaranteed valid by loop bounds, use non-null assertion (`!`) with a comment explaining the invariant
    - For array access where the value could genuinely be undefined, add proper null checks or guard clauses
    - _Bug_Condition: isBugCondition(file) where file has array[i] access without null check_
    - _Requirements: 1.5, 2.5_

  - [x] 7.2 Fix possibly-undefined in seed script
    - File: `server/scripts/seed.ts`
    - Use non-null assertions for array access where data was just created and indices are known valid
    - Add comments explaining why the assertion is safe
    - _Requirements: 1.5, 2.5, 3.5_

  - [x] 7.3 Fix possibly-undefined in composables
    - Search `app/composables/` for TS2532/TS18048 patterns
    - Add null checks or non-null assertions as appropriate
    - _Requirements: 1.5, 2.5_

- [x] 8. Supply missing required properties on constructed objects (~5 errors)

  - [x] 8.1 Fix Part construction in `partService.ts`
    - Add `status: 'in_progress'` and `forceCompleted: false` to Part object construction in `batchCreateParts`
    - _Requirements: 1.6, 2.6_

  - [x] 8.2 Fix TemplateStep construction in `templateService.ts`
    - Add `optional: false` and `dependencyType: 'preferred'` to TemplateStep construction in `createTemplate`
    - _Requirements: 1.6, 2.6_

  - [x] 8.3 Fix Path construction in `pathService.ts`
    - Add `advancementMode: 'strict'` (or use input value) to Path construction where missing
    - _Requirements: 1.6, 2.6_

- [x] 9. Fix template binding types (~5 errors)

  - [x] 9.1 Fix `:key` bindings on `unknown` values
    - In `app/pages/parts-browser/index.vue` and other templates with `v-for` over `unknown` typed items
    - Cast `:key` values to `string` or `PropertyKey` where the source type is `unknown`
    - _Requirements: 1.7, 2.7_

  - [x] 9.2 Fix UTable column type mismatches
    - In `app/pages/jira.vue` and other pages where column definitions don't match the expected UTable generic
    - Ensure column arrays are typed to satisfy the UTable component's generic constraints
    - _Requirements: 1.7, 2.7_

- [x] 10. Verify fixes

  - [x] 10.1 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** — No Cross-Layer Imports After Fix
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 asserts no `~/server/` imports in app files and that `app/types/` files exist
    - When this test passes, it confirms the cross-layer import bug is resolved
    - Run bug condition exploration test from task 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms cross-layer imports are fixed)
    - _Requirements: 2.2_

  - [x] 10.2 Verify preservation tests still pass
    - **Property 2: Preservation** — Server Imports and Test Suite Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from task 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - _Requirements: 3.1, 3.2_

  - [x] 10.3 Run `npm run typecheck` and verify zero errors
    - Run `npm run typecheck` (or `npx nuxt typecheck`)
    - Assert exit code 0 and zero TypeScript errors in output
    - If errors remain, fix them iteratively until clean
    - _Requirements: 2.1_

  - [x] 10.4 Run `npm run test` and verify all tests pass
    - Run `npx vitest run` to execute all 873+ tests across 149 files
    - Assert all tests pass without modification to test files (unless a test file itself had typecheck errors)
    - _Requirements: 3.3, 3.4, 3.5, 3.6_

- [-] 11. Checkpoint — Ensure all tests pass
  - Run `npx vitest run` to verify all tests pass
  - Run `npm run typecheck` to verify zero TypeScript errors
  - Confirm no `app/` file imports from `~/server/` (grep check)
  - Confirm all server files still use relative imports only
  - Ask the user if questions arise
