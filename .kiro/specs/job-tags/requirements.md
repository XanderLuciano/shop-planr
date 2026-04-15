# Requirements Document

## Baseline Test Health

Captured at branch creation (`feat/job-tags`):

- **Root cause of pre-existing failures**: `jose` and `bcryptjs` were listed in `package.json` but not installed in `node_modules`. Running `npm install --legacy-peer-deps` resolved this.
- **Passing after install**: 1502 tests across 248 files — all green.
- **Flaky test fixed**: `CP-TAG-2` property test generated whitespace-padded strings (e.g. `"                             ! "`) that trim to ≤30 chars, causing `createTag` to succeed instead of throw. Fixed by adding `.filter(s => s.trim().length > 30)` to the arbitrary.
- **Lint**: Clean (0 errors, 0 warnings).

## Introduction

Job Tags adds a custom labeling system to production jobs in Shop Planr, enabling shop-floor users to visually identify jobs with long lead processes, multiple machine operations, or other custom categories. Tags are user-defined entities with a name and color, displayed as colored pill badges alongside job names throughout the application. Tag management lives under Settings, and tag assignment occurs on the job edit/create form via a multi-select dropdown.

## Glossary

- **Tag**: A user-defined label entity with a unique name (max 30 characters) and a hex color, used to categorize jobs visually.
- **Job**: A production order tracked through the shop floor routing system.
- **TagService**: The server-side service module responsible for tag CRUD operations and validation.
- **JobService**: The server-side service module responsible for job operations, extended to support tag assignment.
- **TagRepository**: The data access layer for the `tags` database table.
- **JobTagRepository**: The data access layer for the `job_tags` join table managing many-to-many relationships between jobs and tags.
- **TagManager**: The Vue component in Settings for creating, editing, and deleting tags.
- **TagSelector**: The Vue multi-select dropdown component for assigning tags to a job on the edit/create form.
- **JobTagPill**: The Vue component rendering a tag as a small colored pill badge.
- **Tag_Name**: The trimmed, case-insensitively unique string identifier for a tag (1–30 characters).
- **Tag_Color**: A 7-character hex color string in the format `#RRGGBB`.
- **SetJobTags**: The operation that replaces all tag associations for a given job with a new set of tag IDs.

## Requirements

### Requirement 1: Tag Creation

**User Story:** As a shop manager, I want to create custom tags with a name and color, so that I can define categories for labeling jobs.

#### Acceptance Criteria

1. WHEN a user submits a new tag with a valid name and color, THE TagService SHALL create a new Tag with a generated ID (prefix `tag_`), the trimmed name, the provided color, and current timestamps
2. WHEN a user submits a new tag without specifying a color, THE TagService SHALL default the color to `#8b5cf6`
3. WHEN a user submits a tag name that is empty or contains only whitespace after trimming, THE TagService SHALL reject the request with a ValidationError
4. WHEN a user submits a tag name that exceeds 30 characters after trimming, THE TagService SHALL reject the request with a ValidationError
5. WHEN a user submits a tag name that matches an existing tag name (case-insensitive comparison), THE TagService SHALL reject the request with a ValidationError
6. WHEN a user submits an invalid color string that does not match the pattern `#RRGGBB`, THE TagService SHALL reject the request with a ValidationError

### Requirement 2: Tag Update

**User Story:** As a shop manager, I want to edit existing tags, so that I can correct names or change colors as needs evolve.

#### Acceptance Criteria

1. WHEN a user updates a tag with a valid partial input, THE TagService SHALL modify only the provided fields and refresh the `updatedAt` timestamp
2. WHEN a user updates a tag name to one that matches another existing tag (case-insensitive, excluding the tag being updated), THE TagService SHALL reject the request with a ValidationError
3. WHEN a user updates a tag name that exceeds 30 characters after trimming, THE TagService SHALL reject the request with a ValidationError
4. WHEN a user updates a tag color to an invalid hex string, THE TagService SHALL reject the request with a ValidationError
5. IF a tag with the specified ID does not exist, THEN THE TagService SHALL return a NotFoundError

