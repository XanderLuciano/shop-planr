# Implementation Plan: User Admin Roles

## Overview

Extend the ShopUser model with `username`, `displayName`, and `isAdmin` fields, drop the existing `name` field, and add UI-scoped admin gating. Changes span all layers: SQLite migration, domain types, repository, service, composable, and Vue components. All code references to `ShopUser.name` migrate to `displayName` (or `username` where uniqueness matters).

## Tasks

- [x] 1. Database migration and domain type updates
  - [x] 1.1 Create migration `server/repositories/sqlite/migrations/009_user_admin_roles.sql`
    - Use table-recreation pattern: create `users_new` with target schema (`username TEXT NOT NULL`, `display_name TEXT NOT NULL`, `is_admin INTEGER NOT NULL DEFAULT 0`), no `name` column
    - Copy data from `users` into `users_new`, populating `username` and `display_name` from `name`
    - Handle duplicate `name` values using `ROW_NUMBER() OVER (PARTITION BY name ORDER BY rowid)` — first occurrence keeps name as-is, subsequent get `_2`, `_3` suffix
    - Drop `users`, rename `users_new` to `users`
    - Create `UNIQUE INDEX idx_users_username ON users(username)`
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 2.2, 8.1, 8.2, 8.3_

  - [x] 1.2 Update `ShopUser` type in `server/types/domain.ts`
    - Remove `name` field
    - Add `username: string`, `displayName: string`, `isAdmin: boolean`
    - _Requirements: 1.1, 1.2, 2.1, 8.4_

  - [x] 1.3 Update `UserRepository` interface in `server/repositories/interfaces/userRepository.ts`
    - Add `getByUsername(username: string): ShopUser | null` method
    - _Requirements: 8.6_

  - [x] 1.4 Update `SQLiteUserRepository` in `server/repositories/sqlite/userRepository.ts`
    - Update `UserRow` interface: replace `name` with `username`, `display_name`, `is_admin`
    - Update `rowToDomain` mapping for new fields
    - Update `create()` SQL to insert `username`, `display_name`, `is_admin`
    - Update `update()` SQL to set `username`, `display_name`, `is_admin`
    - Update `list()` and `listActive()` ORDER BY from `name` to `display_name`
    - Implement `getByUsername()` method
    - _Requirements: 1.1, 1.2, 2.1, 8.6_

  - [x] 1.5 Write property test for migration deduplication and data preservation (Properties 7 & 8)
    - **Property 7: Migration Username Deduplication**
    - **Property 8: Migration Data Preservation**
    - Test file: `tests/properties/userMigrationDedup.property.test.ts`
    - Generate arrays of name strings with potential duplicates, verify all resulting usernames are unique, first occurrence keeps original name, subsequent get numeric suffix, all display_names equal original name, all is_admin default to 0
    - **Validates: Requirements 1.4, 2.2, 8.1, 8.2**

- [x] 2. Service layer updates
  - [x] 2.1 Update `userService.ts` for new fields and username uniqueness
    - Update `createUser` to accept `{ username, displayName, department?, isAdmin? }` — default `isAdmin` to `false`
    - Add `assertNonEmpty` validation for both `username` and `displayName`
    - Add username uniqueness check via `repos.users.getByUsername()` — throw `ValidationError` if taken
    - Trim `username` and `displayName` before persisting
    - Update `updateUser` to accept `{ username?, displayName?, department?, active?, isAdmin? }`
    - Add uniqueness check on update: if `username` changed, verify new username not taken by a different user
    - _Requirements: 1.7, 1.8, 2.3, 2.4_

  - [x] 2.2 Write property test for User CRUD Round-Trip (Property 1)
    - **Property 1: User CRUD Round-Trip**
    - Test file: `tests/properties/userCrudRoundTrip.property.test.ts`
    - For any valid username/displayName/isAdmin, create user and read back — fields must match. Omitted isAdmin defaults to false.
    - **Validates: Requirements 1.7, 2.3, 2.4, 8.6**

  - [x] 2.3 Write property test for Username Uniqueness Enforcement (Property 2)
    - **Property 2: Username Uniqueness Enforcement**
    - Test file: `tests/properties/usernameUniqueness.property.test.ts`
    - Two creation inputs with same username — second throws ValidationError, first user unaffected.
    - **Validates: Requirements 1.8**

  - [x] 2.4 Write property test for Empty/Whitespace Input Rejection (Property 3)
    - **Property 3: Empty/Whitespace Input Rejection**
    - Test file: `tests/properties/userInputValidation.property.test.ts`
    - Whitespace-only or empty strings for username/displayName throw ValidationError, repo unchanged.
    - **Validates: Requirements 1.7, 3.4, 3.5**

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update existing unit tests for service changes
  - [x] 4.1 Update `tests/unit/services/userService.test.ts`
    - Update mock repo to include `getByUsername` method
    - Update all `createUser` calls from `{ name }` to `{ username, displayName }`
    - Update all assertions from `.name` to `.username` / `.displayName`
    - Add tests for: `isAdmin` defaults to false, `isAdmin` persists on create/update, duplicate username rejection, username uniqueness on update
    - _Requirements: 1.7, 1.8, 2.3, 2.4_

  - [x] 4.2 Update `tests/unit/services/workQueue.test.ts` — change `u.name` references to `u.displayName`
    - _Requirements: 8.5_

  - [x] 4.3 Update test files referencing `ShopUser.name` to use `displayName` or `username`
    - `tests/properties/assigneeGrouping.property.test.ts` — `u.name` → `u.displayName`
    - `tests/properties/dropdownFilter.property.test.ts` — `u.name` → `u.displayName`
    - `tests/properties/stepAssignmentPreservation.property.test.ts` — `u.name` → `u.displayName`
    - `tests/integration/operatorViewRedesign.test.ts` — `u.name` → `u.displayName`
    - Any other test files creating ShopUser objects with `name` field
    - _Requirements: 8.5_

