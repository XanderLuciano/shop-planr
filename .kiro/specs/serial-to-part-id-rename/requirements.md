# Requirements Document

## Introduction

Rename the internal concept of "serial" / "serial number" to "part_id" across the entire Shop Planr codebase. The current naming ("serial") does not accurately reflect the domain concept — what the system tracks are part identifiers, not serial numbers in the traditional manufacturing sense. The rename aligns with the existing naming convention used elsewhere in the codebase (serial_id, step_id, etc.) and improves clarity for developers and operators. This is a pure refactoring effort with no behavioral changes.

## Glossary

- **Rename_Tool**: The codebase-wide rename operation that transforms "serial"-based identifiers to "part_id"-based identifiers across all layers
- **Migration_System**: The SQLite migration runner that applies forward-only schema changes via numbered SQL files in `server/repositories/sqlite/migrations/`
- **Domain_Types**: TypeScript interfaces in `server/types/domain.ts`, `server/types/api.ts`, and `server/types/computed.ts` that define the shape of all domain objects
- **Repository_Layer**: The data access interfaces (`server/repositories/interfaces/`) and SQLite implementations (`server/repositories/sqlite/`) that perform CRUD operations
- **Service_Layer**: The business logic modules in `server/services/` that orchestrate domain operations
- **API_Layer**: The Nitro server routes in `server/api/` that expose HTTP endpoints
- **Frontend_Layer**: Vue pages (`app/pages/`), components (`app/components/`), and composables (`app/composables/`) that render the UI
- **Seed_Script**: The `server/scripts/seed.ts` file that creates SAMPLE- test data
- **Test_Suite**: All test files in `tests/` including unit, property-based, and integration tests
- **ID_Prefix**: The short string prefix used in `generateId()` calls (e.g., `sn_` for serial numbers)

## Requirements

### Requirement 1: Database Schema Rename

**User Story:** As a developer, I want the database schema to use "part_id" naming instead of "serial" naming, so that the schema reflects the actual domain concept.

#### Acceptance Criteria

1. WHEN the Migration_System runs the new migration, THE Migration_System SHALL rename the `serials` table to `parts`
2. WHEN the Migration_System runs the new migration, THE Migration_System SHALL rename all columns referencing "serial" to use "part" naming (e.g., `serial_id` → `part_id` in `cert_attachments`, `audit_entries`, `sn_step_statuses`, `sn_step_overrides`)
3. WHEN the Migration_System runs the new migration, THE Migration_System SHALL rename the `sn_step_statuses` table to `part_step_statuses`
4. WHEN the Migration_System runs the new migration, THE Migration_System SHALL rename the `sn_step_overrides` table to `part_step_overrides`
5. WHEN the Migration_System runs the new migration, THE Migration_System SHALL recreate all indexes that referenced the old table or column names with updated names
6. WHEN the Migration_System runs the new migration, THE Migration_System SHALL preserve all existing data without loss or corruption

### Requirement 2: Domain Type Rename

**User Story:** As a developer, I want TypeScript domain types to use "part" naming instead of "serial" naming, so that the type system matches the database schema and domain language.

#### Acceptance Criteria

1. THE Domain_Types SHALL rename the `SerialNumber` interface to `Part`
2. THE Domain_Types SHALL rename the `SerialRepository` interface to `PartRepository`
3. THE Domain_Types SHALL rename all type fields containing "serial" to use "part" (e.g., `serialId` → `partId`, `serialIds` → `partIds`, `serialCount` → `partCount`)
4. THE Domain_Types SHALL rename `SnStepStatus` to `PartStepStatus` and `SnStepOverride` to `PartStepOverride`
5. THE Domain_Types SHALL rename API input types containing "serial" (e.g., `BatchCreateSerialsInput` → `BatchCreatePartsInput`, `AdvanceSerialInput` → `AdvancePartInput`, `ScrapSerialInput` → `ScrapPartInput`)
6. THE Domain_Types SHALL rename computed view types containing "serial" (e.g., `EnrichedSerial` → `EnrichedPart`, `completedSerials` → `completedParts`, `inProgressSerials` → `inProgressParts`)
7. THE Domain_Types SHALL rename `AuditAction` values that reference "serial" (e.g., `serial_created` → `part_created`, `serial_advanced` → `part_advanced`, `serial_completed` → `part_completed`, `serial_scrapped` → `part_scrapped`, `serial_force_completed` → `part_force_completed`)

### Requirement 3: Repository Layer Rename

**User Story:** As a developer, I want the repository layer to use "part" naming, so that data access code is consistent with the schema and domain types.

#### Acceptance Criteria

1. THE Repository_Layer SHALL rename the file `serialRepository.ts` to `partRepository.ts` in both interfaces and sqlite directories
2. THE Repository_Layer SHALL rename the `SerialRepository` interface to `PartRepository` and update all method signatures to use "part" naming (e.g., `listByPathId` returns `Part[]` instead of `SerialNumber[]`)
3. THE Repository_Layer SHALL update the `RepositorySet` type to use `parts` instead of `serials` as the repository key
4. THE Repository_Layer SHALL rename `SnStepStatusRepository` to `PartStepStatusRepository` and `SnStepOverrideRepository` to `PartStepOverrideRepository`
5. THE Repository_Layer SHALL update all SQL queries in SQLite implementations to reference the renamed tables and columns
6. THE Repository_Layer SHALL update the barrel export in `server/repositories/interfaces/index.ts` to export the renamed interfaces

