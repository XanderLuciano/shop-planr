# Implementation Plan: Serial-to-Part-ID Rename

## Overview

Codebase-wide rename from "serial" / "serial number" / "SN" terminology to "part" / "part_id" terminology. This is a pure refactoring — no behavioral changes. The implementation proceeds bottom-up: database migration first, then domain types, repositories, services, API routes, frontend, seed data, and finally tests. Each task builds on the previous so the codebase compiles at every step.

## Tasks

- [x] 1. Database migration and ID generator
  - [x] 1.1 Create migration `server/repositories/sqlite/migrations/006_rename_serial_to_part.sql`
    - Rename `serials` → `parts`, `sn_step_statuses` → `part_step_statuses`, `sn_step_overrides` → `part_step_overrides` using `ALTER TABLE RENAME TO`
    - Recreate `cert_attachments` with `part_id` column instead of `serial_id` (create-copy-drop-rename pattern)
    - Recreate `audit_entries` with `part_id` column instead of `serial_id` (create-copy-drop-rename pattern)
    - Drop and recreate all affected indexes with new names
    - Update `counters` table: rename key `sn` → `part`
    - Update `settings.page_toggles` JSON: replace `"serials"` key with `"partsBrowser"`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.2 Update `server/utils/idGenerator.ts`
    - Rename `createSequentialSnGenerator` → `createSequentialPartIdGenerator`
    - Change default prefix from `SN-` to `part_`
    - _Requirements: 4.6, 8.1_

  - [x] 1.3 Write property test for ID generator prefix format
    - **Property 4: ID Generator Produces `part_`-Prefixed Sequential IDs**
    - Create `tests/properties/partIdGenerator.property.test.ts`
    - **Validates: Requirements 4.6, 8.1**

- [x] 2. Domain types rename
  - [x] 2.1 Rename types in `server/types/domain.ts`
    - `SerialNumber` → `Part`, `SnStepStatus` → `PartStepStatus`, `SnStepOverride` → `PartStepOverride`, `SnStepStatusValue` → `PartStepStatusValue`
    - Rename `AuditAction` values: `serial_created` → `part_created`, `serial_advanced` → `part_advanced`, `serial_completed` → `part_completed`, `serial_scrapped` → `part_scrapped`, `serial_force_completed` → `part_force_completed`
    - Rename `PageToggles.serials` → `PageToggles.partsBrowser`
    - _Requirements: 2.1, 2.4, 2.7, 6.7_

  - [x] 2.2 Rename types in `server/types/api.ts`
    - `BatchCreateSerialsInput` → `BatchCreatePartsInput`, `AdvanceSerialInput` → `AdvancePartInput`, `ScrapSerialInput` → `ScrapPartInput`
    - Rename all `serialId` / `serialIds` fields → `partId` / `partIds`
    - _Requirements: 2.5, 2.3_

  - [x] 2.3 Rename types in `server/types/computed.ts`
    - `EnrichedSerial` → `EnrichedPart`, `SnStepStatusView` → `PartStepStatusView`
    - `JobProgress` fields: `totalSerials` → `totalParts`, `completedSerials` → `completedParts`, `inProgressSerials` → `inProgressParts`, `scrappedSerials` → `scrappedParts`
    - `CertAttachment.serialId` → `CertAttachment.partId`, `AuditEntry.serialId` → `AuditEntry.partId`
    - _Requirements: 2.6, 2.3_

  - [x] 2.4 Update `server/utils/serialization.ts`
    - Update any `DomainType` references from `SerialNumber` → `Part`
    - Update field validation for renamed fields (`serialId` → `partId`)
    - _Requirements: 2.3_

