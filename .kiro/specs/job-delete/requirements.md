# Requirements Document

## Introduction

This document defines the requirements for adding delete functionality to Jobs in Shop Planr. A job may only be deleted when it has no associated paths, no parts (serials), and no BOM contributing job references. The feature spans the repository layer (BOM reference counting), service layer (safety checks and deletion), API layer (DELETE endpoint), and frontend (delete button with confirmation modal on the job detail page).

## Glossary

- **Job_Service**: The backend service module (`createJobService`) responsible for job business logic including creation, retrieval, update, progress computation, and now deletion.
- **BOM_Repository**: The data access layer for Bill of Materials, extended with a method to count contributing job references.
- **Job_Repository**: The data access layer for Job CRUD operations, including the existing `delete(id)` method.
- **Path_Repository**: The data access layer for route instances (paths) associated with jobs.
- **Part_Repository**: The data access layer for parts (serial numbers) associated with jobs.
- **API_Route**: The Nitro server HTTP handler for `DELETE /api/jobs/:id`.
- **Job_Detail_Page**: The frontend Vue page at `app/pages/jobs/[id].vue` displaying job information, paths, and parts.
- **Delete_Confirmation_Modal**: A UModal dialog shown to the user before executing a job deletion.
- **Dependent**: A path, part, or BOM contributing job reference associated with a given job.

## Requirements

### Requirement 1: Count BOM Contributing Job References

**User Story:** As a developer, I want the BOM repository to expose a count of contributing job references for a given job ID, so that the service layer can check BOM dependencies before deletion.

#### Acceptance Criteria

1. WHEN `countContributingJobRefs` is called with a job ID, THE BOM_Repository SHALL return the count of rows in the `bom_contributing_jobs` table where `job_id` matches the provided ID.
2. WHEN no rows in `bom_contributing_jobs` reference the given job ID, THE BOM_Repository SHALL return 0.
3. THE BOM_Repository SHALL perform a read-only operation with no side effects when counting contributing job references.

### Requirement 2: Delete a Job with Safety Checks

**User Story:** As a shop manager, I want to delete a job that has no dependents, so that I can remove obsolete or mistakenly created jobs from the system.

#### Acceptance Criteria

1. WHEN `deleteJob` is called with a valid job ID that has 0 paths, 0 parts, and 0 BOM contributing job references, THE Job_Service SHALL delete the job from the database.
2. WHEN `deleteJob` is called with a job ID that has one or more paths, THE Job_Service SHALL throw a ValidationError with a message indicating the path count.
3. WHEN `deleteJob` is called with a job ID that has one or more parts, THE Job_Service SHALL throw a ValidationError with a message indicating the part count.
4. WHEN `deleteJob` is called with a job ID that has one or more BOM contributing job references, THE Job_Service SHALL throw a ValidationError with a message indicating the BOM reference count.
5. WHEN `deleteJob` is called with a job ID that does not exist, THE Job_Service SHALL throw a NotFoundError.
6. WHEN `deleteJob` succeeds, THE Job_Service SHALL ensure the job is no longer retrievable by its ID.

### Requirement 3: Pre-flight Deletion Eligibility Check

**User Story:** As a frontend developer, I want a pre-flight check that reports whether a job can be deleted and why not, so that the UI can disable the delete button and show reasons to the user.

#### Acceptance Criteria

1. WHEN `canDeleteJob` is called with a valid job ID that has 0 paths, 0 parts, and 0 BOM contributing job references, THE Job_Service SHALL return `{ canDelete: true, reasons: [] }`.
2. WHEN `canDeleteJob` is called with a valid job ID that has dependents, THE Job_Service SHALL return `{ canDelete: false, reasons: [...] }` with a human-readable reason string for each type of dependent present.
3. WHEN `canDeleteJob` is called with a job ID that does not exist, THE Job_Service SHALL throw a NotFoundError.
4. THE Job_Service SHALL perform a read-only operation with no side effects when checking deletion eligibility.

### Requirement 4: DELETE API Endpoint

**User Story:** As a frontend client, I want a DELETE endpoint at `/api/jobs/:id`, so that I can request job deletion over HTTP.

#### Acceptance Criteria

1. WHEN a DELETE request is received at `/api/jobs/:id` and the job is successfully deleted, THE API_Route SHALL respond with HTTP status 204 and no body.
2. WHEN a DELETE request is received and the Job_Service throws a ValidationError, THE API_Route SHALL respond with HTTP status 400 and the error message.
3. WHEN a DELETE request is received and the Job_Service throws a NotFoundError, THE API_Route SHALL respond with HTTP status 404 and the error message.

### Requirement 5: Frontend Delete Button and Confirmation

**User Story:** As a shop manager, I want a delete button on the job detail page with a confirmation dialog, so that I can safely delete jobs without accidental data loss.

#### Acceptance Criteria

1. THE Job_Detail_Page SHALL display a Delete button in the job header area alongside the existing Edit button.
2. WHILE the job has paths or parts (based on already-loaded progress data), THE Job_Detail_Page SHALL disable the Delete button.
3. WHEN the user clicks the Delete button, THE Job_Detail_Page SHALL open a Delete_Confirmation_Modal asking the user to confirm the deletion.
4. WHEN the user confirms deletion in the modal, THE Job_Detail_Page SHALL call the `deleteJob` composable method and navigate to `/jobs` on success.
5. IF the delete request fails, THEN THE Job_Detail_Page SHALL display the error message in a toast notification and remain on the current page.

### Requirement 6: useJobs Composable Extension

**User Story:** As a frontend developer, I want a `deleteJob` method in the `useJobs` composable, so that any page can trigger job deletion through a consistent API client.

#### Acceptance Criteria

1. WHEN `deleteJob` is called with a job ID, THE useJobs composable SHALL send a DELETE request to `/api/jobs/:id`.
2. IF the DELETE request fails, THEN THE useJobs composable SHALL propagate the error to the caller.

### Requirement 7: Service Factory Dependency Injection

**User Story:** As a developer, I want the `createJobService` factory to accept the BOM repository in its dependency injection, so that the service can check BOM references during deletion.

#### Acceptance Criteria

1. THE `createJobService` factory SHALL accept a `bom` property of type BOM_Repository in its `repos` parameter.
2. WHEN `deleteJob` or `canDeleteJob` is called, THE Job_Service SHALL use the injected BOM_Repository to count contributing job references.
