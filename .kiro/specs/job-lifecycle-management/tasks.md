# Implementation Plan: Job Lifecycle Management

## Overview

Extend Shop Planr from sequential-only advancement to a full manufacturing lifecycle. The implementation adds migration 004 (lifecycle columns + 5 new tables), 4 new repository interfaces + SQLite implementations, 2 new services (`lifecycleService`, `libraryService`), ~16 new API routes, ~12 new Vue components, 3 new composables, and extends existing domain/computed types, services, and UI pages. Property-based tests validate 17 correctness properties. All work builds incrementally on the existing architecture.

## Tasks

- [x] 1. Database migration and domain type extensions
  - [x] 1.1 Extend domain types in `server/types/domain.ts`
    - Add `status`, `scrapReason`, `scrapExplanation`, `scrapStepId`, `scrappedAt`, `scrappedBy`, `forceCompleted`, `forceCompletedBy`, `forceCompletedAt`, `forceCompletedReason` to `SerialNumber`
    - Add `optional: boolean`, `dependencyType: 'physical' | 'preferred' | 'completion_gate'` to `ProcessStep` and `TemplateStep`
    - Add `advancementMode: 'strict' | 'flexible' | 'per_step'` to `Path`
    - Add `SnStepStatus`, `SnStepOverride`, `BomVersion`, `ProcessLibraryEntry`, `LocationLibraryEntry`, `ScrapReason`, `SnStepStatusValue` types
    - Extend `AuditAction` union with 9 new action types: `serial_scrapped`, `serial_force_completed`, `step_override_created`, `step_override_reversed`, `step_deferred`, `step_skipped`, `deferred_step_completed`, `step_waived`, `bom_edited`
    - _Requirements: 3.1, 4.1, 5.3, 6.1, 8.4, 8.8, 9.6, 10.6, 10.7, 11.1, 11.8, 11.9, 12.1, 13.5, 14.6, 16.1, 16.2_

  - [x] 1.2 Extend API input types in `server/types/api.ts`
    - Add `ScrapSerialInput`, `ForceCompleteInput`, `AdvanceToStepInput`, `CompleteDeferredStepInput`, `WaiveStepInput`, `CreateStepOverrideInput`, `EditBomInput`, `UpdateAdvancementModeInput`, `CreateLibraryEntryInput`
    - _Requirements: 3.2, 5.1, 6.1, 8.2, 8.3, 9.1, 10.1, 13.2_

  - [x] 1.3 Extend computed types in `server/types/computed.ts`
    - Add `scrappedSerials`, `producedQuantity`, `orderedQuantity` to `JobProgress`
    - Update `progressPercent` formula comment: `completedCount / (goalQuantity - scrappedCount) * 100`
    - Add `'scrapped'` to `EnrichedSerial.status`, add `scrapReason`, `forceCompleted` fields
    - Add `AdvancementResult` and `SnStepStatusView` interfaces
    - _Requirements: 3.5, 3.7, 3.8, 7.2, 7.3, 11.4_

  - [x] 1.4 Create migration `server/repositories/sqlite/migrations/004_lifecycle_management.sql`
    - ALTER serials: add `status`, `scrap_reason`, `scrap_explanation`, `scrap_step_id`, `scrapped_at`, `scrapped_by`, `force_completed`, `force_completed_by`, `force_completed_at`, `force_completed_reason`
    - UPDATE existing completed serials (`current_step_index = -1`) to `status = 'completed'`
    - ALTER process_steps: add `optional` (default 0), `dependency_type` (default 'preferred')
    - ALTER template_steps: add `optional` (default 0), `dependency_type` (default 'preferred')
    - ALTER paths: add `advancement_mode` (default 'strict')
    - CREATE TABLE `sn_step_statuses` with indexes
    - CREATE TABLE `sn_step_overrides` with indexes
    - CREATE TABLE `bom_versions` with index
    - CREATE TABLE `process_library` and `location_library` with UNIQUE name constraints
    - INSERT seed data for process library (8 entries) and location library (3 entries)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.7, 16.8_

- [x] 2. Checkpoint — Migration and types
  - Ensure migration runs cleanly on a fresh DB and on a DB with existing data. Verify all new types compile. Ask the user if questions arise.

