# Bugfix Requirements Document

## Introduction

Running `npm run typecheck` (`nuxt typecheck`) produces 283 TypeScript errors across the codebase. The project fails type checking completely. The errors fall into six categories: cross-layer imports violating Nuxt 4 module resolution (app/ importing from server/ via `~/server/...`), implicit `any` types on callback parameters, unsafe property access on `unknown` types, possibly-undefined values accessed without null checks, missing required properties on constructed objects, and type assignment mismatches. The root cause for the largest category (~20 errors) is that `app/` code imports types directly from `server/types/` using `~/server/...` paths, which don't resolve in Nuxt 4 where `~` maps to `app/`. This also violates the project's separation-of-concerns rule that components/pages should never import from `server/`.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `npm run typecheck` is run THEN the system reports 283 TypeScript errors and exits with a non-zero status code, indicating the codebase fails type checking

1.2 WHEN app-layer files (composables, pages) import types using `~/server/types/domain`, `~/server/types/computed`, `~/server/types/api`, or `~/server/services/jiraService` THEN the TypeScript compiler reports TS2307 "Cannot find module" errors (~20 errors) because `~` resolves to `app/` in Nuxt 4, making `~/server/...` an invalid path

1.3 WHEN callback parameters in `.map()`, `.filter()`, `.find()`, `.reduce()`, and similar array methods lack explicit type annotations and the source array is typed as `Ref<any[]>` or the generic is not inferred THEN the TypeScript compiler reports TS7006 "Parameter implicitly has an 'any' type" errors (~30+ errors)

1.4 WHEN code accesses properties on values typed as `unknown` (e.g., `row.original` in UTable templates, filter callback params without generic type specification) THEN the TypeScript compiler reports TS18046 "is of type 'unknown'" errors (~15 errors)

1.5 WHEN code accesses array elements by index (e.g., `path.steps[i]`, `existingSteps[i]`, `j1parts[i]`, `path1.steps[3]`) or optional chain results (e.g., `pathNotes[p.id].length`) without null/undefined checks THEN the TypeScript compiler reports TS2532/TS18048 "possibly undefined" errors (~80 errors across server services and seed script)

1.6 WHEN Part objects are constructed in `partService.ts` without `status` and `forceCompleted` properties, or TemplateStep objects are constructed in `templateService.ts` without `optional` and `dependencyType` properties, or Path objects are constructed without `advancementMode` THEN the TypeScript compiler reports TS2322/TS2741 "missing property" errors (~5 errors)

1.7 WHEN `v-for` `:key` bindings use values typed as `unknown` (e.g., in `parts-browser/index.vue`) or table column definitions don't match the expected UTable generic type (e.g., in `jira.vue`) THEN the TypeScript compiler reports TS2322 type assignment mismatch errors (~5 errors)

### Expected Behavior (Correct)

2.1 WHEN `npm run typecheck` is run THEN the system SHALL report zero TypeScript errors and exit with a zero status code

2.2 WHEN app-layer files need domain, computed, or API types that are defined in `server/types/` THEN the system SHALL provide those types via shared type definition files accessible from `app/` (e.g., `app/types/` re-exporting or mirroring the needed types) so that imports use valid `~/types/...` paths, and no `app/` file SHALL import directly from `server/`

2.3 WHEN callback parameters are used in `.map()`, `.filter()`, `.find()`, `.reduce()`, and similar array methods THEN the system SHALL have explicit type annotations on those parameters, or the source arrays/refs SHALL be properly typed so TypeScript can infer the callback parameter types without falling back to implicit `any`

2.4 WHEN code accesses properties on values that could be `unknown` (e.g., UTable row data, filter callbacks) THEN the system SHALL properly type the generic parameters of UTable and accessor functions, or use type assertions/narrowing so that property access is type-safe

2.5 WHEN code accesses array elements by index or optional properties that could be undefined THEN the system SHALL include proper null/undefined checks, guard clauses, or non-null assertions (where the value is guaranteed to exist by program logic) before accessing the value

2.6 WHEN domain objects (Part, TemplateStep, Path) are constructed in service code THEN the system SHALL include all required properties as defined in the domain type interfaces (`server/types/domain.ts`)

2.7 WHEN template bindings use dynamic values as `:key` or table column definitions are provided to UTable THEN the system SHALL properly type or cast those values so they satisfy the expected TypeScript types (`PropertyKey` for keys, correct column generic for UTable)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN server-layer code (`server/`) imports types from `server/types/` using relative paths THEN the system SHALL CONTINUE TO resolve those imports correctly via relative paths without any changes to server-side import patterns

3.2 WHEN test files (`tests/`) import from `~/server/...` or `~/app/...` THEN the system SHALL CONTINUE TO resolve those imports correctly via the vitest `~` alias that points to project root

3.3 WHEN composables call `$fetch` to API routes and manage reactive UI state THEN the system SHALL CONTINUE TO function identically at runtime — the fixes are type-level only and SHALL NOT change any runtime behavior

3.4 WHEN services perform business logic (validation, domain invariants, computed state, cross-entity orchestration) THEN the system SHALL CONTINUE TO produce identical results — adding null checks and missing properties SHALL NOT alter existing logic paths for valid inputs

3.5 WHEN the seed script (`server/scripts/seed.ts`) creates sample data THEN the system SHALL CONTINUE TO generate the same seed data — null checks on array access SHALL only guard against impossible states, not change control flow

3.6 WHEN `npm run test` is run THEN all existing tests (873+ across 149 files) SHALL CONTINUE TO pass without modification to test files (unless a test file itself has typecheck errors that need fixing)
