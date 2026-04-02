# Design Document: User Admin Roles

## Overview

This feature extends the `ShopUser` model with three new fields (`username`, `displayName`, `isAdmin`) and removes the existing `name` field. The goal is UI-scoped role distinction: admin users see the full interface (including job creation), while regular users see a simplified view. There is no server-side auth enforcement — this is purely a client-side visibility concern.

The change touches every layer of the stack: a SQLite migration adds/removes columns, the domain type and repository are updated, the service layer gains username uniqueness validation, the composable exposes a reactive `isAdmin` check, and several Vue components are updated to use `displayName` and conditionally render admin-only UI.

### Key Design Decisions

- **Simple boolean flag** (`isAdmin`) rather than a roles/groups system. The shop floor use case doesn't warrant RBAC complexity.
- **`name` column is dropped entirely** — not deprecated or kept alongside. The migration copies `name` into both `username` and `display_name`, then drops `name`.
- **UI scoping only** — no middleware, no server-side auth guards. Any user can still hit API endpoints directly. This is intentional for a kiosk-mode app.
- **Kiosk-mode user selection unchanged** — the dropdown in the top-right header stays as-is, just switches from `name` to `displayName`.

## Architecture

The change follows the existing layered architecture:

```
UserForm / UserSelector / Jobs pages (UI)
    ↓
useUsers composable (reactive state + isAdmin computed)
    ↓
API Routes: POST /api/users, PUT /api/users/:id, GET /api/users
    ↓
UserService (validation: username uniqueness, non-empty checks)
    ↓
UserRepository (CRUD with new columns)
    ↓
SQLite (migration 009: add username, display_name, is_admin; drop name)
```

No new services, repositories, or API routes are needed. This is a modification of existing layers.

### Migration Strategy

Migration `009_user_admin_roles.sql` uses the table-recreation pattern (consistent with migrations 006–008):
1. Create `users_new` with the target schema (`username TEXT NOT NULL`, `display_name TEXT NOT NULL`, `is_admin INTEGER NOT NULL DEFAULT 0`) — no `name` column
2. Copy data from `users` into `users_new`, populating `username` and `display_name` from `name`, deduplicating usernames via `ROW_NUMBER() OVER (PARTITION BY name ORDER BY rowid)`
3. Drop `users`, rename `users_new` to `users`
4. Create `UNIQUE INDEX idx_users_username ON users(username)`

Table recreation is used instead of `ALTER TABLE ... DROP COLUMN` + `ADD COLUMN` because SQLite's `ADD COLUMN` doesn't support `NOT NULL` without a default value, and we need `username NOT NULL` without a default.

### Admin Gating Approach

Admin-only UI gating is handled entirely in the Vue layer:
- `useUsers()` composable exposes `isAdmin` computed property
- Job creation page (`/jobs/new`) checks `isAdmin` on mount and redirects non-admins to `/jobs`
- Jobs list page conditionally renders the "New Job" button via `v-if="isAdmin"`
- No route middleware needed — this is a soft UI gate, not a security boundary

## Components and Interfaces

### Modified Domain Type

```typescript
// server/types/domain.ts
export interface ShopUser {
  id: string
  username: string        // NEW — unique, short handle
  displayName: string     // NEW — friendly display label
  isAdmin: boolean        // NEW — admin flag
  department?: string
  active: boolean
  createdAt: string
}
// REMOVED: name field
```

### Modified Repository Interface

```typescript
// server/repositories/interfaces/userRepository.ts
export interface UserRepository {
  create(user: ShopUser): ShopUser
  getById(id: string): ShopUser | null
  getByUsername(username: string): ShopUser | null  // NEW
  list(): ShopUser[]
  listActive(): ShopUser[]
  update(id: string, partial: Partial<ShopUser>): ShopUser
}
```

The new `getByUsername` method supports uniqueness checks in the service layer.

### Modified Service Interface

```typescript
// userService input types change:
createUser(input: {
  username: string
  displayName: string
  department?: string
  isAdmin?: boolean        // defaults to false
}): ShopUser

updateUser(id: string, input: {
  username?: string
  displayName?: string
  department?: string
  active?: boolean
  isAdmin?: boolean
}): ShopUser
```

Validation rules:
- `username`: required, non-empty after trim, unique across all users
- `displayName`: required, non-empty after trim
- `isAdmin`: optional, defaults to `false` on create

### Modified Composable

```typescript
// app/composables/useUsers.ts — additions
export function useUsers() {
  // ... existing returns ...
  const isAdmin = computed(() => selectedUser.value?.isAdmin === true)

  return {
    // ... existing ...
    isAdmin,  // NEW
  }
}
```

### Modified Components

