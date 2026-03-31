# Design Document — Readonly Domain Types

## Overview

This refactor converts all array properties in domain type interfaces from mutable `T[]` to `readonly T[]`, removes ~20 `as Type` casts from Vue files that exist solely to bridge Nuxt's `Readonly<>` wrapper, and fixes any server-side code that mutates arrays after construction.

The root cause: Nuxt's `$fetch` wraps API responses in `DeepReadonly<>`, but domain types declare mutable arrays (`string[]`, `BomEntry[]`, etc.). Since the data is never mutated after construction, the types should reflect that. Once they do, `Readonly<T[]>` is assignable to `readonly T[]`, and the casts disappear naturally.

This is a pure type-level refactor — zero runtime behavior changes.

### Scope

- 3 type definition files: `server/types/domain.ts`, `server/types/computed.ts`, `server/services/jiraService.ts`
- 1 API input type file: `server/types/api.ts`
- ~9 Vue files with `as Type` casts to remove
- Server-side service/repository code that uses `.push()` on local arrays before assigning to domain properties (already compatible — local `T[]` assigns to `readonly T[]`)
- Function signatures that accept `T[]` but receive `readonly T[]` from domain objects

### Design Rationale

1. `readonly T[]` is the correct type for data that is never mutated after construction
2. `Readonly<T[]>` (Nuxt's wrapper) is assignable to `readonly T[]` without casts
3. Mutable `T[]` is assignable to `readonly T[]`, so server-side code that builds arrays locally with `.push()` then assigns them to domain properties continues to work
4. The only breakage is code that passes a `readonly T[]` to a function expecting `T[]` — those function signatures need updating

## Architecture

No architectural changes. The refactor touches only TypeScript type declarations and type assertions. The layer stack remains:

```
Components/Pages → Composables → API Routes → Services → Repositories → SQLite
```

### Change Flow

```mermaid
graph TD
    A[domain.ts / computed.ts / jiraService.ts / api.ts] -->|"T[] → readonly T[]"| B[Type definitions updated]
    B --> C[Re-export layer propagates automatically]
    C --> D["Vue files: Readonly<T[]> now assignable to readonly T[]"]
    D --> E["Remove ~20 'as Type' casts"]
    B --> F[Server code: local T[] still assigns to readonly T[]]
    F --> G["Fix function signatures: T[] → readonly T[]"]
```

### Compatibility Model

| Assignment direction | Before | After |
|---------------------|--------|-------|
| `$fetch` response → Vue binding | ❌ needs `as Type` cast | ✅ direct assignment |
| Local `T[]` → domain property | ✅ works | ✅ still works (mutable assigns to readonly) |
| Domain `readonly T[]` → function `T[]` param | ✅ works (was mutable) | ❌ needs signature update |
| Domain `readonly T[]` → spread/map/filter | ✅ works | ✅ works (non-mutating ops accept readonly) |

## Components and Interfaces

### Type Definition Changes

#### `server/types/domain.ts`

| Interface | Property | Before | After |
|-----------|----------|--------|-------|
| `Job` | `jiraLabels` | `string[]` | `readonly string[]` |
| `Path` | `steps` | `ProcessStep[]` | `readonly ProcessStep[]` |
| `TemplateRoute` | `steps` | `TemplateStep[]` | `readonly TemplateStep[]` |
| `BOM` | `entries` | `BomEntry[]` | `readonly BomEntry[]` |
| `BomEntry` | `contributingJobIds` | `string[]` | `readonly string[]` |
| `StepNote` | `partIds` | `string[]` | `readonly string[]` |
| `BomVersion` | `entriesSnapshot` | `BomEntry[]` | `readonly BomEntry[]` |

#### `server/types/computed.ts`

| Interface | Property | Before | After |
|-----------|----------|--------|-------|
| `OperatorStepView` | `stepIds` | `string[]` | `readonly string[]` |
| `OperatorStepView` | `currentParts` | `OperatorPartInfo[]` | `readonly OperatorPartInfo[]` |
| `OperatorStepView` | `comingSoon` | `OperatorPartInfo[]` | `readonly OperatorPartInfo[]` |
| `OperatorStepView` | `backlog` | `OperatorPartInfo[]` | `readonly OperatorPartInfo[]` |
| `WorkQueueJob` | `partIds` | `string[]` | `readonly string[]` |
| `BomSummary` | `entries` | `BomEntrySummary[]` | `readonly BomEntrySummary[]` |
| `AdvancementResult` | `bypassed` | `{ stepId: string; stepName: string; classification: 'skipped' | 'deferred' }[]` | `readonly { stepId: string; stepName: string; classification: 'skipped' | 'deferred' }[]` |

#### `server/services/jiraService.ts`

| Interface | Property | Before | After |
|-----------|----------|--------|-------|
| `JiraTicket` | `labels` | `string[]` | `readonly string[]` |
| `FetchTicketsResult` | `tickets` | `JiraTicket[]` | `readonly JiraTicket[]` |

#### `server/types/api.ts`

| Interface | Property | Before | After |
|-----------|----------|--------|-------|
| `BatchAttachCertInput` | `partIds` | `string[]` | `readonly string[]` |
| `CreateStepOverrideInput` | `partIds` | `string[]` | `readonly string[]` |
| `CreateBomInput.entries[]` | `contributingJobIds` | `string[]` | `readonly string[]` |
| `EditBomInput.entries[]` | `contributingJobIds` | `string[]` | `readonly string[]` |

### Cast Removal Sites

| File | Cast | Reason for removal |
|------|------|--------------------|
| `app/pages/parts/step/[stepId].vue` | `job as WorkQueueJob` (×2) | `Readonly<WorkQueueJob>` now assignable |
| `app/pages/parts/step/[stepId].vue` | `notes as StepNote[]` | `Readonly<StepNote[]>` now assignable |
| `app/pages/bom.vue` | `jobs as Job[]` (×2), `b as BOM` (×2) | `Readonly<>` now assignable |
| `app/pages/audit.vue` | `entries as AuditEntry[]` | `Readonly<>` now assignable |
| `app/pages/parts-browser/[id].vue` | `as unknown as EnrichedPart[]` | `Readonly<>` now assignable |
| `app/pages/jobs/index.vue` | `as Job[]` (×2) | `Readonly<>` now assignable |
| `app/components/JobCreationForm.vue` | `as TemplateRoute[]` (×2) | `Readonly<>` now assignable |
| `app/pages/jira.vue` | `as JiraTicket[]` | `Readonly<>` now assignable |
| `app/pages/settings.vue` | `as JiraFieldMapping[]` | `Readonly<>` now assignable |
| `app/pages/templates.vue` | `as TemplateRoute` (×3) | `Readonly<>` now assignable |

### Casts to Retain

- `route.params.id as string` — legitimate route param narrowing
- `as const` assertions — unrelated to `Readonly<>` gap
- Event handler casts — unrelated to domain types

### Server-Side Construction Patterns

Most server-side `.push()` usage is on local temporary arrays that are assigned to domain properties only after construction. These are already compatible because mutable `T[]` assigns to `readonly T[]`.

| File | Pattern | Action needed |
|------|---------|---------------|
| `server/services/lifecycleService.ts` | `blockers: string[]` local array, `.push()`, return | None — local mutable array assigned to return type |
| `server/services/lifecycleService.ts` | `bypassed` local array, `.push()`, then mapped to `bypassedResult` | None — local mutable array |
| `server/services/lifecycleService.ts` | `bypassedResult` local array, `.push()` | None — local mutable array assigned to `AdvancementResult.bypassed` |
| `server/services/lifecycleService.ts` | `incompleteStepIds` local array, `.push()` | None — local mutable array |
| `server/services/lifecycleService.ts` | `overrides` local array, `.push()` | None — local mutable array |
| `server/services/jobService.ts` | `reasons` local array, `.push()` | None — local mutable array |
| `server/services/pathService.ts` | `toUpdate`, `toInsert`, `toDelete` local arrays | None — local mutable arrays |
| `server/services/jiraService.ts` | `tables`, `lines`, `certLines` local arrays | None — local mutable arrays |
| `server/repositories/sqlite/certRepository.ts` | `results` local array, `.push()` | None — local mutable array |
| `server/repositories/sqlite/bomRepository.ts` | `contribMap` local Map with `.push()` | None — local mutable array |

### Function Signature Updates

Functions that accept domain arrays as parameters need `readonly` added:

| File | Function/Parameter | Before | After |
|------|-------------------|--------|-------|
| `server/repositories/sqlite/templateRepository.ts` | `rowToDomain(row, steps: TemplateStep[])` | `TemplateStep[]` | `readonly TemplateStep[]` |
| Any service/utility accepting domain array params | Various | `T[]` | `readonly T[]` |

These will be identified exhaustively during implementation by running `npm run typecheck` after the type changes and fixing each error.

## Data Models

No data model changes. This refactor is purely at the TypeScript type level. The SQLite schema, repository row types, and serialization logic are unaffected.

The only "data" change is that TypeScript interfaces now declare array properties as `readonly`, which:
- Has zero runtime representation (TypeScript types are erased at compile time)
- Does not affect JSON serialization/deserialization
- Does not affect SQLite row-to-domain mapping functions (they return fresh objects)


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Readonly array constraint on domain types

*For any* domain type interface that declares an array property (across `server/types/domain.ts`, `server/types/computed.ts`, `server/services/jiraService.ts`, and `server/types/api.ts`), constructing an object that satisfies the interface and then attempting to call a mutating array method (`.push()`, `.pop()`, `.splice()`) on that property should be a compile-time error — verifiable by confirming that all array properties in the canonical type list are typed as `readonly T[]`.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 5.2**

### Property 2: Serialization round-trip preservation under readonly arrays

*For any* valid domain object (Job, Path, BOM, BomEntry, TemplateRoute, StepNote, BomVersion, OperatorStepView, WorkQueueJob, BomSummary, AdvancementResult, JiraTicket, FetchTicketsResult), serializing to JSON and deserializing back should produce a structurally equivalent object. This proves that the `readonly` modifier has zero runtime effect — the serialized form is identical whether the source array is `T[]` or `readonly T[]`.

**Validates: Requirements 4.3, 1.5**

## Error Handling

This refactor introduces no new error paths. All changes are at the type level.

Potential errors during implementation and their resolution:

| Error | Cause | Resolution |
|-------|-------|------------|
| `Type 'readonly T[]' is not assignable to type 'T[]'` | Function parameter expects mutable array | Update function signature to accept `readonly T[]` |
| `Property 'push' does not exist on type 'readonly T[]'` | Code mutates a domain object's array after construction | Refactor to build array locally as `T[]`, then assign to readonly property |
| Existing tests fail to compile | Test code creates domain objects with mutable arrays | Mutable `T[]` assigns to `readonly T[]` — no change needed. If test mutates after construction, refactor test. |

No new `ValidationError` or `NotFoundError` paths are introduced. No new HTTP error codes. No new user-facing error messages.

## Testing Strategy

### Dual Testing Approach

This refactor relies on two complementary verification methods:

1. **Static verification** (typecheck): `npm run typecheck` confirms that all `readonly` constraints are satisfied, all casts are removed, and all function signatures are compatible. This is the primary correctness gate.

2. **Property-based tests** (fast-check): Verify that the readonly modifier has zero runtime effect by round-tripping domain objects through serialization.

### Property-Based Testing

Library: `fast-check` (already in the project)

Each property test must run a minimum of 100 iterations and reference its design property.

#### Property 1 Test: Readonly array constraint

Since this is a compile-time property, it is verified by `npm run typecheck` rather than a runtime test. A supplementary test can verify the constraint by introspecting the TypeScript AST or by maintaining a canonical list of `(interface, property)` pairs and asserting each is present in the type files with `readonly` syntax.

Tag: `Feature: readonly-domain-types, Property 1: Readonly array constraint on domain types`

Implementation approach:
- Maintain a list of `{ file, interface, property, expectedPattern }` tuples
- For each tuple, read the source file and assert the property declaration matches `readonly T[]`
- Use `fast-check` to generate random selections from the list and verify each

#### Property 2 Test: Serialization round-trip preservation

Tag: `Feature: readonly-domain-types, Property 2: Serialization round-trip preservation under readonly arrays`

Implementation approach:
- Generate random domain objects using `fast-check` arbitraries for each domain type with array properties
- Serialize via `JSON.stringify` then deserialize via `JSON.parse`
- Assert deep equality between original and round-tripped object
- This extends the existing CP-5 round-trip tests to explicitly cover the readonly array types

Note: The existing `roundTrip.property.test.ts` (CP-5) already covers serialization round-trips for 32 domain sub-types. Property 2 can be verified by confirming that CP-5 continues to pass after the refactor — no new test file is strictly necessary, but a focused test on the specific array-bearing types provides explicit traceability to this design.

### Unit Tests

Unit tests for this refactor are minimal since the primary verification is static (typecheck):

- Verify that the ~9 Vue files compile without `as Type` casts (covered by typecheck)
- Verify that server-side construction patterns produce valid domain objects (covered by existing service/repository tests)
- Verify that the full test suite (880+ tests) passes unchanged

### Test Execution

| Check | Command | Expected |
|-------|---------|----------|
| Type safety | `npm run typecheck` | 0 errors |
| Full test suite | `npm run test` | All 880+ tests pass |
| Property tests | `npx vitest run tests/properties` | All property tests pass |