- [x] 5. API route and server-side reference updates
  - [x] 5.1 Update `server/api/operator/work-queue.get.ts` — change `u.name` to `u.displayName`
    - _Requirements: 8.5_

  - [x] 5.2 Update API route handlers for user create/update if they reference `name` in request body parsing
    - Verify `POST /api/users` and `PUT /api/users/:id` pass through `username`, `displayName`, `isAdmin` fields
    - _Requirements: 1.7, 2.4_

- [x] 6. Composable and frontend updates
  - [x] 6.1 Update `useUsers` composable in `app/composables/useUsers.ts`
    - Add `isAdmin` computed property: `computed(() => selectedUser.value?.isAdmin === true)`
    - Export `isAdmin` from the composable return object
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 6.2 Write property test for isAdmin Computed Tracks Selected User (Property 4)
    - **Property 4: isAdmin Computed Tracks Selected User**
    - Test file: `tests/properties/userAdminComputed.property.test.ts`
    - For any sequence of ShopUser objects with varying isAdmin, setting each as selected user makes isAdmin computed match. Clearing user returns false.
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 6.3 Update `UserForm.vue` component
    - Replace single `name` input with `username` and `displayName` inputs
    - Add `isAdmin` toggle (USwitch) — shown for both create and edit
    - Update emit payload from `{ name, department?, active? }` to `{ username, displayName, department?, active?, isAdmin? }`
    - Client-side validation: empty username → "Username is required", empty displayName → "Display name is required"
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 6.4 Update `UserSelector.vue` component
    - Change `user.name` → `user.displayName` in dropdown menu labels
    - Change `selectedUser?.name` → `selectedUser?.displayName` on trigger button label and aria-label
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.5 Update `StepAssignmentDropdown.vue` — change `u.name` → `u.displayName` in filter and label
    - _Requirements: 8.5_

  - [x] 6.6 Update `app/pages/settings.vue` — user list display
    - Change `u.name` → `u.displayName` in user list rendering
    - Add "Admin" UBadge next to admin users' display names (`v-if="u.isAdmin"`)
    - _Requirements: 7.1, 7.2, 8.5_

  - [x] 6.7 Update `app/pages/parts/step/[stepId].vue` — change `user.name` → `user.displayName`
    - _Requirements: 8.5_

  - [x] 6.8 Update `app/pages/queue.vue` — change `user.name` → `user.displayName`
    - _Requirements: 8.5_

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Admin gating on job creation
  - [x] 8.1 Update `app/pages/jobs/index.vue` — wrap "New Job" button in `v-if="isAdmin"`
    - Import `isAdmin` from `useUsers()` composable
    - _Requirements: 6.3, 6.4, 6.5_

  - [x] 8.2 Update `app/pages/jobs/new.vue` — add admin redirect guard
    - On mount, check `isAdmin` from `useUsers()` — if false, redirect to `/jobs` via `navigateTo('/jobs')`
    - _Requirements: 6.1, 6.2_

  - [x] 8.3 Write property test for Admin-Gated New Job Button Visibility (Property 5)
    - **Property 5: Admin-Gated New Job Button Visibility**
    - Test file: `tests/properties/userAdminJobGating.property.test.ts` (or unit test)
    - For any ShopUser, "New Job" button visible iff isAdmin is true. No user selected → not visible.
    - **Validates: Requirements 6.3, 6.4, 6.5**

  - [x] 8.4 Write unit test for Admin Badge rendering (Property 6)
    - **Property 6: Admin Badge Matches isAdmin Flag**
    - Test in `tests/unit/components/UserAdminBadge.test.ts` (or similar)
    - Render user list with mixed isAdmin values, verify badge presence matches flag.
    - **Validates: Requirements 7.1, 7.2**

- [x] 9. Seed script and shared type re-exports
  - [x] 9.1 Update `server/scripts/seed.ts` — change `createUser` calls from `{ name }` to `{ username, displayName }`
    - _Requirements: 8.7_

  - [x] 9.2 Update `app/types/domain.ts` re-export if it mirrors `server/types/domain.ts`
    - Ensure the shared types layer reflects the updated ShopUser interface
    - _Requirements: 8.4_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Migration 009 is the next sequential migration after the existing 008
- The design specifies 8 correctness properties — Properties 1–4 and 7–8 are property-based tests, Properties 5–6 are better suited as unit/component tests