- [x] 3. New repository interfaces and SQLite implementations
  - [x] 3.1 Create `server/repositories/interfaces/snStepStatusRepository.ts`
    - Define `SnStepStatusRepository` interface: `create`, `createBatch`, `getBySerialAndStep`, `listBySerialId`, `update`, `updateBySerialAndStep`
    - _Requirements: 11.1, 11.5, 11.6_

  - [x] 3.2 Create `server/repositories/interfaces/snStepOverrideRepository.ts`
    - Define `SnStepOverrideRepository` interface: `create`, `createBatch`, `getBySerialAndStep`, `listBySerialId`, `listActiveBySerialId`, `update`
    - _Requirements: 9.1, 9.4_

  - [x] 3.3 Create `server/repositories/interfaces/bomVersionRepository.ts`
    - Define `BomVersionRepository` interface: `create`, `listByBomId`, `getLatestByBomId`
    - _Requirements: 10.2, 10.3, 10.4_

  - [x] 3.4 Create `server/repositories/interfaces/libraryRepository.ts`
    - Define `LibraryRepository` interface: `listProcesses`, `createProcess`, `deleteProcess`, `listLocations`, `createLocation`, `deleteLocation`
    - _Requirements: 16.1, 16.2, 16.6_

  - [x] 3.5 Export new interfaces from `server/repositories/interfaces/index.ts`
    - Add barrel exports for all 4 new repository interfaces
    - _Requirements: 3.1, 9.1, 10.2, 16.1_

  - [x] 3.6 Create `server/repositories/sqlite/snStepStatusRepository.ts`
    - Implement `SQLiteSnStepStatusRepository` against `sn_step_statuses` table
    - _Requirements: 11.1, 11.5, 11.6_

  - [x] 3.7 Create `server/repositories/sqlite/snStepOverrideRepository.ts`
    - Implement `SQLiteSnStepOverrideRepository` against `sn_step_overrides` table
    - _Requirements: 9.1, 9.4_

  - [x] 3.8 Create `server/repositories/sqlite/bomVersionRepository.ts`
    - Implement `SQLiteBomVersionRepository` against `bom_versions` table
    - _Requirements: 10.2, 10.3, 10.4_

  - [x] 3.9 Create `server/repositories/sqlite/libraryRepository.ts`
    - Implement `SQLiteLibraryRepository` against `process_library` and `location_library` tables
    - _Requirements: 16.1, 16.2, 16.6_

  - [x] 3.10 Wire new repositories into `server/repositories/factory.ts`
    - Add `snStepStatuses`, `snStepOverrides`, `bomVersions`, `library` to `RepositorySet` and `createRepositories`
    - _Requirements: 3.1, 9.1, 10.2, 16.1_

  - [x] 3.11 Extend existing repositories
    - Add `countScrappedByJobId(jobId)` to `SerialRepository` interface and SQLite implementation
    - Add `updateStep(stepId, partial)` to `PathRepository` interface and SQLite implementation for updating optional/dependencyType
    - Add `listAttachmentsByCertId(certId)` to `CertRepository` interface and SQLite implementation
    - Add `update(id, partial)` to `TemplateRepository` interface and SQLite implementation
    - _Requirements: 3.5, 4.4, 18.3, 20.3_

