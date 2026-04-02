# Implementation Plan: HTTP Error Handler

## Overview

Create `server/utils/httpError.ts` with `STATUS_MESSAGES`, `ERROR_STATUS_MAP`, `httpError()`, and `defineApiHandler()`. Then migrate all ~65 API route files from `defineEventHandler` + try/catch to `defineApiHandler`. Property-based tests validate the four correctness properties; unit tests cover static map completeness and edge cases.

## Tasks

- [x] 1. Create the httpError utility module
  - [x] 1.1 Create `server/utils/httpError.ts` with `STATUS_MESSAGES`, `ErrorStatusEntry` interface, `ERROR_STATUS_MAP`, `httpError()`, and `defineApiHandler()`
    - `STATUS_MESSAGES`: Record<number, string> with codes 400, 401, 403, 404, 409, 422, 500 and their RFC 9110 reason phrases
    - `ERROR_STATUS_MAP`: Array of `{ errorClass, statusCode }` entries for `ValidationError` → 400 and `NotFoundError` → 404
    - `httpError(error: unknown): never`: checks `isError()` for H3Error passthrough, iterates `ERROR_STATUS_MAP` with `instanceof`, falls back to 500 with generic message; uses `STATUS_MESSAGES` lookup with "Unknown Error" fallback for `statusMessage`
    - `defineApiHandler<T>(handler)`: wraps handler in `defineEventHandler` with try/catch delegating to `httpError()`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2_

  - [x] 1.2 Write property test: Mapped error classification preserves status and message
    - **Property 1: Mapped error classification preserves status and message**
    - Create `tests/properties/httpErrorHandler.property.test.ts`
    - Generate random `{ errorClass, statusCode, message }` from `ERROR_STATUS_MAP` entries with `fc.oneof` + `fc.string({ minLength: 1 })`
    - Assert caught H3Error has correct `statusCode`, `statusMessage` from `STATUS_MESSAGES`, and original `message`
    - Minimum 100 iterations
    - **Validates: Requirements 1.2, 2.1, 2.2, 5.1, 5.2, 5.4, 7.1, 7.2, 7.3**

  - [x] 1.3 Write property test: Unknown errors produce 500 with generic message
    - **Property 2: Unknown errors produce 500 with generic message**
    - Add to `tests/properties/httpErrorHandler.property.test.ts`
    - Generate random `fc.string({ minLength: 1 })` messages, wrap in `new Error(msg)`
    - Assert caught H3Error has `statusCode` 500, `statusMessage` "Internal Server Error", `message` "Internal server error"
    - Verify original error message does NOT leak
    - Minimum 100 iterations
    - **Validates: Requirements 2.3, 4.4, 5.3, 7.4**

  - [x] 1.4 Write property test: H3Error passthrough
    - **Property 3: H3Error passthrough**
    - Add to `tests/properties/httpErrorHandler.property.test.ts`
    - Generate random `fc.record({ statusCode: fc.integer({ min: 400, max: 599 }), message: fc.string({ minLength: 1 }) })`, create H3Errors via `createError()`
    - Assert re-thrown error is reference-equal to the original
    - Minimum 100 iterations
    - **Validates: Requirements 2.4**

  - [x] 1.5 Write property test: Happy-path passthrough
    - **Property 4: Happy-path passthrough**
    - Add to `tests/properties/httpErrorHandler.property.test.ts`
    - Generate arbitrary return values with `fc.anything()`
    - Wrap in a handler via `defineApiHandler`, invoke, assert returned value equals generated value
    - Minimum 100 iterations
    - **Validates: Requirements 3.3**

  - [x] 1.6 Write unit tests for httpError utility
    - Create `tests/unit/utils/httpError.test.ts`
    - Test `STATUS_MESSAGES` contains all 7 required codes with correct RFC 9110 phrases (Req 1.4)
    - Test unmapped status code fallback produces `statusMessage: "Unknown Error"` (Req 1.3)
    - Test `ERROR_STATUS_MAP` is an array (structural check for data-driven mapping) (Req 6.2)
    - Test specific `ValidationError("Name is required")` → 400, "Bad Request", "Name is required"
    - Test specific `NotFoundError("Job", "J-123")` → 404, "Not Found", "Job not found: J-123"
    - _Requirements: 1.3, 1.4, 2.1, 2.2, 6.2_