- [x] 3. Repository layer rename
  - [x] 3.1 Rename repository interfaces
    - `server/repositories/interfaces/serialRepository.ts` → `partRepository.ts`: `SerialRepository` → `PartRepository`, return types `SerialNumber` → `Part`
    - `server/repositories/interfaces/snStepStatusRepository.ts` → `partStepStatusRepository.ts`: `SnStepStatusRepository` → `PartStepStatusRepository`, params `serialId` → `partId`
    - `server/repositories/interfaces/snStepOverrideRepository.ts` → `partStepOverrideRepository.ts`: `SnStepOverrideRepository` → `PartStepOverrideRepository`, params `serialId` → `partId`
    - Update `certRepository.ts`: `attachToSerial` → `attachToPart`, param `serialId` → `partId`
    - Update `auditRepository.ts`: `listBySerialId` → `listByPartId`
    - Update barrel export `server/repositories/interfaces/index.ts`
    - _Requirements: 3.1, 3.2, 3.4, 3.6_

  - [x] 3.2 Rename SQLite repository implementations
    - `server/repositories/sqlite/serialRepository.ts` → `partRepository.ts`: update all SQL to reference `parts` table
    - `server/repositories/sqlite/snStepStatusRepository.ts` → `partStepStatusRepository.ts`: update SQL to reference `part_step_statuses`, column `serial_id` → `part_id`
    - `server/repositories/sqlite/snStepOverrideRepository.ts` → `partStepOverrideRepository.ts`: update SQL to reference `part_step_overrides`, column `serial_id` → `part_id`
    - Update `server/repositories/sqlite/certRepository.ts`: SQL column `serial_id` → `part_id`
    - Update `server/repositories/sqlite/auditRepository.ts`: SQL column `serial_id` → `part_id`
    - _Requirements: 3.5, 3.2_

  - [x] 3.3 Update `RepositorySet` and factory
    - Update `server/repositories/sqlite/index.ts`: keys `serials` → `parts`, `snStepStatuses` → `partStepStatuses`, `snStepOverrides` → `partStepOverrides`
    - Update `server/repositories/factory.ts` and `server/repositories/types.ts` if applicable
    - _Requirements: 3.3_

  - [x] 3.4 Write property test for repository CRUD round-trip
    - **Property 3: Repository CRUD Round-Trip on Renamed Tables**
    - Create `tests/properties/partRepositoryRoundTrip.property.test.ts`
    - **Validates: Requirements 3.5**

- [x] 4. Service layer rename
  - [x] 4.1 Rename `server/services/serialService.ts` → `partService.ts`
    - `createSerialService` → `createPartService`, `SerialService` → `PartService`
    - All method names: `createSerials` → `createParts`, `advanceSerial` → `advancePart`, etc.
    - Update all internal variable names from `serial` → `part`
    - _Requirements: 4.1, 4.2_

  - [x] 4.2 Update `server/services/lifecycleService.ts`
    - Rename all method signatures and internal references from `serial` → `part`
    - _Requirements: 4.3_

  - [x] 4.3 Update service wiring and singletons
    - Update `server/utils/services.ts`: `serialService` → `partService` in `ServiceSet` type and wiring, counter key `'sn'` → `'part'`
    - Update `server/utils/db.ts` if it references serial repo keys
    - _Requirements: 4.4, 4.5_

  - [x] 4.4 Write property test for audit action values
    - **Property 2: Audit Actions Use Renamed Values**
    - Create `tests/properties/partAuditActions.property.test.ts`
    - **Validates: Requirements 2.7, 4.5**

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. API routes rename
  - [x] 6.1 Move and rename serial API routes
    - Move `server/api/serials/` → `server/api/parts/` (entire directory including `[id]/` subdirectory with all lifecycle routes: advance, scrap, force-complete, advance-to, attach-cert, cert-attachments, overrides, step-statuses, waive-step, complete-deferred)
    - Update all route handlers: `getServices().serialService` → `getServices().partService`
    - Update request/response field names: `serialId` → `partId`, etc.
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 6.2 Move audit and notes serial routes
    - Move `server/api/audit/serial/[id].get.ts` → `server/api/audit/part/[id].get.ts`
    - Move `server/api/notes/serial/[id].get.ts` → `server/api/notes/part/[id].get.ts`
    - Update handler references
    - _Requirements: 5.5, 5.6_

  - [x] 6.3 Update operator API routes
    - Update `server/api/operator/` routes to use "part" naming in query parameters and response fields (e.g., `serialCount` → `partCount`)
    - _Requirements: 5.7_

