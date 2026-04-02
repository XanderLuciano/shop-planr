# Implementation Plan: Admin Path Delete

## Overview

Implement admin-only force-delete for paths with cascade deletion of all dependent records, server-side authorization via ForbiddenError, audit trail recording, frontend confirmation modal, and parts browser scrapped status filter. All backend logic uses TypeScript with the existing Nuxt/SQLite stack.

## Tasks

- [x] 1. Add ForbiddenError and extend domain types
  - [x] 1.1 Add ForbiddenError class to `server/utils/errors.ts` and register in `ERROR_STATUS_MAP` in `server/utils/httpError.ts` with statusCode 403
    - Add `ForbiddenError` class following the existing `ValidationError`/`NotFoundError` pattern
    - Add `{ errorClass: ForbiddenError, statusCode: 403 }` entry to `ERROR_STATUS_MAP`
    - _Requirements: 1.2_
  - [x] 1.2 Add `'path_deleted'` to `AuditAction` union type in `server/types/domain.ts`
    - Append `'path_deleted'` to the existing union
    - _Requirements: 3.1_
  - [x] 1.3 Add `DeletePathInput` interface to `server/types/api.ts`
    - Define `DeletePathInput { userId: string }`
    - _Requirements: 1.1, 1.4_

- [x] 2. Add bulk-delete repository methods
  - [x] 2.1 Add `deleteByStepIds(stepIds: string[]): number` to `NoteRepository` interface and SQLite implementation
    - Interface: `server/repositories/interfaces/noteRepository.ts`
    - Implementation: `server/repositories/sqlite/noteRepository.ts` — DELETE FROM step_notes WHERE step_id IN (...)
    - _Requirements: 2.2_
  - [x] 2.2 Add `deleteByPartIds(partIds: string[]): number` to `PartStepOverrideRepository` interface and SQLite implementation
    - Interface: `server/repositories/interfaces/partStepOverrideRepository.ts`
    - Implementation: `server/repositories/sqlite/partStepOverrideRepository.ts` — DELETE FROM part_step_overrides WHERE part_id IN (...)
    - _Requirements: 2.3_
  - [x] 2.3 Add `deleteAttachmentsByPartIds(partIds: string[]): number` to `CertRepository` interface and SQLite implementation
    - Interface: `server/repositories/interfaces/certRepository.ts`
    - Implementation: `server/repositories/sqlite/certRepository.ts` — DELETE FROM cert_attachments WHERE part_id IN (...)
    - _Requirements: 2.4_
  - [x] 2.4 Add `deleteByPartIds(partIds: string[]): number` to `PartStepStatusRepository` interface and SQLite implementation
    - Interface: `server/repositories/interfaces/partStepStatusRepository.ts`
    - Implementation: `server/repositories/sqlite/partStepStatusRepository.ts` — DELETE FROM part_step_statuses WHERE part_id IN (...)
    - _Requirements: 2.5_
  - [x] 2.5 Add `deleteByPathId(pathId: string): number` to `PartRepository` interface and SQLite implementation
    - Interface: `server/repositories/interfaces/partRepository.ts`
    - Implementation: `server/repositories/sqlite/partRepository.ts` — DELETE FROM parts WHERE path_id = ?
    - _Requirements: 2.6_

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement pathService cascade delete and audit
  - [x] 4.1 Add `recordPathDeletion` method to `auditService` in `server/services/auditService.ts`
    - Action: `'path_deleted'`, params: `{ userId, pathId, jobId, metadata: { pathName, deletedPartIds, deletedPartCount } }`
    - Follow existing `createEntry` pattern
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 4.2 Update `createPathService` in `server/services/pathService.ts` to accept new dependencies and implement admin force-delete
    - Expand the repos parameter to include `notes`, `partStepOverrides`, `certs`, `partStepStatuses`, `db` (Database handle for transactions)
    - Change `deletePath(id: string)` signature to `deletePath(id: string, userId: string)`
    - Add validation: missing userId → `ValidationError`, user not found → `ValidationError`, non-admin → `ForbiddenError`, path not found → `NotFoundError`
    - For zero-part paths: delete path directly (existing behavior)
    - For paths with parts: cascade delete inside `db.transaction()` in FK-safe order: notes by stepIds → overrides by partIds → cert attachments by partIds → step statuses by partIds → parts by pathId → path delete (steps auto-cascade)
    - Return `{ deletedPartIds, deletedPartCount }` for audit and API response
    - Record audit entry via `auditService.recordPathDeletion()` after transaction commits
    - Accept `auditService` as a second parameter to `createPathService` (or inject via repos)
    - _Requirements: 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.1, 3.2, 3.3_
  - [x] 4.3 Update service wiring in `server/utils/services.ts` to pass new repos and auditService to `createPathService`
    - Pass `notes`, `partStepOverrides`, `certs`, `partStepStatuses`, `db` (repos._db), and `auditService` to `createPathService`
    - _Requirements: 2.8_
  - [x] 4.4 Write property test: Property 1 — Non-admin users are rejected
    - **Property 1: Non-admin users are rejected**
    - **Validates: Requirements 1.2**
    - File: `tests/properties/adminPathDelete.property.test.ts`
    - Generate random non-admin users + paths, verify `ForbiddenError` is thrown and path remains in DB
  - [x] 4.5 Write property test: Property 2 — Cascade delete completeness
    - **Property 2: Cascade delete completeness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**
    - File: `tests/properties/adminPathDelete.property.test.ts`
    - Generate paths with random numbers of parts (each with random dependent records), execute admin delete, query all tables to verify zero remaining records for deleted IDs
  - [x] 4.6 Write property test: Property 3 — Audit entry completeness
    - **Property 3: Audit entry completeness**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - File: `tests/properties/adminPathDelete.property.test.ts`
    - Generate paths with random parts, execute admin delete, verify audit entry fields match (userId, pathId, jobId, metadata.pathName, metadata.deletedPartCount, metadata.deletedPartIds)