**UserForm.vue** — Replace single `name` input with `username` + `displayName` inputs. Add `isAdmin` toggle (USwitch). Client-side validation for both fields being non-empty.

**UserSelector.vue** — Change `user.name` references to `user.displayName` in dropdown labels and trigger button.

**Settings page (settings.vue)** — User list displays `u.displayName` instead of `u.name`. Show "Admin" badge (UBadge) next to admin users.

**Jobs list (jobs/index.vue)** — Wrap "New Job" button in `v-if="isAdmin"`.

**Job creation page (jobs/new.vue)** — Add `onMounted` check: if `!isAdmin`, redirect to `/jobs`.

### Other Code References to Update

- `StepAssignmentDropdown.vue` — `u.name` → `u.displayName` in filter and label
- `app/pages/parts/step/[stepId].vue` — `user.name` → `user.displayName`
- `app/pages/queue.vue` — `user.name` → `user.displayName`
- `server/api/operator/work-queue.get.ts` — `u.name` → `u.displayName`
- `server/scripts/seed.ts` — update `createUser` calls to use `username` + `displayName`
- Test files referencing `user.name` — update to `user.displayName` or `user.username`

## Data Models

### SQLite Schema Change

**Migration 009: `009_user_admin_roles.sql`**

```sql
-- 1. Create users_new with target schema (no name column)
CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  department TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- 2. Copy data, deduplicating username from name via ROW_NUMBER()
INSERT INTO users_new (id, username, display_name, department, is_admin, active, created_at)
SELECT id,
  CASE WHEN rn = 1 THEN name ELSE name || '_' || (rn) END AS username,
  name AS display_name, department, 0 AS is_admin, active, created_at
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY name ORDER BY rowid) AS rn
  FROM users
);

-- 3. Drop old table, rename new table
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- 4. Create unique index on username
CREATE UNIQUE INDEX idx_users_username ON users(username);
```

### Duplicate Username Handling

The migration handles the edge case where two existing users share the same `name` using `ROW_NUMBER() OVER (PARTITION BY name ORDER BY rowid)`:
- First occurrence (rank 1) keeps the name as-is for `username`
- Subsequent duplicates get `name_2`, `name_3`, etc.

### Row-to-Domain Mapping