### Requirement 4: Service Layer Rename

**User Story:** As a developer, I want the service layer to use "part" naming, so that business logic code uses consistent domain language.

#### Acceptance Criteria

1. THE Service_Layer SHALL rename `serialService.ts` to `partService.ts` and rename the service factory function from `createSerialService` to `createPartService`
2. THE Service_Layer SHALL rename all service methods that reference "serial" to use "part" (e.g., `createSerials` → `createParts`, `advanceSerial` → `advancePart`)
3. THE Service_Layer SHALL update `lifecycleService.ts` to use "part" naming in all method signatures and internal references
4. THE Service_Layer SHALL update the service singleton in `server/utils/services.ts` to expose `partService` instead of `serialService`
5. THE Service_Layer SHALL update `auditService.ts` to log renamed action values (e.g., `part_created` instead of `serial_created`)
6. THE Service*Layer SHALL update `server/utils/idGenerator.ts` to use a `part*`prefix instead of`sn\_` for generated part IDs, while preserving the sequential format

### Requirement 5: API Layer Rename

**User Story:** As a developer, I want API routes to use "part" naming in URLs and request/response bodies, so that the HTTP interface reflects the domain language.

#### Acceptance Criteria

1. THE API_Layer SHALL rename the route directory `server/api/serials/` to `server/api/parts/`
2. THE API_Layer SHALL update all route handlers to call `partService` instead of `serialService`
3. THE API_Layer SHALL update request body field names from "serial" to "part" naming in all route handlers
4. THE API_Layer SHALL update response body field names from "serial" to "part" naming in all route handlers
5. THE API_Layer SHALL update `server/api/audit/serial/[id].get.ts` to `server/api/audit/part/[id].get.ts`
6. THE API_Layer SHALL update `server/api/notes/serial/[id].get.ts` to `server/api/notes/part/[id].get.ts`
7. THE API_Layer SHALL update the operator API routes to use "part" naming in query parameters and response fields

### Requirement 6: Frontend Layer Rename

**User Story:** As a developer, I want the frontend to use "part" naming in composables, components, pages, and displayed text, so that the UI code and user-facing labels are consistent.

#### Acceptance Criteria

1. THE Frontend_Layer SHALL rename composable files referencing "serial" (e.g., `useSerials.ts` → `useParts.ts`, `useSerialBrowser.ts` → `usePartBrowser.ts`)
2. THE Frontend_Layer SHALL update all composable functions to call renamed API endpoints (e.g., `/api/parts/` instead of `/api/serials/`)
3. THE Frontend_Layer SHALL rename component files referencing "serial" (e.g., `SerialBatchForm.vue` → `PartBatchForm.vue`, `SerialCreationPanel.vue` → `PartCreationPanel.vue`, `JobSerialNumbersTab.vue` → `JobPartsTab.vue`)
4. THE Frontend_Layer SHALL update all component template text, variable names, and prop names from "serial" to "part" naming
5. THE Frontend_Layer SHALL rename the page directory `app/pages/serials/` to `app/pages/parts-browser/` (avoiding conflict with existing `app/pages/parts/`)
6. THE Frontend_Layer SHALL update the sidebar navigation in `app/app.vue` to display "Parts Browser" instead of "Serial Numbers" or similar labels
7. THE Frontend_Layer SHALL update the `PageToggles` interface to use `partsBrowser` instead of `serials` as the toggle key, and update all references in route guards, settings UI, and server-side toggle logic
8. THE Frontend_Layer SHALL replace all user-visible text that says "serial", "serial number", or "serials" with "part" or "parts" as appropriate — including page titles, table column headers, form labels, placeholder text, toast/notification messages, empty state messages, tooltips, and confirmation dialogs

### Requirement 7: Seed Data and Test Suite Rename

**User Story:** As a developer, I want seed data and tests to use "part" naming, so that test fixtures and assertions are consistent with the renamed codebase.

#### Acceptance Criteria

1. THE Seed_Script SHALL update all references to "serial" in variable names, function calls, and generated data to use "part" naming
2. THE Test_Suite SHALL update all unit test files that reference "serial" to use "part" naming in imports, variable names, and assertions
3. THE Test_Suite SHALL update all property-based test files that reference "serial" to use "part" naming (e.g., `serialUniqueness.property.test.ts` → `partUniqueness.property.test.ts`)
4. THE Test_Suite SHALL update all integration test files that reference "serial" to use "part" naming in test descriptions, variable names, and assertions
5. THE Test_Suite SHALL update the integration test helper (`tests/integration/helpers.ts`) to use "part" naming in context setup
6. WHEN the full test suite runs after the rename, THE Test_Suite SHALL pass all 682+ existing tests with zero failures attributable to the rename

### Requirement 8: ID Format Transition

**User Story:** As a developer, I want the ID generation to produce `part_` prefixed IDs for new records while remaining compatible with existing `SN-` prefixed records, so that the transition does not break existing data.

#### Acceptance Criteria

1. THE Rename*Tool SHALL update `server/utils/idGenerator.ts` to generate IDs with a `part*`prefix instead of`sn\_` for new part records
2. THE Repository_Layer SHALL continue to read and return existing records that have `SN-` prefixed IDs without error
3. THE Service*Layer SHALL treat both `SN-` and `part*` prefixed IDs as valid part identifiers
4. IF a lookup is performed with an `SN-` prefixed ID, THEN THE Repository_Layer SHALL return the matching record from the `parts` table