- [x] 7. Frontend composables and components rename
  - [x] 7.1 Rename composable files
    - `app/composables/useSerials.ts` → `useParts.ts`: update API URLs `/api/serials/` → `/api/parts/`, rename exported refs/functions
    - `app/composables/useSerialBrowser.ts` → `usePartBrowser.ts`: update API URLs, rename exports
    - Update `app/composables/usePartDetail.ts`: API URLs `/api/serials/` → `/api/parts/`
    - Update `app/composables/useLifecycle.ts`: API URLs
    - Update `app/composables/useAudit.ts`: API URL `/api/audit/serial/` → `/api/audit/part/`
    - Update `app/composables/useNotes.ts`: API URL `/api/notes/serial/` → `/api/notes/part/`
    - Update all composables referencing `serialId` → `partId` in variable names
    - _Requirements: 6.1, 6.2_

  - [x] 7.2 Rename component files
    - `app/components/SerialBatchForm.vue` → `PartBatchForm.vue`
    - `app/components/SerialCreationPanel.vue` → `PartCreationPanel.vue`
    - `app/components/JobSerialNumbersTab.vue` → `JobPartsTab.vue`
    - Update all prop names, event names, variable names from `serial` → `part`
    - _Requirements: 6.3, 6.4_

  - [x] 7.3 Update all user-visible text in components
    - Replace "Serial Number" → "Part", "serial" → "part", "SN" → "Part" in all component templates
    - Includes page titles, table column headers, form labels, placeholder text, toast messages, empty state messages, tooltips, confirmation dialogs
    - Update `app/components/PartDetailNotes.vue`, `app/components/ProcessAdvancementPanel.vue`, `app/components/StepTracker.vue`, `app/components/ScrapDialog.vue`, `app/components/ForceCompleteDialog.vue`, and any other components with serial-related text
    - _Requirements: 6.8_

- [x] 8. Frontend pages and navigation rename
  - [x] 8.1 Rename serial pages
    - Move `app/pages/serials/index.vue` → `app/pages/parts-browser/index.vue`
    - Move `app/pages/serials/[id].vue` → `app/pages/parts-browser/[id].vue`
    - Update page titles: "Serial Number Browser" → "Parts Browser"
    - Update all internal links from `/serials/` to `/parts-browser/`
    - _Requirements: 6.5_

  - [x] 8.2 Update sidebar navigation and page toggles
    - Update `app/app.vue`: nav item label "Serials" → "Parts Browser", route `/serials` → `/parts-browser`
    - Update `server/utils/pageToggles.ts`: `DEFAULT_PAGE_TOGGLES.serials` → `DEFAULT_PAGE_TOGGLES.partsBrowser`, `ROUTE_TOGGLE_MAP['/serials']` → `ROUTE_TOGGLE_MAP['/parts-browser']`
    - Update `app/utils/pageToggles.ts`: same changes (client-side re-export)
    - Update `app/middleware/pageGuard.global.ts` if it references `/serials`
    - _Requirements: 6.6, 6.7_

  - [x] 8.3 Update cross-page references
    - Update `app/pages/jobs/[id].vue`: tab label "Serial Numbers" → "Parts", component reference `JobSerialNumbersTab` → `JobPartsTab`
    - Update any other pages that link to `/serials/` or reference serial terminology (e.g., `app/pages/parts/index.vue`, `app/pages/parts/step/[stepId].vue`, `app/pages/queue.vue`, `app/pages/audit.vue`, `app/pages/settings.vue`)
    - _Requirements: 6.8_

