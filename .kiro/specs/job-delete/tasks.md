# Implementation Plan: Job Delete

## Overview

Add delete functionality to Jobs in Shop Planr. A job can only be deleted when it has no paths, no parts, and no BOM contributing job references. Implementation spans the BOM repository (new `countContributingJobRefs` method), job service (`deleteJob` + `canDeleteJob`), API route (`DELETE /api/jobs/:id`), and frontend (delete button with confirmation modal on the job detail page).

## Tasks

- [x] 1. Extend BomRepository with countContributingJobRefs
  - [x] 1.1 Add `countContributingJobRefs(jobId: string): number` to the `BomRepository` interface in `server/repositories/interfaces/bomRepository.ts`
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Implement `countContributingJobRefs` in `SQLiteBomRepository` (`server/repositories/sqlite/bomRepository.ts`)
    - Query `SELECT COUNT(*) FROM bom_contributing_jobs WHERE job_id = ?`
    - Return 0 when no rows match
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Extend JobService with deleteJob and canDeleteJob
  - [x] 2.1 Update `createJobService` factory signature in `server/services/jobService.ts` to accept `bom: BomRepository` in the repos parameter
    - _Requirements: 7.1, 7.2_
  - [x] 2.2 Implement `deleteJob(id: string): void` method on the job service
    - Verify job exists (throw NotFoundError if not)
    - Check paths via `paths.listByJobId(id)` — throw ValidationError if any
    - Check parts via `parts.countByJobId(id)` — throw ValidationError if > 0
    - Check BOM refs via `bom.countContributingJobRefs(id)` — throw ValidationError if > 0
    - Delete via `jobs.delete(id)` if all checks pass
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 2.3 Implement `canDeleteJob(id: string): { canDelete: boolean; reasons: string[] }` method on the job service
    - Verify job exists (throw NotFoundError if not)
    - Collect human-readable reasons for each blocker type
    - Return `{ canDelete: true, reasons: [] }` when no dependents
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 2.4 Write unit tests for deleteJob and canDeleteJob
    - Test deleteJob with no dependents → succeeds, job removed
    - Test deleteJob with paths → throws ValidationError
    - Test deleteJob with parts → throws ValidationError
    - Test deleteJob with BOM refs → throws ValidationError
    - Test deleteJob with non-existent ID → throws NotFoundError
    - Test canDeleteJob returns correct canDelete and reasons for each scenario
    - Add mock BomRepository to existing test setup in `tests/unit/services/jobService.test.ts`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4_

- [x] 3. Update service wiring to pass BOM repository
  - Update `getServices()` in `server/utils/services.ts` to pass `bom: repos.bom` to `createJobService`
    - _Requirements: 7.1, 7.2_

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create DELETE API route
  - [x] 5.1 Create `server/api/jobs/[id].delete.ts` API route handler
    - Extract `id` from route params
    - Call `jobService.deleteJob(id)`
    - Return 204 No Content on success
    - Map ValidationError → 400, NotFoundError → 404
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 5.2 Write property tests for job deletion safety
    - [x] 5.2.1 Write property test for Property 1: Deletion Safety
      - **Property 1: Deletion Safety** — For any job, if deleteJob succeeds then the job had 0 paths, 0 parts, and 0 BOM refs at deletion time
      - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
    - [x] 5.2.2 Write property test for Property 2: Deletion Rejection
      - **Property 2: Deletion Rejection** — For any job with at least one dependent, deleteJob throws ValidationError and the job remains in the database
      - **Validates: Requirements 2.2, 2.3, 2.4**
    - [x] 5.2.3 Write property test for Property 3: Deletion Completeness
      - **Property 3: Deletion Completeness** — For any job with no dependents, after deleteJob succeeds, getById returns null
      - **Validates: Requirements 2.1, 2.6**
    - [x] 5.2.4 Write property test for Property 4: Not Found Invariant
      - **Property 4: Not Found Invariant** — For any non-existent ID, both deleteJob and canDeleteJob throw NotFoundError
      - **Validates: Requirements 2.5, 3.3**
    - [x] 5.2.5 Write property test for Property 5: canDeleteJob Consistency
      - **Property 5: canDeleteJob Consistency** — canDeleteJob returning canDelete:true implies deleteJob succeeds, and canDelete:false implies deleteJob throws ValidationError
      - **Validates: Requirements 2.1, 3.1, 3.2**

- [x] 6. Extend useJobs composable with deleteJob
  - Add `deleteJob(id: string): Promise<void>` to `app/composables/useJobs.ts`
    - Send DELETE request to `/api/jobs/${id}`
    - Refresh jobs list on success
    - Propagate errors to caller
    - _Requirements: 6.1, 6.2_

- [x] 7. Add delete button and confirmation modal to job detail page
  - [x] 7.1 Add delete button to job header in `app/pages/jobs/[id].vue`
    - Place next to existing Edit button
    - Disable when job has paths or parts (use already-loaded progress data)
    - _Requirements: 5.1, 5.2_
  - [x] 7.2 Add UModal confirmation dialog for delete action
    - Show confirmation text with job name
    - On confirm: call `deleteJob(jobId)`, navigate to `/jobs` on success
    - On error: show error message in toast, remain on page
    - _Requirements: 5.3, 5.4, 5.5_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The `createJobService` factory currently receives `{ jobs, paths, parts }` — task 2.1 adds `bom` to this
- The `jobs.delete(id)` and `parts.countByJobId(id)` repository methods already exist
- Error classes `ValidationError` and `NotFoundError` already exist in `server/utils/errors.ts`
- Property tests use `fast-check` with the patterns established in `tests/properties/`
- Frontend uses Nuxt UI components (UModal, UButton) and follows the existing useJobs composable pattern
