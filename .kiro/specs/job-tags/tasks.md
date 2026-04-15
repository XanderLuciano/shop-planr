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
    - For any string whose **trimmed** length is > 30, createTag throws; for any string whose trimmed length is 1–30 (unique), createTag succeeds
    - Arbitrary uses `.filter(s => s.trim().length > 30)` to ensure whitespace-padded strings don't produce false negatives
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

- [x] 12. Final checkpoint
  - All 1502 tests pass across 248 test files. Lint is clean (0 errors, 0 warnings).
  - Pre-existing issue resolved: `jose` and `bcryptjs` were in `package.json` but not installed — `npm install --legacy-peer-deps` was required.
  - Flaky property test CP-TAG-2 fixed: arbitrary now filters to `s.trim().length > 30` to prevent whitespace-padded counterexamples.

- [x] 13. Tag filtering on Jobs page
  - [x] 13.1 Add `tagIds?: string[]` to `FilterState` in `server/types/domain.ts`
    - Optional array of tag IDs for multi-select filtering
    - _Requirements: 13.3, 13.7_

  - [x] 13.2 Extend `useViewFilters` composable to support `tagIds` filtering
    - Add `tagIds` accessor to `applyFilters` function signature
    - Filter logic: when `filters.tagIds` has entries, item must have ALL selected tags (AND logic)
    - `clearFilters()` resets `tagIds` to empty array
    - _Requirements: 13.3, 13.5, 13.6_

  - [x] 13.3 Add tag filter dropdown to `ViewFilters.vue`
    - Accept optional `availableTags: Tag[]` prop
    - Render "Tags" dropdown button with chevron icon, only when tags exist
    - Dropdown panel shows all tags as checkable items with `JobTagPill` previews
    - Button label shows selected count (e.g., "Tags (2)")
    - Tag selection toggles individual tag IDs in `filters.tagIds`
    - `hasActiveFilters` computed includes `tagIds` check
    - _Requirements: 13.1, 13.2, 13.4, 13.8_

  - [x] 13.4 Wire tag filtering into Jobs page (`app/pages/jobs/index.vue`)
    - Import `useTags` composable and call `fetchTags()` on mount (parallel with `fetchJobs`)
    - Pass `availableTags` to `ViewFilters` component via `:available-tags` prop
    - Add `tagIds` accessor to `filteredJobs` computed: `tagIds: j => j.tags?.map(t => t.id) ?? []`
    - Filtering applies to both desktop `UTable` and mobile `JobMobileCard` views
    - _Requirements: 13.1, 13.3, 13.6, 13.9_

- [x] 14. Tag grouping on Jobs page
  - [x] 14.1 Add `groupByTag?: boolean` to `FilterState` in `server/types/domain.ts`
    - Persisted to localStorage alongside other filter state
    - `clearFilters()` resets it to `false`
    - _Requirements: 14.4, 14.6_

  - [x] 14.2 Create `groupJobsByTag` utility in `app/utils/jobTagGrouping.ts`
    - Accepts filtered jobs array and all tags, returns `JobTagGroup[]`
    - Jobs with multiple tags appear in each matching group
    - Untagged jobs go into a `{ tag: null }` group at the bottom
    - Groups ordered by tag list order (consistent with `allTags`)
    - Export `JobTagGroup` interface
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 14.3 Add "Group by Tag" toggle to `ViewFilters.vue`
    - Render a toggle button (icon `i-lucide-group`) next to the Tags dropdown, only when tags exist
    - Active state visually indicated (e.g., `variant="soft"` when on, `variant="outline"` when off)
    - Emits filter change with `groupByTag` toggled
    - _Requirements: 14.4, 14.8_

  - [x] 14.4 Implement grouped view in Jobs page (`app/pages/jobs/index.vue`)
    - Compute `jobGroups` from `filteredJobs` + `availableTags` when `filters.groupByTag` is true
    - Render collapsible sections: colored tag pill header, job count badge, expand/collapse toggle
    - Each section contains the same job rows (desktop table or mobile cards)
    - "Untagged" group uses neutral styling
    - When tag filter is active, only matching tag groups are shown
    - Disable "Edit Priority" button when grouping is active
    - _Requirements: 14.1, 14.2, 14.3, 14.5, 14.7, 14.8, 14.9_