- [x] 4. Implement `lifecycleService`
  - [x] 4.1 Create `server/services/lifecycleService.ts` — core lifecycle operations
    - Implement `createLifecycleService` factory with DI for repos (serials, paths, jobs, snStepStatuses, snStepOverrides) and auditService
    - Implement `initializeStepStatuses(serialId, pathId)` — creates `sn_step_statuses` rows for all steps in the path (first step = 'in_progress', rest = 'pending')
    - Implement `getStepStatuses(serialId)` — returns all step statuses for a serial
    - Implement `canComplete(serialId)` — checks if all required steps are completed/waived, returns `{ canComplete, blockers }`
    - _Requirements: 11.1, 11.7_

  - [x] 4.2 Implement `scrapSerial` in `lifecycleService`
    - Validate serial exists and status is 'in_progress' (reject scrapped/completed)
    - Validate scrap reason is provided; if 'other', require explanation
    - Update serial: set `status = 'scrapped'`, `scrapReason`, `scrapExplanation`, `scrapStepId`, `scrappedAt`, `scrappedBy`
    - Record audit entry with action `serial_scrapped`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.9, 3.10, 3.11_

  - [x] 4.3 Write property test for Scrap Exclusion from Progress (P1)
    - **Property 1: Scrap Exclusion from Progress**
    - Create `tests/properties/scrapExclusion.property.test.ts`
    - For any Job with any mix of in-progress, completed, and scrapped serials, verify `progressPercent = completedCount / (goalQuantity - scrappedCount) * 100`
    - **Validates: Requirements 3.5, 3.8**

  - [x] 4.4 Write property test for Scrap Immutability (P6)
    - **Property 6: Scrap Immutability**
    - Create `tests/properties/scrapImmutability.property.test.ts`
    - For any scrapped serial, verify that advance, complete, force-complete, and re-scrap operations all fail
    - **Validates: Requirements 3.6, 3.10, 3.11**

  - [x] 4.5 Implement `advanceToStep` in `lifecycleService`
    - Validate serial is in_progress, target step is forward-only (reject backward/current)
    - Check path advancement mode: strict → only N+1 allowed; flexible → allow with bypass classification; per_step → check dependency types
    - For each bypassed step: classify as 'skipped' (optional) or 'deferred' (required), update `sn_step_statuses`
    - Block advancement past any step with 'physical' dependency type that hasn't been completed
    - Update serial `currentStepIndex`, update step statuses for origin (completed) and destination (in_progress)
    - Record audit entries for `serial_advanced`, `step_skipped`, `step_deferred` as appropriate
    - Return `AdvancementResult` with serial and bypassed step classifications
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 5.7, 5.8, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 11.2, 11.3, 12.2, 12.3, 12.4_

  - [x] 4.6 Write property test for Strict Advancement Mode Enforcement (P11)
    - **Property 11: Strict Advancement Mode Enforcement**
    - Create `tests/properties/strictModeEnforcement.property.test.ts`
    - For any Path in strict mode, verify advancing from step N only succeeds for N+1
    - **Validates: Requirements 6.2**

  - [x] 4.7 Write property test for Physical Dependency Hard Block (P7)
    - **Property 7: Physical Dependency Hard Block**
    - Create `tests/properties/physicalDependencyBlock.property.test.ts`
    - For any step with 'physical' dependency, verify advancement past it is blocked regardless of advancement mode
    - **Validates: Requirements 6.5, 12.2, 12.8**

  - [x] 4.8 Write property test for Flexible Advancement Step Classification (P13)
    - **Property 13: Flexible Advancement Step Classification**
    - Create `tests/properties/flexibleAdvancementClassification.property.test.ts`
    - For any flexible advancement bypassing intermediate steps, verify optional → skipped, required → deferred, union = all bypassed
    - **Validates: Requirements 5.3, 11.2, 11.3**

  - [x] 4.9 Write property test for Backward and Duplicate Advancement Rejection (P15)
    - **Property 15: Backward and Duplicate Advancement Rejection**
    - Create `tests/properties/backwardAdvancementRejection.property.test.ts`
    - For any serial at step N, verify advancing to M <= N is rejected
    - **Validates: Requirements 5.7, 5.8**

  - [x] 4.10 Implement `forceComplete` in `lifecycleService`
    - Validate serial is in_progress with incomplete required steps (if no incomplete steps, reject — use normal completion)
    - Collect all incomplete required step IDs (deferred or pending)
    - Update serial: `status = 'completed'`, `currentStepIndex = -1`, `forceCompleted = true`, `forceCompletedBy`, `forceCompletedAt`, `forceCompletedReason`
    - Record audit entry with action `serial_force_completed` including incomplete step list in metadata
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7, 8.8, 8.9_

  - [x] 4.11 Write property test for Force Complete Audit Fidelity (P12)
    - **Property 12: Force Complete Audit Fidelity**
    - Create `tests/properties/forceCompleteAuditFidelity.property.test.ts`
    - For any force-completed serial, verify audit entry contains exact set of incomplete required step IDs
    - **Validates: Requirements 8.4, 8.5**

  - [x] 4.12 Implement `completeDeferredStep` in `lifecycleService`
    - Validate step status is 'deferred' for the serial
    - Update `sn_step_statuses` from 'deferred' to 'completed'
    - Record audit entry with action `deferred_step_completed`
    - _Requirements: 11.5, 11.6_

  - [x] 4.13 Write property test for Deferred Step Blocks Completion (P3)
    - **Property 3: Deferred Step Blocks Normal Completion**
    - Create `tests/properties/deferredBlocksCompletion.property.test.ts`
    - For any serial with deferred required steps, verify normal completion is rejected
    - **Validates: Requirements 4.7, 11.7**

  - [x] 4.14 Write property test for Optional Skip Allows Completion (P4)
    - **Property 4: Optional Skip and Waiver Allow Completion**
    - Create `tests/properties/optionalSkipCompletion.property.test.ts`
    - For any serial where all required steps are completed/waived and only optional steps are skipped, verify normal completion succeeds
    - **Validates: Requirements 4.6, 13.7**

  - [x] 4.15 Implement `waiveStep` in `lifecycleService` (stretch goal — Req 13)
    - Validate step is deferred and required; require reason and approver
    - Update `sn_step_statuses` from 'deferred' to 'waived'
    - Record audit entry with action `step_waived`
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [x] 4.16 Implement `createStepOverride` and `reverseStepOverride` in `lifecycleService`
    - `createStepOverride`: validate step not already completed for each serial; create override records; record audit `step_override_created`
    - `reverseStepOverride`: validate step not already skipped; deactivate override; record audit `step_override_reversed`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.9, 9.10_

  - [x] 4.17 Write property test for Step Override Reversibility (P5)
    - **Property 5: Step Override Reversibility**
    - Create `tests/properties/stepOverrideReversibility.property.test.ts`
    - For any override on a step not yet skipped/completed, verify reversal restores original required status
    - **Validates: Requirements 9.4**

  - [x] 4.18 Write property test for Step Status Conservation (P2)
    - **Property 2: Step Status Conservation**
    - Create `tests/properties/stepStatusConservation.property.test.ts`
    - For any serial, verify total step status count equals total process steps in path after any operation
    - **Validates: Requirements 11.1**

  - [x] 4.19 Write property test for Completion Gate Deferred Behavior (P16)
    - **Property 16: Completion Gate Deferred Behavior**
    - Create `tests/properties/completionGateDeferred.property.test.ts`
    - For any step with 'completion_gate' dependency, verify serial can advance past it (deferred) but normal completion is blocked until resolved
    - **Validates: Requirements 6.7, 12.4**