### Requirement 3: Tag Deletion

**User Story:** As a shop manager, I want to delete tags I no longer need, so that the tag list stays clean and relevant.

#### Acceptance Criteria

1. WHEN a user deletes a tag, THE TagService SHALL remove the tag from the `tags` table
2. WHEN a tag is deleted, THE database SHALL cascade-delete all `job_tags` rows referencing that tag, leaving no orphan references
3. IF a tag with the specified ID does not exist, THEN THE TagService SHALL return a NotFoundError

### Requirement 4: Tag Listing

**User Story:** As a shop user, I want to see all available tags, so that I can select from existing tags when labeling jobs.

#### Acceptance Criteria

1. THE TagService SHALL return all tags in the system when listing is requested
2. THE TagRepository SHALL support lookup of a tag by name for duplicate checking

### Requirement 5: Tag Assignment to Jobs

**User Story:** As a shop user, I want to assign one or more tags to a job, so that I can categorize jobs for quick visual identification in the queue.

#### Acceptance Criteria

1. WHEN a user sets tags on a job with a list of tag IDs, THE JobService SHALL replace all existing tag associations for that job with exactly the provided set
2. WHEN a user sets tags on a job with an empty list, THE JobService SHALL remove all tag associations for that job
3. WHEN a user sets tags on a job, THE JobService SHALL deduplicate the provided tag IDs before persisting
4. WHEN a user sets tags on a job, THE JobService SHALL return the full list of Tag objects now associated with the job
5. IF the specified job does not exist, THEN THE JobService SHALL return a NotFoundError
6. IF any of the provided tag IDs do not reference existing tags, THEN THE JobService SHALL return a NotFoundError identifying the missing tag

### Requirement 6: Bulk Tag Retrieval for Job Lists

**User Story:** As a shop user, I want to see tags on all jobs in the queue without slow page loads, so that I can scan the job list efficiently.

#### Acceptance Criteria

1. WHEN the job list is requested, THE JobTagRepository SHALL fetch tags for all listed jobs in a single JOIN query, avoiding N+1 queries
2. THE JobService SHALL return each job with its associated tags array when listing jobs
3. WHEN a job has no tags, THE JobService SHALL include an empty tags array for that job

### Requirement 7: Tag Display as Pill Badges

**User Story:** As a shop-floor user, I want to see tags displayed as colored pill badges next to job names, so that I can quickly identify job categories at a glance.

#### Acceptance Criteria

1. WHEN tags are present on a job, THE JobTagPill component SHALL render each tag as a small pill badge with the tag name as text and the tag color as background
2. THE Jobs page SHALL display tag pills next to each job name in the list
3. THE Job detail page SHALL display tag pills for the current job
4. THE Job mobile card view SHALL display tag pills for each job

### Requirement 8: Tag Selection on Job Forms

**User Story:** As a shop user, I want to select tags from a dropdown when creating or editing a job, so that I can easily assign relevant labels.

#### Acceptance Criteria

1. WHEN a user opens the tag selector on a job form, THE TagSelector component SHALL display all existing tags as selectable options
2. THE TagSelector component SHALL support multi-select, displaying selected tags as pills within the selector
3. WHEN a user needs a tag that does not exist, THE TagSelector component SHALL provide an inline option to create a new tag without leaving the form

### Requirement 9: Tag Management in Settings

**User Story:** As a shop manager, I want a dedicated tag management section in Settings, so that I can view, create, edit, and delete tags in one place.

#### Acceptance Criteria

1. THE TagManager component SHALL display all tags with a colored pill preview for each
2. THE TagManager component SHALL provide an inline form for creating new tags with a name input and color picker
3. THE TagManager component SHALL allow editing a tag name and color inline
4. WHEN a user deletes a tag from the TagManager, THE TagManager component SHALL show a confirmation dialog displaying the number of jobs currently using that tag