- [x] 15. Tests for tag filtering and grouping (Requirements 13 & 14)
  - [x] 15.1 Unit tests for `useViewFilters` tag filtering
    - Test `applyFilters` with `tagIds` accessor: single tag, multiple tags (AND logic), empty tagIds (no filter), job with no tags excluded when filter active
    - Test `clearFilters` resets `tagIds` to empty array and `groupByTag` to false
    - Test tag filter combines with existing filters (AND across all filter types)
    - _Validates: Requirements 13.3, 13.5, 13.6_

  - [x] 15.2 Unit tests for `groupJobsByTag` utility
    - Test jobs with single tag grouped correctly
    - Test jobs with multiple tags appear in each matching group
    - Test untagged jobs appear in "Untagged" group at bottom
    - Test empty jobs array returns empty groups
    - Test group ordering matches `allTags` order
    - Test interaction with tag filter: only matching groups shown
    - _Validates: Requirements 14.1, 14.2, 14.3_

  - [x] 15.3 Property-based test CP-TAG-6: Grouping Completeness
    - For any set of jobs with arbitrary tag assignments, every job appears in at least one group (either a tag group or "Untagged")
    - No job is lost during grouping
    - **Property: Grouping Completeness**
    - _Validates: Requirements 14.1, 14.2, 14.3_

  - [x] 15.4 Property-based test CP-TAG-7: Filter-Group Consistency
    - For any tag filter + grouping combination, the set of jobs visible across all groups equals the set of jobs that would pass the flat filter
    - Jobs with multiple tags may appear in multiple groups, but the union of unique job IDs across groups equals the flat filtered set
    - **Property: Filter-Group Consistency**
    - _Validates: Requirements 13.3, 14.5_

- [x] 16. Final checkpoint
  - Ensure all tests pass and lint is clean after filtering, grouping, and test additions.

- [x] 17. Fix job expansion in grouped view
  - [x] 17.1 Add expand/collapse support to the grouped desktop table in `app/pages/jobs/index.vue`
    - Add per-row expand state tracking for grouped view (reuse `expanded` ref or a separate grouped-expand ref)
    - Add expand chevron button as the first column in each grouped table row
    - Render `JobExpandableRow` component when a row is expanded (same as flat view)
    - Wire `expandAllPathsSignal`, `collapseAllPathsSignal`, and `onPathsExpandedChange` to grouped rows
    - Ensure `JobViewToolbar` expand/collapse-all actions work in grouped mode
    - _Bug: Grouped view rendered plain table rows with only navigateTo on click, missing expand chevron and JobExpandableRow_
    - _Requirements: 14.10_

- [x] 18. Tag-colored group borders
  - [x] 18.1 Apply tag color as border color on group containers in `app/pages/jobs/index.vue`
    - Replace static `border-(--ui-border)` class with inline `borderColor` style using `group.tag?.color`
    - Untagged groups fall back to `var(--ui-border)`
    - Applied to both desktop and mobile grouped views
    - _Requirements: 14.11_

- [x] 19. Tests for grouped view expansion and colored borders (Requirements 14.10 & 14.11)
  - [x] 19.1 Unit tests for grouped job expansion state management
    - Test `expandedGroupedJobs` Set tracks expanded job IDs correctly
    - Test `toggleGroupedJobExpand` adds/removes job IDs from the set
    - Test `expandAllGroupedJobs` populates set with all job IDs across all groups
    - Test `collapseAllGroupedJobs` clears the set and `jobsWithExpandedPaths`
    - Test `hasExpandedJobs` returns true when `expandedGroupedJobs` is non-empty in grouped mode
    - Test `expandAllJobs` / `collapseAllJobs` delegate to grouped variants when `isGrouped` is true
    - _Validates: Requirement 14.10_

  - [x] 19.2 Unit test for tag-colored group border logic
    - Test that `group.tag?.color ?? 'var(--ui-border)'` produces the tag's hex color for tagged groups
    - Test that untagged groups (where `group.tag` is null) produce `var(--ui-border)` fallback
    - _Validates: Requirement 14.11_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Migration number is 013 (next after existing 012_pin_auth.sql)
- Tag CRUD follows the existing Library pattern (libraryService, useLibrary, LibraryManager)
- Admin gating for tag CRUD matches existing Settings operations pattern
- Property tests use fast-check with ≥100 iterations per the project testing strategy
- All API routes use `defineApiHandler` (not `defineEventHandler` with manual try/catch)
- Zod validation uses `parseBody()` from `server/utils/validation.ts`