- [x] 5. Checkpoint — Lifecycle service core
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement `libraryService` and extend existing services
  - [x] 6.1 Create `server/services/libraryService.ts`
    - Implement `createLibraryService` factory with DI for `LibraryRepository`
    - Implement `listProcesses`, `addProcess`, `removeProcess`, `listLocations`, `addLocation`, `removeLocation`
    - Validate non-empty names, reject duplicates
    - _Requirements: 16.1, 16.2, 16.6, 16.7_

  - [x] 6.2 Write property test for Library Entry Round-Trip (P17)
    - **Property 17: Library Entry Round-Trip**
    - Create `tests/properties/libraryRoundTrip.property.test.ts`
    - For any name added to library, verify it appears in list; after removal, verify it's gone; verify existing steps retain names
    - **Validates: Requirements 16.1, 16.2, 16.5, 16.7**

  - [x] 6.3 Extend `auditService` with new recording methods
    - Add methods for recording all 9 new audit action types: `serial_scrapped`, `serial_force_completed`, `step_override_created`, `step_override_reversed`, `step_deferred`, `step_skipped`, `deferred_step_completed`, `step_waived`, `bom_edited`
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [x] 6.4 Write property test for Audit Trail Completeness (P10)
    - **Property 10: Audit Trail Completeness for Lifecycle Actions**
    - Create `tests/properties/lifecycleAuditCompleteness.property.test.ts`
    - For any lifecycle operation, verify exactly one audit entry with the correct action type is created
    - **Validates: Requirements 1.8, 3.4, 5.6, 6.8, 8.5, 9.5, 10.6, 13.4, 15.1–15.7**

  - [x] 6.5 Extend `bomService` with `editBom` and version snapshots
    - Add `editBom(bomId, input: EditBomInput)` that snapshots current entries into `bom_versions`, then updates `bom_entries`
    - Record audit entry with action `bom_edited`
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.6_

  - [x] 6.6 Write property test for BOM Version Immutability (P9)
    - **Property 9: BOM Version Immutability**
    - Create `tests/properties/bomVersionImmutability.property.test.ts`
    - For any BOM, verify editing creates a new version without modifying previous versions
    - **Validates: Requirements 10.2, 10.3**

  - [x] 6.7 Extend `jobService.computeJobProgress` for scrap and overproduction
    - Exclude scrapped serials from progress: `completedCount / (goalQuantity - scrappedCount) * 100`
    - Support >100% progress when completed exceeds adjusted goal
    - Add `scrappedSerials`, `producedQuantity`, `orderedQuantity` to returned `JobProgress`
    - _Requirements: 3.5, 3.8, 7.2, 7.3_

  - [x] 6.8 Write property test for Bonus Part Tracking Consistency (P8)
    - **Property 8: Bonus Part Tracking Consistency**
    - Create `tests/properties/bonusPartTracking.property.test.ts`
    - For any Job, verify `producedQuantity = total SN count`, `orderedQuantity = goalQuantity`, bonus parts follow same rules
    - **Validates: Requirements 7.1, 7.3, 7.5**

  - [x] 6.9 Extend `serialService` for lifecycle integration
    - Update `advanceSerial` to call `lifecycleService.initializeStepStatuses` when creating serials (batch creation)
    - Update `listAllSerialsEnriched` to include scrap/force-complete fields in `EnrichedSerial`
    - _Requirements: 1.1, 3.7, 8.6_

  - [x] 6.10 Extend `templateService` for optional/dependencyType propagation
    - Copy `optional` and `dependencyType` fields from TemplateStep to ProcessStep when applying templates
    - Add `updateTemplate` method for editing existing templates
    - _Requirements: 4.3, 12.6, 18.2, 18.3_

  - [x] 6.11 Write property test for Template Field Propagation (P14)
    - **Property 14: Template Field Propagation**
    - Create `tests/properties/templateFieldPropagation.property.test.ts`
    - For any template with optional/dependencyType values, verify applying it produces matching ProcessSteps and template is unchanged
    - **Validates: Requirements 4.3, 12.6**

  - [x] 6.12 Extend `certService` for attachment queries
    - Add `getAttachmentsBySerialId(serialId)` and `getAttachmentsByCertId(certId)` methods
    - _Requirements: 20.3, 21.3_

  - [x] 6.13 Wire `lifecycleService` and `libraryService` into `server/utils/services.ts`
    - Add both services to `ServiceSet` interface and `getServices()` factory
    - Wire new repositories and service dependencies
    - _Requirements: 3.1, 16.1_