- [x] 5. Update API route and existing tests
  - [x] 5.1 Update `server/api/paths/[id].delete.ts` to read `userId` from request body and pass to service
    - Read body, validate `userId` presence (throw `ValidationError` if missing), call `pathService.deletePath(id, body.userId)`, return `{ success: true, ...result }`
    - _Requirements: 1.1, 1.4_
  - [x] 5.2 Update existing pathService unit tests to account for new `deletePath` signature
    - Tests in `tests/unit/services/pathService.test.ts` mock `deletePath` — update mocks to pass `userId` parameter
    - _Requirements: 1.1, 2.1_
  - [x] 5.3 Write unit tests for ForbiddenError HTTP mapping, missing userId, non-existent user/path, zero-part deletion
    - Verify `httpError()` maps `ForbiddenError` to 403 with correct statusMessage
    - Test missing userId returns 400, non-existent user returns 400, non-existent path returns 404
    - Test zero-part path deletion still works (existing behavior preserved)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.9_

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Frontend: update composables and PathDeleteButton
  - [x] 7.1 Update `deletePath` in `app/composables/usePaths.ts` to accept and send `userId`
    - Change signature to `deletePath(id: string, userId: string): Promise<void>`
    - Send `{ userId }` as request body in the DELETE fetch call
    - _Requirements: 1.1_
  - [x] 7.2 Update `useJobForm.ts` to pass `userId` when deleting paths
    - Import `useUsers` and call `requireUser()` to get the current user
    - In `submitEdit`, pass `requireUser().id` to `deletePath(path.id, userId)`
    - _Requirements: 1.1_
  - [x] 7.3 Update `PathDeleteButton.vue` for admin force-delete UX
    - Remove `canDelete` computed — button is always enabled (component only renders for admins via parent `v-if="isAdmin"`)
    - Add `showModal` ref for modal confirmation when `partCount > 0`
    - When `partCount === 0`: use existing inline confirmation flow
    - When `partCount > 0`: show `UModal` with warning text about permanent deletion of N parts, confirm/cancel buttons
    - Send `userId` via `useUsers().requireUser().id` in the DELETE request body
    - Display part count `UBadge` next to delete button when `partCount > 0`
    - Handle 403 errors with "Admin access required" message
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.4_
  - [x] 7.4 Update existing useJobForm tests to account for new `deletePath(id, userId)` signature
    - Tests in `tests/unit/composables/useJobForm.test.ts` mock `deletePath` — update mocks for the new parameter
    - _Requirements: 1.1_

- [x] 8. Frontend: parts browser scrapped status filter
  - [x] 8.1 Add `'scrapped'` to `PartBrowserFilters.status` type in `app/composables/usePartBrowser.ts`
    - Change type from `'in-progress' | 'completed' | 'all'` to `'in-progress' | 'completed' | 'scrapped' | 'all'`
    - _Requirements: 6.2_
  - [x] 8.2 Add "Scrapped" option to `statusOptions` in `app/pages/parts-browser/index.vue` and handle scrapped badge color
    - Add `{ label: 'Scrapped', value: 'scrapped' }` to `statusOptions` array
    - Update the `UBadge` color logic in both desktop table and mobile cards to handle `scrapped` status with `error` color
    - _Requirements: 6.1, 6.3, 6.4_
  - [x] 8.3 Write property test: Property 4 — Scrapped status filter
    - **Property 4: Scrapped status filter**
    - **Validates: Requirements 6.3**
    - File: `tests/properties/adminPathDelete.property.test.ts`
    - Generate random arrays of EnrichedPart with mixed statuses, apply `filterParts` with `{ status: 'scrapped' }`, verify only scrapped parts returned

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- No database migration needed — all operations are DELETE statements on existing tables
- The existing `process_steps` table has `ON DELETE CASCADE` from `paths`, so deleting the path auto-deletes steps AFTER all step-referencing records are removed first
- Existing pathService and useJobForm tests need updating since the `deletePath` signature changes
