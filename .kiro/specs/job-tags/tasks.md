# Implementation Plan: Job Tags

## Overview

Add a custom tagging system for production jobs. Tags are user-defined entities (name + color) managed under Settings, assigned to jobs via a many-to-many join table, and displayed as colored pill badges throughout the app. Implementation follows the existing Library/Settings CRUD pattern with migration → repository → service → API → composable → component layering.

## Tasks

- [x] 1. Database migration and domain types
  - [x] 1.1 Create migration `server/repositories/sqlite/migrations/013_add_job_tags.sql`
    - `tags` table: `id` TEXT PK, `name` TEXT NOT NULL, `color` TEXT NOT NULL DEFAULT '#8b5cf6', `created_at` TEXT NOT NULL, `updated_at` TEXT NOT NULL
    - Case-insensitive unique index: `CREATE UNIQUE INDEX idx_tags_name_lower ON tags(LOWER(name))`
    - `job_tags` join table: `job_id` TEXT NOT NULL FK→jobs ON DELETE CASCADE, `tag_id` TEXT NOT NULL FK→tags ON DELETE CASCADE, PRIMARY KEY (job_id, tag_id)
    - Index: `CREATE INDEX idx_job_tags_tag_id ON job_tags(tag_id)`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 1.2 Add `Tag` interface to `server/types/domain.ts`
    - Fields: `id`, `name`, `color`, `createdAt`, `updatedAt`
    - Add `CreateTagInput`, `UpdateTagInput`, `SetJobTagsInput` to `server/types/api.ts`
    - Re-export `Tag` from `app/types/domain.ts`
    - _Requirements: 1.1, 2.1, 5.1_

- [x] 2. Repository layer
  - [x] 2.1 Create `TagRepository` interface at `server/repositories/interfaces/tagRepository.ts`
    - Methods: `list()`, `getById(id)`, `getByIds(ids)`, `create(tag)`, `update(id, partial)`, `delete(id)`, `findByName(name)`
    - Export from `server/repositories/interfaces/index.ts` barrel
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 4.2_

  - [x] 2.2 Create `JobTagRepository` interface at `server/repositories/interfaces/jobTagRepository.ts`
    - Methods: `getTagsByJobId(jobId)`, `getTagsForJobs(jobIds)`, `replaceJobTags(jobId, tagIds)`, `removeAllTagsForJob(jobId)`, `countJobsByTagId(tagId)`
    - Export from barrel
    - _Requirements: 5.1, 5.2, 6.1, 6.2_

  - [x] 2.3 Implement `SQLiteTagRepository` at `server/repositories/sqlite/tagRepository.ts`
    - Standard CRUD with row↔object mapping
    - `findByName` uses `WHERE LOWER(name) = LOWER(?)` for case-insensitive lookup
    - `getByIds` uses `WHERE id IN (...)` parameterized query
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 4.2_

  - [x] 2.4 Implement `SQLiteJobTagRepository` at `server/repositories/sqlite/jobTagRepository.ts`
    - `getTagsForJobs` uses single JOIN query: `SELECT jt.job_id, t.* FROM job_tags jt JOIN tags t ON jt.tag_id = t.id WHERE jt.job_id IN (...)`
    - `replaceJobTags` deletes all + re-inserts in a transaction
    - `countJobsByTagId` for deletion safety display
    - _Requirements: 5.1, 6.1, 6.2_

  - [x] 2.5 Register both repositories in `RepositorySet` and `createSQLiteRepositories`
    - Add `tags: TagRepository` and `jobTags: JobTagRepository` to `RepositorySet` interface in `server/repositories/sqlite/index.ts`
    - Instantiate `SQLiteTagRepository` and `SQLiteJobTagRepository` in `createSQLiteRepositories()`
    - _Requirements: 10.1_