- [x] 2. Checkpoint — Verify utility and tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Migrate jobs routes to defineApiHandler
  - [x] 3.1 Migrate `server/api/jobs/` routes (6 files)
    - `index.get.ts`, `index.post.ts`, `[id].get.ts`, `[id].put.ts`, `[id].delete.ts`, `priorities.patch.ts`
    - Replace `defineEventHandler` + try/catch with `defineApiHandler`, remove catch blocks
    - Preserve all request parsing, service calls, and response logic unchanged
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4. Migrate templates routes to defineApiHandler
  - [x] 4.1 Migrate `server/api/templates/` routes (6 files)
    - `index.get.ts`, `index.post.ts`, `[id].get.ts`, `[id].put.ts`, `[id].delete.ts`, `[id]/apply.post.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. Migrate parts routes to defineApiHandler
  - [x] 5.1 Migrate `server/api/parts/` routes (16 files)
    - `index.get.ts`, `index.post.ts`, `[id].get.ts`
    - `[id]/advance.post.ts`, `[id]/advance-to.post.ts`, `[id]/scrap.post.ts`, `[id]/force-complete.post.ts`
    - `[id]/attach-cert.post.ts`, `[id]/cert-attachments.get.ts`, `[id]/overrides.get.ts`, `[id]/overrides.post.ts`
    - `[id]/overrides/[stepId].delete.ts`, `[id]/step-statuses.get.ts`, `[id]/full-route.get.ts`
    - `[id]/waive-step/[stepId].post.ts`, `[id]/complete-deferred/[stepId].post.ts`
    - Note: some files (step-statuses, cert-attachments, overrides.get) have no try/catch but use inline `createError()` — these still benefit from `defineApiHandler` for consistency; preserve their inline `createError()` calls (they produce H3Errors that pass through unchanged)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6. Migrate paths, certs, bom routes to defineApiHandler
  - [x] 6.1 Migrate `server/api/paths/` routes (4 files)
    - `index.post.ts`, `[id].get.ts`, `[id].put.ts`, `[id].delete.ts`, `[id]/advancement-mode.patch.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 6.2 Migrate `server/api/certs/` routes (5 files)
    - `index.get.ts`, `index.post.ts`, `[id].get.ts`, `batch-attach.post.ts`, `[id]/attachments.get.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 6.3 Migrate `server/api/bom/` routes (4 files)
    - `index.get.ts`, `index.post.ts`, `[id].get.ts`, `[id].put.ts`, `[id]/edit.post.ts`, `[id]/versions.get.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 7. Migrate remaining routes to defineApiHandler
  - [x] 7.1 Migrate `server/api/users/` routes (3 files)
    - `index.get.ts`, `index.post.ts`, `[id].put.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 7.2 Migrate `server/api/settings/` routes (2 files)
    - `index.get.ts`, `index.put.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 7.3 Migrate `server/api/audit/` routes (2 files)
    - `index.get.ts`, `part/[id].get.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 7.4 Migrate `server/api/notes/` routes (3 files)
    - `index.post.ts`, `part/[id].get.ts`, `step/[id].get.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 7.5 Migrate `server/api/steps/` routes (2 files)
    - `[id]/assign.patch.ts`, `[id]/config.patch.ts`
    - Note: `config.patch.ts` has no try/catch but uses inline `createError()` — preserve those, wrap in `defineApiHandler` for consistency
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 7.6 Migrate `server/api/jira/` routes (5 files)
    - `tickets.get.ts`, `tickets/[key].get.ts`, `comment.post.ts`, `link.post.ts`, `push.post.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 7.7 Migrate `server/api/operator/` routes (5 files)
    - `[stepName].get.ts`, `work-queue.get.ts`, `queue/_all.get.ts`, `queue/[userId].get.ts`, `step/[stepId].get.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 7.8 Migrate `server/api/library/` routes (4 files)
    - `locations.get.ts`, `locations.post.ts`, `processes.get.ts`, `processes.post.ts`, `locations/[id].delete.ts`, `processes/[id].delete.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - All existing integration tests in `tests/integration/` must still pass unchanged, confirming migrated routes preserve behavior (Req 4.3)

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Routes with no try/catch but inline `createError()` calls (step-statuses, cert-attachments, overrides.get, config.patch) still get wrapped in `defineApiHandler` for consistency — their `createError()` calls produce H3Errors that pass through unchanged via Property 3
- `server/utils/httpError.ts` is auto-imported by Nitro — no explicit imports needed in route files
- `notes/step/[id].get.ts` was not visible in grep results but exists in the directory listing — include in migration