- [x] 7. Checkpoint — All services and property tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Lifecycle API routes
  - [x] 8.1 Create `server/api/serials/[id]/scrap.post.ts`
    - Parse `ScrapSerialInput`, call `lifecycleService.scrapSerial`, return updated serial
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 8.2 Create `server/api/serials/[id]/advance-to.post.ts`
    - Parse `AdvanceToStepInput`, call `lifecycleService.advanceToStep`, return `AdvancementResult`
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6_

  - [x] 8.3 Create `server/api/serials/[id]/force-complete.post.ts`
    - Parse `ForceCompleteInput`, call `lifecycleService.forceComplete`, return updated serial
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 8.4 Create `server/api/serials/[id]/complete-deferred/[stepId].post.ts`
    - Parse `CompleteDeferredStepInput`, call `lifecycleService.completeDeferredStep`, return updated step status
    - _Requirements: 11.5, 11.6_

  - [x] 8.5 Create `server/api/serials/[id]/waive-step/[stepId].post.ts` (stretch — Req 13)
    - Parse `WaiveStepInput`, call `lifecycleService.waiveStep`, return updated step status
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [x] 8.6 Create `server/api/serials/[id]/overrides.post.ts`
    - Parse `CreateStepOverrideInput`, call `lifecycleService.createStepOverride`, return created overrides
    - _Requirements: 9.1, 9.2, 9.5_

  - [x] 8.7 Create `server/api/serials/[id]/overrides/[stepId].delete.ts`
    - Call `lifecycleService.reverseStepOverride`, return success
    - _Requirements: 9.4, 9.10_

  - [x] 8.8 Create `server/api/paths/[id]/advancement-mode.patch.ts`
    - Parse `UpdateAdvancementModeInput`, update path advancement mode via `pathService`
    - _Requirements: 6.1, 6.9, 6.10_

  - [x] 8.9 Create BOM edit and version routes
    - `server/api/bom/[id]/edit.post.ts` — parse `EditBomInput`, call `bomService.editBom`
    - `server/api/bom/[id]/versions.get.ts` — call `bomVersionRepository.listByBomId`
    - _Requirements: 10.1, 10.4_

  - [x] 8.10 Create library CRUD routes
    - `server/api/library/processes.get.ts` — list process library entries
    - `server/api/library/processes.post.ts` — add process entry
    - `server/api/library/processes/[id].delete.ts` — remove process entry
    - `server/api/library/locations.get.ts` — list location library entries
    - `server/api/library/locations.post.ts` — add location entry
    - `server/api/library/locations/[id].delete.ts` — remove location entry
    - _Requirements: 16.1, 16.2, 16.6_

  - [x] 8.11 Create additional API routes
    - `server/api/certs/[id]/attachments.get.ts` — list serial attachments for a cert
    - `server/api/templates/[id].put.ts` — update an existing template's steps
    - _Requirements: 18.3, 20.3_