- [x] 3. Service layer
  - [x] 3.1 Create `tagService` at `server/services/tagService.ts`
    - `createTag(input)`: validate name (non-empty, trimmed, ≤30 chars), validate color (hex regex), check duplicate via `findByName`, generate `tag_` prefixed ID
    - `updateTag(id, input)`: partial update, validate name uniqueness excluding self, refresh `updatedAt`
    - `deleteTag(id)`: verify exists, delete (cascade handles job_tags)
    - `listTags()`: return all tags
    - `getTagsByJobId(jobId)`: delegate to jobTagRepository
    - Follow `createLibraryService` factory pattern with `repos: { tags: TagRepository, jobTags: JobTagRepository }`
    - _Requirements: 1.1–1.6, 2.1–2.5, 3.1–3.3, 4.1, 4.2_

  - [x] 3.2 Extend `jobService` with `setJobTags` and `listJobsWithTags`
    - Add `jobTags: JobTagRepository` and `tags: TagRepository` to the repos parameter of `createJobService`
    - `setJobTags(jobId, tagIds)`: validate job exists, deduplicate tagIds, validate all tags exist via `getByIds`, call `replaceJobTags`, return resulting tags
    - `listJobsWithTags()`: list jobs, bulk-fetch tags via `getTagsForJobs`, return jobs with `tags` array
    - _Requirements: 5.1–5.6, 6.1–6.3_

  - [x] 3.3 Wire `tagService` into `getServices()` in `server/utils/services.ts`
    - Import and create `tagService` with `{ tags: repos.tags, jobTags: repos.jobTags }`
    - Pass `repos.jobTags` and `repos.tags` to `createJobService`
    - Add `tagService: TagService` to `ServiceSet` interface
    - _Requirements: 1.1, 5.1_

- [x] 4. Zod schemas and API routes
  - [x] 4.1 Create `server/schemas/tagSchemas.ts`
    - `createTagSchema`: `{ name: z.string().min(1), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }`
    - `updateTagSchema`: `{ name: z.string().min(1).optional(), color: z.string().regex(...).optional() }`
    - `setJobTagsSchema`: `{ tagIds: z.array(z.string()) }`
    - _Requirements: 1.3, 1.4, 1.6, 2.3, 2.4, 11.2, 11.6_

  - [x] 4.2 Create tag CRUD API routes
    - `server/api/tags/index.get.ts` — `GET /api/tags` → `tagService.listTags()`
    - `server/api/tags/index.post.ts` — `POST /api/tags` → admin-gated, `parseBody` with `createTagSchema`, `tagService.createTag()`
    - `server/api/tags/[id].put.ts` — `PUT /api/tags/:id` → admin-gated, `parseBody` with `updateTagSchema`, `tagService.updateTag()`
    - `server/api/tags/[id].delete.ts` — `DELETE /api/tags/:id` → admin-gated, `tagService.deleteTag()`
    - All routes use `defineApiHandler`; admin routes check `getAuthUserId(event)` + user `isAdmin`
    - _Requirements: 11.1–11.4, 11.7, 12.1, 12.3_

  - [x] 4.3 Create job-tag assignment API routes
    - `server/api/jobs/[id]/tags.get.ts` — `GET /api/jobs/:id/tags` → `tagService.getTagsByJobId()`
    - `server/api/jobs/[id]/tags.put.ts` — `PUT /api/jobs/:id/tags` → `parseBody` with `setJobTagsSchema`, `jobService.setJobTags()`
    - Standard auth (no admin required)
    - _Requirements: 11.5, 11.6, 11.8, 12.2, 12.3_

- [x] 5. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Service unit tests
  - [x] 6.1 Write unit tests for `tagService`
    - Test createTag validation: empty name, name > 30 chars, duplicate name (case-insensitive), invalid color, default color
    - Test updateTag: partial update, name uniqueness excluding self, not found
    - Test deleteTag: not found
    - _Requirements: 1.1–1.6, 2.1–2.5, 3.1–3.3_

  - [x] 6.2 Write unit tests for `jobService.setJobTags`
    - Test replace behavior, deduplication, job not found, tag not found, empty tagIds clears
    - _Requirements: 5.1–5.6_

  - [x] 6.3 Write unit tests for `tagSchemas`
    - Test Zod schema validation for createTag, updateTag, setJobTags
    - _Requirements: 1.3, 1.4, 1.6, 11.2, 11.6_

