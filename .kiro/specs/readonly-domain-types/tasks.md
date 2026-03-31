# Implementation Plan: Readonly Domain Types

## Overview

Convert domain type array properties from mutable `T[]` to `readonly T[]` across 4 type files, fix any server-side function signatures that break, remove ~20 `as Type` casts from 9 Vue files, and add property tests. Zero runtime behavior changes — purely a type-level refactor.

## Tasks

- [x] 1. Convert domain type array properties to `readonly T[]`

  - [x] 1.1 Update `server/types/domain.ts`
    - Change `Job.jiraLabels` from `string[]` to `readonly string[]`
    - Change `Path.steps` from `ProcessStep[]` to `readonly ProcessStep[]`
    - Change `TemplateRoute.steps` from `TemplateStep[]` to `readonly TemplateStep[]`
    - Change `BOM.entries` from `BomEntry[]` to `readonly BomEntry[]`
    - Change `BomEntry.contributingJobIds` from `string[]` to `readonly string[]`
    - Change `StepNote.partIds` from `string[]` to `readonly string[]`
    - Change `BomVersion.entriesSnapshot` from `BomEntry[]` to `readonly BomEntry[]`
    - _Requirements: 1.1, 1.5_

  - [x] 1.2 Update `server/types/computed.ts`
    - Change `OperatorStepView.stepIds` from `string[]` to `readonly string[]`
    - Change `OperatorStepView.currentParts` from `OperatorPartInfo[]` to `readonly OperatorPartInfo[]`
    - Change `OperatorStepView.comingSoon` from `OperatorPartInfo[]` to `readonly OperatorPartInfo[]`
    - Change `OperatorStepView.backlog` from `OperatorPartInfo[]` to `readonly OperatorPartInfo[]`
    - Change `WorkQueueJob.partIds` from `string[]` to `readonly string[]`
    - Change `BomSummary.entries` from `BomEntrySummary[]` to `readonly BomEntrySummary[]`
    - Change `AdvancementResult.bypassed` from `{ ... }[]` to `readonly { ... }[]`
    - _Requirements: 1.2, 1.5_

  - [x] 1.3 Update `server/services/jiraService.ts`
    - Change `JiraTicket.labels` from `string[]` to `readonly string[]`
    - Change `FetchTicketsResult.tickets` from `JiraTicket[]` to `readonly JiraTicket[]`
    - _Requirements: 1.3, 1.5_

  - [x] 1.4 Update `server/types/api.ts`
    - Change `BatchAttachCertInput.partIds` from `string[]` to `readonly string[]`
    - Change `CreateStepOverrideInput.partIds` from `string[]` to `readonly string[]`
    - Change `CreateBomInput.entries[].contributingJobIds` from `string[]` to `readonly string[]`
    - Change `EditBomInput.entries[].contributingJobIds` from `string[]` to `readonly string[]`
    - _Requirements: 1.4, 1.5_

- [x] 2. Fix server-side function signatures and construction patterns
  - Run `npm run typecheck` to identify all breakages from the readonly changes
  - Update function parameters that accept domain arrays from `T[]` to `readonly T[]` (e.g., `rowToDomain(row, steps: TemplateStep[])` → `readonly TemplateStep[]` in `server/repositories/sqlite/templateRepository.ts`)
  - Fix any other function signatures across services and repositories where `readonly T[]` is passed to a `T[]` parameter
  - Do NOT add `as Type` casts to resolve incompatibilities — update signatures instead
  - Local mutable arrays (`.push()` on temp arrays before assignment) are already compatible and need no changes
  - _Requirements: 2.1, 2.2, 2.3, 4.4_