- [x] 9. Checkpoint — All API routes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Frontend composables
  - [x] 10.1 Create `app/composables/useLifecycle.ts`
    - Expose reactive state (`loading`, `error`) and methods: `scrapSerial`, `forceComplete`, `advanceToStep`, `completeDeferredStep`, `waiveStep`, `createStepOverride`, `reverseStepOverride`, `getStepStatuses`, `canComplete`
    - Each method calls the corresponding API route via `$fetch`
    - _Requirements: 3.1, 5.1, 8.1, 9.1, 11.5, 13.1_

  - [x] 10.2 Create `app/composables/useLibrary.ts`
    - Expose `processes`, `locations`, `loading` refs and methods: `fetchProcesses`, `fetchLocations`, `addProcess`, `removeProcess`, `addLocation`, `removeLocation`
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [x] 10.3 Create `app/composables/useBomVersions.ts`
    - Expose `versions`, `loading` refs and methods: `fetchVersions(bomId)`, `editBom(bomId, input)`
    - _Requirements: 10.1, 10.4_

  - [x] 10.4 Extend `app/composables/useAudit.ts` with filter parameters
    - Add filter parameters (action type, userId, serialId, jobId, startDate, endDate) to `fetchEntries`
    - _Requirements: 22.1, 22.2, 22.3, 22.5_

- [x] 11. Frontend components — Lifecycle dialogs and panels
  - [x] 11.1 Create `app/components/ScrapDialog.vue`
    - Modal with scrap reason dropdown (5 options), conditional free-text explanation for "Other"
    - Calls `useLifecycle().scrapSerial` on confirm
    - Displays validation errors inline
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 11.2 Create `app/components/ForceCompleteDialog.vue`
    - Modal listing all incomplete required steps, optional reason text input
    - Confirmation message: "[N] required steps are incomplete — force complete anyway?"
    - Calls `useLifecycle().forceComplete` on confirm
    - _Requirements: 8.1, 8.2, 8.3, 8.6_

  - [x] 11.3 Create `app/components/DeferredStepsList.vue`
    - List of deferred steps for a serial with "Complete" and "Waive" (stretch) action buttons per step
    - Calls `useLifecycle().completeDeferredStep` or `waiveStep`
    - _Requirements: 11.5, 11.6, 13.1, 13.6_

  - [x] 11.4 Create `app/components/AdvanceToStepDropdown.vue`
    - Dropdown defaulting to next sequential step, listing all future steps in the path
    - Shows bypass preview: lists steps that will be skipped/deferred with color-coded classification
    - Warning for required steps being deferred
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [x] 11.5 Create `app/components/StepOverridePanel.vue`
    - Panel for managing per-SN step overrides: select serials (batch or manual), select step, provide reason
    - Display active overrides with reverse action
    - _Requirements: 9.1, 9.2, 9.4, 9.7_

  - [x] 11.6 Create `app/components/BonusBadge.vue`
    - Small badge component displaying "Bonus" indicator
    - Shown on serial numbers created beyond the Job's Goal Quantity
    - _Requirements: 7.4_

- [x] 12. Frontend components — Configuration and library
  - [x] 12.1 Create `app/components/AdvancementModeSelector.vue`
    - Dropdown to change a Path's advancement mode (strict/flexible/per_step)
    - Calls `PATCH /api/paths/:id/advancement-mode`
    - _Requirements: 6.1, 6.9_

  - [x] 12.2 Create `app/components/StepConfigPanel.vue`
    - Inline panel on Job Routing tab to edit a step's `optional` flag (toggle) and `dependencyType` (dropdown: physical/preferred/completion_gate)
    - Calls `pathService.updateStep` via API
    - Visual indicators: lock icon for physical, arrow for preferred, gate for completion_gate
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 12.1, 12.5, 12.7_

  - [x] 12.3 Create `app/components/ProcessLocationDropdown.vue`
    - Searchable dropdown for process name or location selection from library
    - "New" inline-add option that prompts for name and adds to library
    - Used in PathEditor and template editor
    - _Requirements: 16.3, 16.4, 16.5_

  - [x] 12.4 Create `app/components/LibraryManager.vue`
    - CRUD interface for process and location libraries, used on Settings page
    - List entries with delete button (warning if in use), add form
    - _Requirements: 16.6, 16.7_

  - [x] 12.5 Create `app/components/BomVersionHistory.vue`
    - Version history timeline for BOM edits: version number, date, user, change summary
    - Reverse chronological order
    - _Requirements: 10.4_

  - [x] 12.6 Create `app/components/AuditTrailFilters.vue`
    - Filter controls: action type dropdown (all types including new lifecycle types), user dropdown, serial text search, job dropdown, date range pickers
    - Emits filter state to parent for API query
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5_

  - [x] 12.7 Create additional utility components
    - `app/components/PartDetailNotes.vue` — Notes section for Part Detail page showing all notes for a serial in reverse chronological order
    - `app/components/CertAttachButton.vue` — Searchable cert dropdown + attach action for Part Detail page
    - `app/components/CertDetailView.vue` — Certificate detail view showing metadata and attached serials list
    - `app/components/TemplateEditor.vue` — Edit form for existing templates (add/remove/reorder steps with library dropdowns, optional/dependencyType per step)
    - `app/components/PathDeleteButton.vue` — Delete button with confirmation for paths with zero serials
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 18.1, 18.2, 18.4, 19.1, 19.2, 19.3, 20.2, 20.3, 21.1, 21.2, 21.3_