- [x] 7. Property-based tests
  - [x] 7.1 Write property test CP-TAG-1: Tag Name Uniqueness
    - For any sequence of createTag calls with distinct names (case-insensitive), all succeed; duplicate names always throw ValidationError
    - **Property 1: Tag Name Uniqueness**
    - **Validates: Requirements 1.5, 2.2**

  - [x] 7.2 Write property test CP-TAG-2: Tag Name Length Bound
    - For any string of length > 30, createTag throws; for any string 1–30 (unique), createTag succeeds
    - **Property 2: Tag Name Length Bound**
    - **Validates: Requirements 1.3, 1.4**

  - [x] 7.3 Write property test CP-TAG-3: Replace Idempotence
    - For any jobId and tagIds, calling setJobTags twice produces identical associations
    - **Property 5: Replace Idempotence**
    - **Validates: Requirements 5.1, 5.3**

  - [x] 7.4 Write property test CP-TAG-4: Cascade Deletion Completeness
    - After deleting a tag, getTagsForJobs never returns that tag for any job
    - **Property 6: Cascade Deletion Completeness**
    - **Validates: Requirements 3.2**

  - [x] 7.5 Write property test CP-TAG-5: Bulk Fetch Completeness
    - For any set of jobs with known tag assignments, getTagsForJobs returns exactly the expected tags per job
    - **Property 7: Bulk Fetch Completeness**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 8. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Frontend composables
  - [x] 9.1 Create `app/composables/useTags.ts`
    - Reactive state: `tags`, `loading`, `error`
    - Methods: `fetchTags()`, `createTag(name, color)`, `updateTag(id, input)`, `deleteTag(id)`
    - Uses `useAuthFetch()` for all API calls
    - Follow `useLibrary` composable pattern
    - _Requirements: 4.1, 9.1, 9.2, 9.3_

  - [x] 9.2 Create `app/composables/useJobTags.ts`
    - Methods: `fetchJobTags(jobId)`, `setJobTags(jobId, tagIds)`
    - Returns reactive `tags` ref for the current job
    - _Requirements: 5.1, 5.4, 8.1_

- [x] 10. Vue components
  - [x] 10.1 Create `app/components/JobTagPill.vue`
    - Props: `tag: Tag` (name + color)
    - Renders a small pill/badge with `tag.name` as text and `tag.color` as background
    - Use inline styles for dynamic background color with appropriate text contrast
    - _Requirements: 7.1_

  - [x] 10.2 Create `app/components/TagManager.vue`
    - Lists all tags with colored pill preview (using `JobTagPill`)
    - Inline create form: name input + color input (preset palette or native color picker)
    - Edit tag name and color inline
    - Delete with UModal confirmation showing usage count (`countJobsByTagId`)
    - Admin-gated operations
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 10.3 Create `app/components/TagSelector.vue`
    - Props: `modelValue: string[]` (selected tag IDs), emits `update:modelValue`
    - Multi-select dropdown listing all tags with colored pill previews
    - Selected tags shown as pills
    - Inline "Create new tag" option at bottom of dropdown for quick creation
    - Uses `useTags` composable
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 11. Page integration
  - [x] 11.1 Integrate `TagManager` into Settings page
    - Add a "Tags" tab to the `tabs` array in `app/pages/settings.vue`
    - Render `TagManager` component when the Tags tab is active
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 11.2 Integrate `TagSelector` into `JobCreationForm.vue`
    - Add `TagSelector` to the job create/edit form
    - On job save, call `setJobTags` with selected tag IDs
    - On edit, pre-populate with existing job tags via `GET /api/jobs/:id/tags`
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 11.3 Display `JobTagPill` on Jobs list page
    - Extend `GET /api/jobs` response to include tags per job (use `listJobsWithTags`)
    - Render `JobTagPill` components next to job names in the table rows
    - Also render in `JobMobileCard` for mobile viewports
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 11.4 Display `JobTagPill` on Job detail page (`app/pages/jobs/[id].vue`)
    - Fetch job tags and display pills in the job header area
    - _Requirements: 7.1, 7.3_

- [-] 12. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Migration number is 013 (next after existing 012_pin_auth.sql)
- Tag CRUD follows the existing Library pattern (libraryService, useLibrary, LibraryManager)
- Admin gating for tag CRUD matches existing Settings operations pattern
- Property tests use fast-check with ≥100 iterations per the project testing strategy
- All API routes use `defineApiHandler` (not `defineEventHandler` with manual try/catch)
- Zod validation uses `parseBody()` from `server/utils/validation.ts`