### Requirement 10: Database Schema for Tags

**User Story:** As a developer, I want a well-structured database schema for tags, so that data integrity is enforced at the storage level.

#### Acceptance Criteria

1. THE database migration SHALL create a `tags` table with columns: `id` (TEXT PRIMARY KEY), `name` (TEXT NOT NULL), `color` (TEXT NOT NULL DEFAULT '#8b5cf6'), `created_at` (TEXT NOT NULL), `updated_at` (TEXT NOT NULL)
2. THE database migration SHALL create a case-insensitive unique index on `tags(LOWER(name))`
3. THE database migration SHALL create a `job_tags` join table with columns: `job_id` (TEXT NOT NULL, FK to jobs), `tag_id` (TEXT NOT NULL, FK to tags), with a composite PRIMARY KEY of `(job_id, tag_id)`
4. THE `job_tags` foreign keys SHALL use `ON DELETE CASCADE` for both `job_id` and `tag_id` references
5. THE database migration SHALL create an index on `job_tags(tag_id)` for efficient reverse lookups

### Requirement 11: API Routes for Tags

**User Story:** As a developer, I want RESTful API routes for tag operations, so that the frontend can manage tags and tag assignments through standard HTTP calls.

#### Acceptance Criteria

1. THE API SHALL expose `GET /api/tags` to list all tags
2. THE API SHALL expose `POST /api/tags` to create a new tag, accepting `name` (required) and `color` (optional) in the request body
3. THE API SHALL expose `PUT /api/tags/:id` to update a tag, accepting partial `name` and `color` fields
4. THE API SHALL expose `DELETE /api/tags/:id` to delete a tag
5. THE API SHALL expose `GET /api/jobs/:id/tags` to retrieve tags for a specific job
6. THE API SHALL expose `PUT /api/jobs/:id/tags` to set tags on a job, accepting `tagIds` array in the request body
7. THE API routes for tag CRUD in Settings SHALL require admin authorization
8. THE API routes for tag assignment on jobs SHALL require standard authentication without admin restriction

### Requirement 13: Tag Filtering on Jobs Page

**User Story:** As a shop-floor user, I want to filter the jobs list by tags, so that I can quickly find jobs in a specific category without scrolling through the entire list.

#### Acceptance Criteria

1. WHEN tags exist in the system, THE ViewFilters component SHALL display a "Tags" dropdown button in the filter bar on the Jobs page
2. WHEN a user opens the Tags dropdown, THE ViewFilters component SHALL display all available tags as checkable options with colored pill previews
3. WHEN a user selects one or more tags, THE Jobs page SHALL filter the displayed jobs to only those that have ALL selected tags (AND logic)
4. WHEN a user selects tags, THE Tags dropdown button SHALL display the count of selected tags (e.g., "Tags (2)")
5. WHEN a user clicks the "Clear" button, THE ViewFilters component SHALL reset the tag filter along with all other filters
6. THE tag filter SHALL work in combination with existing filters (job name, status, priority, step) using AND logic — a job must match ALL active filters to appear
7. THE tag filter state SHALL persist to localStorage alongside existing filter state
8. WHEN no tags exist in the system, THE Tags dropdown SHALL not be rendered
9. THE tag filter SHALL apply to both desktop table view and mobile card view

### Requirement 12: Security and Authorization

**User Story:** As a shop manager, I want tag management restricted to admins, so that only authorized users can create or modify the tag vocabulary.

#### Acceptance Criteria

1. WHEN a non-admin user attempts to create, update, or delete a tag, THE API SHALL reject the request with a ForbiddenError
2. WHEN any authenticated user attempts to assign tags to a job, THE API SHALL allow the operation
3. THE tag API routes SHALL enforce authentication through the existing JWT auth middleware