- [x] 13. Checkpoint — All components
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Page modifications — Job detail and navigation
  - [x] 14.1 Enhance `app/pages/jobs/[id].vue` — Tabbed layout
    - Add tab navigation: "Job Routing" (existing content) and "Serial Numbers" (new tab)
    - Job Routing tab: display paths with step tracker, SN counts per step, completed counts, inline-editable Goal Quantity, `PathDeleteButton` on each path header, `AdvancementModeSelector` per path, `StepConfigPanel` on step click
    - Serial Numbers tab: integrate `JobSerialNumbersTab` component
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 4.5, 6.1, 7.2, 7.3, 12.7, 19.1_

  - [x] 14.2 Create `app/components/JobSerialNumbersTab.vue`
    - Display all serial numbers for the job across all paths: SN identifier, path name, current step name, status (in-progress/completed/scrapped)
    - Filter controls: status, path, current step name
    - Sort controls: SN identifier, status, current step, created date
    - Quick-action buttons per SN: advance (if in-progress), scrap (if in-progress), view detail
    - Clickable SN rows → navigate to Part Detail page
    - Show `BonusBadge` on SNs beyond goal quantity
    - Show force-complete indicator on force-completed SNs
    - Show scrapped SNs with distinct visual (red strikethrough or "Scrapped" badge)
    - _Requirements: 2.7, 2.8, 2.9, 2.10, 2.11, 3.7, 7.4, 8.6_

  - [x] 14.3 Update `app/pages/jobs/index.vue` — Clickable job rows
    - Make each Job row clickable, navigating to `/jobs/[id]`
    - _Requirements: 2.2_

  - [x] 14.4 Update `app/pages/index.vue` — Dashboard links
    - Link "Active Jobs" section to jobs list page
    - Link individual job progress entries to job detail page (`/jobs/[id]`)
    - _Requirements: 2.3_

- [x] 15. Page modifications — Part detail, operator, and settings
  - [x] 15.1 Enhance `app/pages/serials/[id].vue` — Lifecycle features
    - Add "Deferred Steps" section using `DeferredStepsList` component
    - Add step override display showing which steps are overridden and by whom
    - Add scrap indicator (reason, step, date) for scrapped serials
    - Add force-complete indicator ("Force completed by [user] on [date]") for force-completed serials
    - Add `PartDetailNotes` section
    - Add `CertAttachButton` on Routing tab (only when in-progress)
    - Display attached certificates list (read-only when completed/scrapped)
    - _Requirements: 3.7, 8.6, 9.7, 11.4, 11.5, 13.6, 17.1, 17.2, 17.3, 17.4, 21.1, 21.2, 21.3, 21.4_

  - [x] 15.2 Enhance `app/components/ProcessAdvancementPanel.vue`
    - Replace simple advance with `AdvanceToStepDropdown` for flexible advancement
    - Add "Skip" button for optional steps (one-click skip)
    - Add scrap button opening `ScrapDialog`
    - Add force-complete button opening `ForceCompleteDialog` (when incomplete required steps exist)
    - _Requirements: 1.5, 3.9, 5.1, 5.4, 8.1_

  - [x] 15.3 Enhance `app/components/StepTracker.vue`
    - Add visual indicators for: optional steps (dashed border or "Optional" label), dependency type icons (lock/arrow/gate), deferred (yellow), skipped (gray), waived (orange), completed (green), in-progress (blue)
    - Show step override split summary when overrides exist (e.g., "10 fast-track / 40 standard")
    - _Requirements: 4.5, 9.8, 11.4, 12.7, 13.6_

  - [x] 15.4 Enhance `app/pages/settings.vue` — Library management
    - Add "Process Library" and "Location Library" sections using `LibraryManager` component
    - _Requirements: 16.1, 16.2, 16.6_

  - [x] 15.5 Enhance `app/pages/bom.vue` — Edit and version history
    - Add edit BOM functionality with `EditBomInput` form
    - Add `BomVersionHistory` component for version history display
    - _Requirements: 10.1, 10.4, 10.8_

  - [x] 15.6 Enhance `app/pages/audit.vue` — Filters and new action types
    - Add `AuditTrailFilters` component above the audit log
    - Wire filter state to API queries
    - Display new lifecycle action types with appropriate labels and formatting
    - _Requirements: 15.8, 15.9, 22.1, 22.2, 22.3, 22.4, 22.5_

  - [x] 15.7 Enhance `app/pages/templates.vue` — Library dropdowns and editing
    - Replace free-text step name/location inputs with `ProcessLocationDropdown` components
    - Add optional toggle and dependency type selector per template step
    - Add "Edit" button per template that opens `TemplateEditor`
    - _Requirements: 4.2, 12.5, 16.3, 16.4, 18.1, 18.2, 18.4_

  - [x] 15.8 Enhance `app/components/PathEditor.vue` — Library dropdowns
    - Replace free-text step name/location inputs with `ProcessLocationDropdown` components
    - Add optional toggle and dependency type selector per step
    - _Requirements: 4.2, 12.5, 16.3, 16.4_

  - [x] 15.9 Enhance `app/pages/certs.vue` — Certificate detail view
    - Make certificate rows clickable → navigate to cert detail view
    - Add `CertDetailView` component showing metadata and attached serials
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