```typescript
interface UserRow {
  id: string
  username: string
  display_name: string
  department: string | null
  is_admin: number        // 0 or 1
  active: number          // 0 or 1
  created_at: string
}

function rowToDomain(row: UserRow): ShopUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    department: row.department ?? undefined,
    isAdmin: row.is_admin === 1,
    active: row.active === 1,
    createdAt: row.created_at,
  }
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The prework analysis identified the following consolidated properties after eliminating redundancy. Key consolidations:
- User creation defaults + field persistence + repository round-trip → single round-trip property
- isAdmin computed matching + reactive updates → single reactivity property
- Admin button visibility + page gating → single admin-gated UI property
- Admin badge presence + absence → single badge property

### Property 1: User CRUD Round-Trip

*For any* valid username (non-empty, unique) and displayName (non-empty), and any boolean isAdmin value, creating a user with those fields and then reading it back by ID should return a user with identical `username`, `displayName`, `isAdmin`, `department`, and `active` fields. When `isAdmin` is omitted from the creation input, the read-back user should have `isAdmin === false`.

**Validates: Requirements 1.7, 2.3, 2.4, 8.6**

### Property 2: Username Uniqueness Enforcement

*For any* two user creation inputs sharing the same `username` (case-sensitive), the second creation should throw a `ValidationError`. The first user should remain unaffected in the repository.

**Validates: Requirements 1.8**

### Property 3: Empty/Whitespace Input Rejection

*For any* string composed entirely of whitespace characters (including the empty string), attempting to create a user with that string as `username` should throw a `ValidationError`, and attempting to create a user with that string as `displayName` should throw a `ValidationError`. The repository should remain unchanged after the rejected call.

**Validates: Requirements 1.7, 3.4, 3.5**

### Property 4: isAdmin Computed Tracks Selected User

*For any* sequence of ShopUser objects with varying `isAdmin` values, when each user is set as the selected user in the `useUsers` composable, the `isAdmin` computed property should equal that user's `isAdmin` field. When the selected user is cleared (set to null), `isAdmin` should return `false`.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 5: Admin-Gated New Job Button Visibility

*For any* ShopUser, the "New Job" button on the jobs list page should be visible if and only if that user's `isAdmin` is `true`. When no user is selected, the button should not be visible.

**Validates: Requirements 6.3, 6.4, 6.5**

### Property 6: Admin Badge Matches isAdmin Flag

*For any* list of ShopUser objects rendered in the Settings user list, a user should have an "Admin" badge displayed next to their name if and only if their `isAdmin` field is `true`.

**Validates: Requirements 7.1, 7.2**

### Property 7: Migration Username Deduplication

*For any* set of pre-migration user rows where some share the same `name` value, after migration, all `username` values should be unique. The first occurrence (by rowid) should keep the original name as username, and subsequent duplicates should have a numeric suffix appended.

**Validates: Requirements 8.2**

### Property 8: Migration Data Preservation

*For any* set of pre-migration user rows, after migration, every user should have `display_name` equal to their original `name`, and `username` should start with their original `name` (possibly with a dedup suffix). The `is_admin` field should default to `0` (false) for all existing users.

**Validates: Requirements 1.4, 2.2, 8.1**

## Error Handling

### Service Layer

| Scenario | Error Type | HTTP Status | Message |
|----------|-----------|-------------|---------|
| Empty/whitespace `username` on create | `ValidationError` | 400 | "username is required" |
| Empty/whitespace `displayName` on create | `ValidationError` | 400 | "displayName is required" |
| Duplicate `username` on create | `ValidationError` | 400 | "Username '{username}' is already taken" |
| Empty/whitespace `username` on update | `ValidationError` | 400 | "username is required" |
| Empty/whitespace `displayName` on update | `ValidationError` | 400 | "displayName is required" |
| Duplicate `username` on update (different user) | `ValidationError` | 400 | "Username '{username}' is already taken" |
| User not found on update | `NotFoundError` | 404 | "User not found: {id}" |

### Client-Side Form Validation

The `UserForm` component validates before submission:
- Empty `username` → inline error "Username is required"
- Empty `displayName` → inline error "Display name is required"

Server-side errors (e.g., duplicate username) are caught by the Settings page's `onCreateUser`/`onUpdateUser` handlers and displayed as `userError`.

### Migration Errors

- If the migration encounters an unexpected state (e.g., NULL name values), the transaction rolls back and the app fails to start. This is consistent with the existing migration runner behavior.
- FK integrity check runs after migration — any violations cause a hard failure.

## Testing Strategy

### Property-Based Tests (fast-check)

Each correctness property maps to a single property-based test file with minimum 100 iterations.

| Property | Test File | Key Generators |
|----------|-----------|----------------|
| P1: User CRUD Round-Trip | `tests/properties/userCrudRoundTrip.property.test.ts` | `fc.record({ username: fc.string(), displayName: fc.string(), isAdmin: fc.boolean(), department: fc.option(fc.string()) })` filtered to non-empty username/displayName |
| P2: Username Uniqueness | `tests/properties/usernameUniqueness.property.test.ts` | Pairs of user inputs sharing the same username |
| P3: Whitespace Rejection | `tests/properties/userInputValidation.property.test.ts` | `fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'))` for whitespace strings |
| P4: isAdmin Computed | `tests/properties/userAdminComputed.property.test.ts` | `fc.array(fc.record({ id: fc.uuid(), isAdmin: fc.boolean(), ... }))` |
| P5: Admin-Gated Button | Covered by P4 logic + unit test for component rendering |
| P6: Admin Badge | Covered by unit test (UI rendering, not pure logic) |
| P7: Migration Dedup | `tests/properties/userMigrationDedup.property.test.ts` | `fc.array(fc.string({ minLength: 1 }))` for name lists with potential duplicates |
| P8: Migration Preservation | Combined with P7 test file |

### Unit Tests

| Area | Test File | What It Covers |
|------|-----------|----------------|
| UserService | `tests/unit/services/userService.test.ts` (update existing) | Create with new fields, update isAdmin, duplicate username error, default isAdmin=false |
| UserForm | `tests/unit/components/UserForm.test.ts` (new) | Renders username + displayName inputs, isAdmin toggle, validation errors |
| UserSelector | Unit test or existing component test | displayName in labels, "Select User" fallback |
| Settings user list | Unit test | Admin badge rendering |
| Jobs page gating | Unit test | New Job button visibility based on isAdmin |
| Migration | `tests/unit/repositories/sqlite/migrations.test.ts` (update) | Schema correctness after migration 009 |

### Integration Tests

| Test | File | What It Covers |
|------|------|----------------|
| User lifecycle | `tests/integration/userAdminRoles.test.ts` (new) | Create user → verify fields → update isAdmin → verify persistence → duplicate username rejection |

### Test Configuration

- Property tests: minimum 100 iterations via `{ numRuns: 100 }`
- Property test tagging: `// Feature: user-admin-roles, Property N: {title}`
- PBT library: `fast-check` (already in project dependencies)
- Integration tests use isolated temp SQLite databases via `createTestContext()`
- Component tests use `happy-dom` environment