- [x] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Seed data and test suite rename
  - [x] 10.1 Update seed script
    - Update `server/scripts/seed.ts`: all variable names, function calls, comments from "serial" → "part"
    - Update service/repo calls to use new method names (`createParts`, `partService`, etc.)
    - _Requirements: 7.1_

  - [x] 10.2 Update unit test files
    - Rename `tests/unit/services/serialService.test.ts` → `partService.test.ts` and update all imports, variable names, assertions
    - Update `tests/unit/utils/idGenerator.test.ts`: test new `createSequentialPartIdGenerator` name and `part_` prefix
    - Update `tests/unit/utils/serialization.test.ts`: renamed types
    - Update `tests/unit/utils/services.test.ts`: `serialService` → `partService`
    - Update `tests/unit/components/SerialCreationPanel.test.ts` → `PartCreationPanel.test.ts`
    - Update `tests/unit/components/serialNoteAdd.test.ts` if it references serial naming
    - _Requirements: 7.2_

  - [x] 10.3 Update property-based test files
    - Rename and update all property test files referencing "serial": `serialUniqueness` → `partUniqueness`, `serialBrowser` → `partBrowser`, `serialDetailSections` → `partDetailSections`, `serialEnrichment` → `partEnrichment`, `serialNoteAddButton` → `partNoteAddButton`, `serialNoteCancel` → `partNoteCancel`, `serialNoteErrorPreserve` → `partNoteErrorPreserve`, `serialNoteFormExclusive` → `partNoteFormExclusive`, `serialNoteRoundTrip` → `partNoteRoundTrip`, `serialNoteSaveReset` → `partNoteSaveReset`, `serialNoteWhitespace` → `partNoteWhitespace`, `siblingSerials` → `siblingParts`
    - Update all imports, type references, variable names, and assertions in these files
    - Update `scrappedSnStepQuery` → `scrappedPartStepQuery` and any other `sn`/`Sn` references in property tests
    - _Requirements: 7.3_

  - [x] 10.4 Update integration test files
    - Update `tests/integration/helpers.ts`: `serials` repo key → `parts`, serial service method references → part
    - Update all 14 integration test files: variable names, type references, service calls, assertions from "serial" → "part"
    - Key files: `jobLifecycle.test.ts`, `certTraceability.test.ts`, `scrapWorkflow.test.ts`, `forceComplete.test.ts`, `flexibleAdvancement.test.ts`, `operatorView.test.ts`, `operatorViewRedesign.test.ts`, `noteAndDefect.test.ts`, `stepOverride.test.ts`, `progressTracking.test.ts`
    - _Requirements: 7.4, 7.5_

  - [x] 10.5 Update remaining property tests that reference serial types indirectly
    - Update property tests that import or reference serial-related types even if not named "serial": `firstStepSerialCreation` → `firstStepPartCreation`, `stepStatusConservation`, `countConservation`, `stepAdvancement`, `auditTrail`, `lifecycleAuditCompleteness`, `forceCompleteAuditFidelity`, `scrapExclusion`, `scrapImmutability`, `bonusPartTracking`, `totalPartsInvariant`, etc.
    - Grep for any remaining `serial`, `Serial`, `sn_`, `Sn` references across all test files and update
    - _Requirements: 7.3, 7.4_

- [x] 11. Backward compatibility for existing SN- prefixed IDs
  - [x] 11.1 Verify dual-prefix lookup works
    - Ensure `PartRepository` reads records with both `SN-` and `part_` prefixed IDs from the `parts` table without error
    - Ensure `PartService` treats both prefixes as valid part identifiers in all operations (advance, scrap, force-complete, etc.)
    - No code changes needed if the repository already does plain ID lookups — just verify and add a comment documenting the backward compatibility
    - _Requirements: 8.2, 8.3, 8.4_

  - [x] 11.2 Write property test for dual ID prefix compatibility
    - **Property 5: Dual ID Prefix Compatibility**
    - Create `tests/properties/dualIdPrefixCompat.property.test.ts`
    - **Validates: Requirements 8.2, 8.3, 8.4**

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm run test` and verify all 682+ tests pass with zero failures attributable to the rename.
  - _Requirements: 7.6_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The rename proceeds bottom-up (DB → types → repos → services → API → frontend → tests) so each layer compiles before the next is touched
- Existing `SN-` prefixed IDs in the database are preserved — no data transformation needed, just table/column renames