- [x] 16. Checkpoint — All frontend changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Integration tests
  - [x] 17.1 Update `tests/integration/helpers.ts`
    - Add new repositories (snStepStatuses, snStepOverrides, bomVersions, library) to `createTestContext`
    - Wire `lifecycleService` and `libraryService` into test context
    - _Requirements: 14.1_

  - [x] 17.2 Write integration test: scrap workflow
    - Create `tests/integration/scrapWorkflow.test.ts`
    - Full flow: create job → create serials → scrap one → verify progress excludes scrapped → verify advancement blocked on scrapped SN → verify audit entry
    - _Requirements: 3.1, 3.4, 3.5, 3.6, 3.8_

  - [x] 17.3 Write integration test: flexible advancement
    - Create `tests/integration/flexibleAdvancement.test.ts`
    - Full flow: create job with flexible path → advance serial skipping steps → verify skip/defer classification → verify deferred blocks normal completion → complete deferred step → verify normal completion succeeds
    - _Requirements: 5.1, 5.2, 5.3, 6.3, 11.2, 11.3, 11.5, 11.7_

  - [x] 17.4 Write integration test: force-complete workflow
    - Create `tests/integration/forceComplete.test.ts`
    - Full flow: create job → advance serial partially → force-complete → verify completed status → verify audit entry contains incomplete steps
    - _Requirements: 8.1, 8.4, 8.5, 8.7_

  - [x] 17.5 Write integration test: step override workflow
    - Create `tests/integration/stepOverride.test.ts`
    - Full flow: create job → create overrides on subset → verify overridden serials can skip → verify non-overridden blocked → reverse override → verify restored
    - _Requirements: 9.1, 9.3, 9.4, 9.9, 9.10_

  - [x] 17.6 Write integration test: BOM version history
    - Create `tests/integration/bomVersionHistory.test.ts`
    - Full flow: create BOM → edit twice → verify 2 versions exist → verify version 1 unchanged after edit 2
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 17.7 Write integration test: library CRUD
    - Create `tests/integration/libraryCrud.test.ts`
    - Full flow: add process → add location → verify in list → remove → verify gone → verify existing steps retain names
    - _Requirements: 16.1, 16.2, 16.6, 16.7_

  - [x] 17.8 Write integration test: migration backwards compatibility
    - Create `tests/integration/migrationCompat.test.ts`
    - Verify existing data with old schema gets correct defaults after migration: serials with `currentStepIndex = -1` → `status = 'completed'`, steps → `optional = false`, `dependencyType = 'preferred'`, paths → `advancementMode = 'strict'`
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 18. Final checkpoint — Full test suite
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major phase
- Property tests validate 17 correctness properties from the design document
- Requirement 13 (Waivers) is a stretch goal — tasks 4.15 and 8.5 can be deferred
- Integration test helpers (task 17.1) must be updated before any integration tests run
- The migration (task 1.4) includes a post-migration hook for backfilling `sn_step_statuses` on existing serials