- [x] 3. Checkpoint — Verify type changes compile cleanly
  - Run `npm run typecheck` and verify zero type errors
  - Run `npm run test` and verify all 880+ tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Remove `as Type` casts from Vue files

  - [x] 4.1 Remove casts from `app/pages/parts/step/[stepId].vue`
    - Remove `job as WorkQueueJob` (×2) and `notes as StepNote[]` casts
    - Pass values directly to component props/bindings without type assertions
    - _Requirements: 3.1, 3.2_

  - [x] 4.2 Remove casts from `app/pages/bom.vue`
    - Remove `jobs as Job[]` (×2) and `b as BOM` (×2) casts
    - _Requirements: 3.1, 3.2_

  - [x] 4.3 Remove casts from `app/pages/audit.vue`
    - Remove `entries as AuditEntry[]` cast
    - _Requirements: 3.1, 3.2_

  - [x] 4.4 Remove casts from `app/pages/parts-browser/[id].vue`
    - Remove `as unknown as EnrichedPart[]` cast
    - _Requirements: 3.1, 3.2_

  - [x] 4.5 Remove casts from `app/pages/jobs/index.vue`
    - Remove `as Job[]` (×2) casts
    - _Requirements: 3.1, 3.2_

  - [x] 4.6 Remove casts from `app/components/JobCreationForm.vue`
    - Remove `as TemplateRoute[]` (×2) casts
    - _Requirements: 3.1, 3.2_

  - [x] 4.7 Remove casts from `app/pages/jira.vue`
    - Remove `as JiraTicket[]` cast
    - _Requirements: 3.1, 3.2_

  - [x] 4.8 Remove casts from `app/pages/settings.vue`
    - Remove `as JiraFieldMapping[]` cast
    - _Requirements: 3.1, 3.2_

  - [x] 4.9 Remove casts from `app/pages/templates.vue`
    - Remove `as TemplateRoute` (×3) casts
    - _Requirements: 3.1, 3.2_

  - [x] 4.10 Verify no legitimate casts were removed
    - Confirm `route.params.id as string`, `as const`, and event handler casts are retained
    - Grep Vue files for remaining `as ` patterns and verify each is legitimate (not a Readonly-bridging cast)
    - _Requirements: 3.3, 3.4_

- [x] 5. Checkpoint — Verify cast removal compiles cleanly
  - Run `npm run typecheck` and verify zero type errors
  - Run `npm run test` and verify all 880+ tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Write property tests

  - [x] 6.1 Write property test for readonly array constraint
    - **Property 1: Readonly array constraint on domain types**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 5.2**
    - Test file: `tests/properties/readonlyArrayConstraint.property.test.ts`
    - Maintain a canonical list of `{ file, interface, property }` tuples for all array properties listed in the design
    - Use `fast-check` to generate random selections from the list
    - For each selection, read the source file and assert the property declaration matches `readonly T[]` or `readonly { ... }[]`
    - Minimum 100 iterations

  - [x] 6.2 Write property test for serialization round-trip preservation
    - **Property 2: Serialization round-trip preservation under readonly arrays**
    - **Validates: Requirements 4.3, 1.5**
    - Test file: `tests/properties/readonlyRoundTrip.property.test.ts`
    - Generate random domain objects using `fast-check` arbitraries for each domain type with array properties (Job, Path, BOM, BomEntry, TemplateRoute, StepNote, BomVersion, OperatorStepView, WorkQueueJob, BomSummary, AdvancementResult, JiraTicket, FetchTicketsResult)
    - Serialize via `JSON.stringify` then deserialize via `JSON.parse`
    - Assert deep equality between original and round-tripped object
    - Minimum 100 iterations

- [x] 7. Final checkpoint — Verify full suite passes
  - Run `npm run typecheck` and verify zero type errors
  - Run `npm run test` and verify all tests pass (including new property tests)
  - Grep all Vue files for `as ` casts and confirm zero remaining Readonly-bridging casts
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after type changes and after cast removal
- The re-export layer (`app/types/`) propagates readonly changes automatically — no tasks needed
- Local mutable array construction (`.push()` on temp arrays) is already compatible with `readonly T[]` assignment
