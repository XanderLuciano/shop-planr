# Requirements Document

## Introduction

The codebase has ~20 `as Type` casts in Vue template bindings that exist solely because Nuxt's `$fetch` wraps API responses in deep `Readonly<>` types, but domain types use mutable arrays (`string[]`, `BomEntry[]`, etc.). The data is never mutated after construction — the casts are noise that hides potential type mismatches and makes the code harder for humans and AI agents to reason about.

This refactor changes domain type array properties to `readonly` arrays at the source, fixes any server-side code that mutates arrays after construction, and removes all `as Type` casts from Vue files. No runtime behavior changes — purely a type-level refactor.

## Glossary

- **Domain_Types**: TypeScript interfaces in `server/types/domain.ts`, `server/types/computed.ts`, and `server/services/jiraService.ts` that define the canonical shape of all domain objects
- **Re-export_Layer**: Files in `app/types/` that re-export server types for app-layer consumption
- **Cast_Site**: A TypeScript `as Type` assertion in a Vue file used to coerce a `Readonly<>` response into a mutable domain type
- **Readonly_Array**: A TypeScript `readonly T[]` or `ReadonlyArray<T>` type that prevents `.push()`, `.pop()`, `.splice()`, and other mutating methods
- **Deep_Readonly**: Nuxt's `$fetch` return type wrapper that recursively applies `Readonly<>` to all properties and array elements of API responses
- **Mutable_Construction**: Server-side code that builds domain objects by mutating arrays (e.g., `.push()`) before returning them
- **Immutable_Construction**: Building arrays using spread (`[...arr, item]`), `concat`, or collecting into a fresh array without post-creation mutation

## Requirements

### Requirement 1: Convert Domain Type Array Properties to Readonly

**User Story:** As a developer, I want domain type array properties to use `readonly` arrays, so that the types accurately reflect that domain data is never mutated after construction and are compatible with Nuxt's `Readonly<>` wrapper.

#### Acceptance Criteria

1. THE Domain_Types in `server/types/domain.ts` SHALL declare all array properties as `readonly T[]` instead of `T[]` for the following interfaces: `Job.jiraLabels`, `Path.steps`, `TemplateRoute.steps`, `BOM.entries`, `BomEntry.contributingJobIds`, `StepNote.partIds`, `BomVersion.entriesSnapshot`
2. THE Domain_Types in `server/types/computed.ts` SHALL declare all array properties as `readonly T[]` instead of `T[]` for the following interfaces: `OperatorStepView.stepIds`, `OperatorStepView.currentParts`, `OperatorStepView.comingSoon`, `OperatorStepView.backlog`, `WorkQueueJob.partIds`, `BomSummary.entries`, `AdvancementResult.bypassed`
3. THE Domain_Types in `server/services/jiraService.ts` SHALL declare `JiraTicket.labels` as `readonly string[]` and `FetchTicketsResult.tickets` as `readonly JiraTicket[]`
4. THE Domain_Types in `server/types/api.ts` SHALL declare array properties as `readonly` where applicable, including `CreateBomInput.entries[].contributingJobIds`, `EditBomInput.entries[].contributingJobIds`, `CreateStepOverrideInput.partIds`, and `BatchAttachCertInput.partIds`
5. WHEN a domain type array property is converted to `readonly`, THE Domain_Types SHALL preserve the element type unchanged (only the array mutability changes)

### Requirement 2: Fix Server-Side Mutable Array Construction

**User Story:** As a developer, I want server-side code that constructs domain objects to use immutable array patterns, so that the code compiles cleanly against `readonly` array types without type errors.

#### Acceptance Criteria

1. WHEN server-side code constructs a domain object with array properties, THE server code SHALL build arrays using Immutable_Construction patterns (spread, concat, or fresh array collection) instead of post-creation `.push()` mutation on the domain object's array property
2. WHEN server-side code uses `.push()` on local temporary arrays that are assigned to a domain object property only after construction is complete, THE server code SHALL continue to use `.push()` on the local mutable array and assign the result to the readonly property via type-compatible construction (e.g., building a `T[]` locally then assigning to `readonly T[]`)
3. IF server-side code mutates an array property of an already-constructed domain object, THEN THE server code SHALL refactor to construct a new object with the updated array instead

### Requirement 3: Remove Type Casts from Vue Files

**User Story:** As a developer, I want all `as Type` casts that exist solely to bridge the `Readonly<>` gap removed from Vue files, so that the code is cleaner and type mismatches are caught at compile time.

#### Acceptance Criteria

1. THE Vue files SHALL remove all `as Type` casts that exist solely to coerce `Readonly<>` API responses into mutable domain types, across the following files: `app/pages/parts/step/[stepId].vue`, `app/pages/bom.vue`, `app/pages/audit.vue`, `app/pages/parts-browser/[id].vue`, `app/pages/jobs/index.vue`, `app/components/JobCreationForm.vue`, `app/pages/jira.vue`, `app/pages/settings.vue`, `app/pages/templates.vue`
2. WHEN a Cast_Site is removed, THE Vue file SHALL pass the value directly to the component prop or binding without any type assertion
3. THE Vue files SHALL retain `as Type` casts that serve a legitimate purpose unrelated to the `Readonly<>` gap (e.g., `route.params.id as string`, `as const`, event handler casts)
4. WHEN all Readonly-bridging casts are removed, THE codebase SHALL have zero remaining `as DomainType` or `as DomainType[]` casts in Vue template bindings that exist solely to strip `Readonly<>`

### Requirement 4: Preserve Type Safety and Test Suite

**User Story:** As a developer, I want the refactor to maintain full type safety and pass all existing tests, so that no regressions are introduced.

#### Acceptance Criteria

1. WHEN the refactor is complete, THE codebase SHALL pass `npm run typecheck` with zero type errors
2. WHEN the refactor is complete, THE test suite SHALL pass all 880+ existing tests via `npm run test`
3. THE refactor SHALL introduce zero runtime behavior changes — all changes are purely at the type level
4. WHEN a `readonly T[]` property is passed to a function expecting `T[]`, THE code SHALL resolve the incompatibility by updating the function signature to accept `readonly T[]` rather than adding a type cast

### Requirement 5: Maintain Re-export Layer Compatibility

**User Story:** As a developer, I want the `app/types/` re-export layer to continue working transparently after the refactor, so that frontend imports remain unchanged.

#### Acceptance Criteria

1. THE Re-export_Layer files (`app/types/domain.ts`, `app/types/computed.ts`, `app/types/jira.ts`, `app/types/api.ts`) SHALL continue to re-export all types without modification to the export statements
2. WHEN a domain type's array property changes from `T[]` to `readonly T[]`, THE Re-export_Layer SHALL propagate the readonly constraint automatically through the existing re-exports
3. THE Vue files and composables SHALL continue to import types from `~/types/` without any import path changes
