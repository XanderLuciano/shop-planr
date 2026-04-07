# Implementation Plan: PIN Auth + JWT

## Overview

Implement PIN-based authentication with ES256-signed JWTs for Shop Planr. The plan progresses from database schema → server-side auth infrastructure → middleware → API routes → client-side composable/plugin → UI components → migration of existing useUsers() references → cleanup. Each task builds on the previous, ensuring no orphaned code.

## Tasks

- [x] 1. Install dependencies and create migration 012
  - Run `npm install jose bcryptjs rate-limiter-flexible` and `npm install -D @types/bcryptjs`
  - Create `server/repositories/sqlite/migrations/012_pin_auth.sql` with:
    - `ALTER TABLE users ADD COLUMN pin_hash TEXT`
    - `CREATE TABLE crypto_keys (id TEXT PRIMARY KEY, algorithm TEXT NOT NULL, public_key TEXT NOT NULL, private_key TEXT NOT NULL, created_at TEXT NOT NULL)`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Add domain types, error class, and CryptoKeyRepository
  - [x] 2.1 Extend domain types and add AuthenticationError
    - Add `pinHash?: string | null` to `ShopUser` in `server/types/domain.ts`
    - Add `CryptoKey` interface to `server/types/domain.ts`
    - Add `AuthenticationError` class to `server/utils/errors.ts`
    - Add `{ errorClass: AuthenticationError, statusCode: 401 }` to `ERROR_STATUS_MAP` in `server/utils/httpError.ts`
    - _Requirements: 1.1, 4.4, 6.3_

  - [x] 2.2 Create CryptoKeyRepository interface and SQLite implementation
    - Create `server/repositories/interfaces/cryptoKeyRepository.ts` with `getByAlgorithm(algorithm)` and `create(row)` methods
    - Create `server/repositories/sqlite/cryptoKeyRepository.ts` implementing the interface
    - Export from `server/repositories/interfaces/index.ts`
    - Add `cryptoKeys: CryptoKeyRepository` to `RepositorySet` in `server/repositories/sqlite/index.ts`
    - Instantiate `SQLiteCryptoKeyRepository` in `createSQLiteRepositories()`
    - _Requirements: 2.1, 2.3_

  - [x] 2.3 Update UserRepository to handle pinHash field
    - Update `SQLiteUserRepository` to read/write `pin_hash` column, mapping to `pinHash` on `ShopUser`
    - _Requirements: 1.1, 3.3_

- [x] 3. Implement AuthService
  - [x] 3.1 Create authService with key management and PIN operations
    - Create `server/services/authService.ts` with `createAuthService()` factory function
    - Implement `ensureKeyPair()`: generate ECDSA P-256 key pair via `jose.generateKeyPair`, store PEM in crypto_keys table, or load existing
    - Implement `getPublicKey()` and `getPrivateKey()`: parse PEM from stored key pair
    - Implement `setupPin(userId, pin)`: validate 4-digit format, bcrypt hash, store in user record, return signed JWT
    - Implement `login(username, pin)`: look up user, bcrypt compare, throw `AuthenticationError` on failure, return signed JWT
    - Implement `resetPin(adminUserId, targetUserId)`: verify admin, set target user's pin_hash to NULL
    - Implement `signToken(user)`: create ES256 JWT with all ShopUser fields, 24h expiry
    - Implement `verifyToken(token)`: verify signature + expiry with public key
    - Implement `refreshToken(token)`: verify existing token, issue new one with fresh expiry
    - Implement `ensureDefaultAdmin()`: create admin user if users table is empty
    - Export `AuthService` type
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.3, 3.5, 3.6, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 7.1, 7.4, 13.1, 13.3, 13.4, 14.1, 14.3_

  - [x] 3.2 Wire AuthService into services.ts
    - Import and instantiate `createAuthService` in `server/utils/services.ts`
    - Add `authService: AuthService` to `ServiceSet` interface
    - Call `authService.ensureKeyPair()` and `authService.ensureDefaultAdmin()` during service initialization
    - _Requirements: 2.1, 14.1_

- [x] 4. Implement server middleware
  - [x] 4.1 Create rate limit middleware
    - Create `server/middleware/01.rateLimit.ts`
    - Import `RateLimiterMemory` from `rate-limiter-flexible`
    - Create 9 limiter instances (3 tiers × 3 windows) as specified in design
    - Implement tier selection based on route path + auth status
    - On rejection: return 429 with `Retry-After` header from `msBeforeNext / 1000`
    - Skip non-API routes (only apply to `/api/` paths)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 4.2 Create auth middleware
    - Create `server/middleware/02.auth.ts`
    - Read `Authorization: Bearer <token>` from request headers
    - Exempt routes: `POST /api/auth/login`, `POST /api/auth/setup-pin`, `GET /api/users`, `POST /api/auth/refresh`
    - On valid token: set `event.context.auth = { user: JwtPayload }` via `authService.verifyToken()`
    - On invalid/missing/expired: throw 401 via `createError()`
    - Skip non-API routes
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Create auth API routes
  - [x] 6.1 Create POST /api/auth/login
    - Create `server/api/auth/login.post.ts`
    - Parse `{ username, pin }` from request body
    - Call `authService.login(username, pin)` and return `{ token }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 6.2 Create POST /api/auth/setup-pin
    - Create `server/api/auth/setup-pin.post.ts`
    - Parse `{ userId, pin }` from request body
    - Call `authService.setupPin(userId, pin)` and return `{ token }`
    - _Requirements: 3.3, 3.5, 3.6_

  - [x] 6.3 Create POST /api/auth/refresh
    - Create `server/api/auth/refresh.post.ts`
    - Extract token from Authorization header
    - Call `authService.refreshToken(token)` and return `{ token }`
    - _Requirements: 7.1, 7.4_

  - [x] 6.4 Create POST /api/auth/reset-pin
    - Create `server/api/auth/reset-pin.post.ts`
    - Extract admin user from `event.context.auth`
    - Parse `{ targetUserId }` from request body
    - Call `authService.resetPin(adminUserId, targetUserId)`
    - _Requirements: 13.1, 13.3, 13.4_

- [x] 7. Implement client-side auth infrastructure
  - [x] 7.1 Create avatar helper utilities
    - Create `app/utils/avatarHelpers.ts` with `getAvatarColor(username)` and `getInitials(displayName)` pure functions
    - _Requirements: 10.2_

  - [x] 7.2 Create useAuth composable
    - Create `app/composables/useAuth.ts`
    - Implement reactive state: `authenticatedUser`, `isAuthenticated`, `isAdmin`, `token`, `users`, `showOverlay`
    - Implement `login(username, pin)`: POST to `/api/auth/login`, decode JWT, set state, store in localStorage, schedule refresh
    - Implement `setupPin(userId, pin)`: POST to `/api/auth/setup-pin`, same flow as login
    - Implement `logout()` and `switchUser()`: clear token from localStorage, reset state, show overlay
    - Implement `fetchUsers()`: GET `/api/users` for avatar picker
    - Implement `scheduleRefresh()`: setTimeout at 80% of token lifetime, call `/api/auth/refresh`
    - Implement `restoreSession()`: check localStorage on load, validate expiry, restore if valid
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 7.2, 7.3_

  - [x] 7.3 Create auth plugin with ofetch instance
    - Create `app/plugins/auth.ts`
    - Use `ofetch.create()` with `onRequest` hook to inject `Authorization: Bearer <token>` header from `useAuth().token`
    - Provide `$authFetch` via `return { provide: { authFetch } }`
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 8. Implement auth UI components
  - [x] 8.1 Create UserAvatar component
    - Create `app/components/UserAvatar.vue`
    - Render circular avatar with generated initials and deterministic HSL color from `getAvatarColor()` / `getInitials()`
    - Accept `username`, `displayName`, and `size` props
    - _Requirements: 10.2_

  - [x] 8.2 Create PinEntry component
    - Create `app/components/PinEntry.vue`
    - 4 masked input boxes, auto-advance on digit entry, auto-submit on 4th digit
    - Emit `submit` event with PIN string
    - Show error message prop, clear on next input
    - _Requirements: 4.1, 4.5, 10.4_

  - [x] 8.3 Create PinSetup component
    - Create `app/components/PinSetup.vue`
    - Two-phase: enter PIN → confirm PIN
    - On mismatch: show error, clear both, refocus first input
    - On match: emit `submit` event with PIN string
    - _Requirements: 3.1, 3.2, 3.4, 3.6_

  - [x] 8.4 Create AvatarPicker component
    - Create `app/components/AvatarPicker.vue`
    - Responsive grid of `UserAvatar` components for all active users
    - Show first name below each avatar
    - Emit `select` event with selected user
    - _Requirements: 10.1, 10.2_

  - [x] 8.5 Create AuthOverlay component
    - Create `app/components/AuthOverlay.vue`
    - Fullscreen overlay (`position: fixed; inset: 0; z-index: 50`) with dimmed background
    - State machine: AvatarPicker → PinEntry (if user has PIN) or PinSetup (if no PIN)
    - Back button on PIN screens to return to avatar picker
    - Wire `useAuth()` actions: `login()`, `setupPin()`
    - Handle errors: show error on invalid PIN, show mismatch on PIN setup
    - _Requirements: 10.1, 10.3, 10.4, 3.1, 3.4, 4.1_

  - [x] 8.6 Create UserMenu component
    - Create `app/components/UserMenu.vue`
    - Small avatar + display name + chevron in header
    - `UDropdownMenu` with "Switch User" and "Log Out" items
    - Both call `useAuth().logout()` / `useAuth().switchUser()`
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 9. Integrate auth into layout
  - [x] 9.1 Update default.vue layout
    - Replace `<UserSelector />` with `<UserMenu />` in the navbar right slot
    - Add `<AuthOverlay />` inside the layout (above dashboard content)
    - Wire `showOverlay` from `useAuth()` to control overlay visibility
    - _Requirements: 11.5, 10.1_

- [x] 10. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Migrate useUsers() references to useAuth()
  - [x] 11.1 Migrate components using requireUser()
    - Update `PathDeleteButton.vue`: replace `useUsers().requireUser()` with `useAuth().authenticatedUser`
    - Update `PartBatchForm.vue`: replace `useUsers().requireUser()` with `useAuth().authenticatedUser`
    - Update `StepNoteForm.vue`: replace `useUsers().requireUser()` with `useAuth().authenticatedUser`
    - _Requirements: 15.3_

  - [x] 11.2 Migrate components using isAdmin
    - Update `jobs/[id].vue`: replace `useUsers().isAdmin` with `useAuth().isAdmin`
    - Update `jobs/new.vue`: replace `useUsers().isAdmin` with `useAuth().isAdmin`
    - Update `jobs/index.vue`: replace `useUsers().isAdmin` with `useAuth().isAdmin`
    - _Requirements: 15.2_

  - [x] 11.3 Migrate components using users list
    - Update `JobCreationForm.vue`: replace `useUsers().users` with `useAuth().users`
    - Update `PathEditor.vue`: replace `useUsers().users` with `useAuth().users`
    - Update `parts/step/[stepId].vue`: replace `useUsers().users` with `useAuth().users`
    - Update `WorkQueueFilterBar.vue` if it uses `useUsers()` (check and migrate)
    - _Requirements: 15.1, 15.2_

  - [x] 11.4 Migrate remaining references
    - Update `certs.vue`: replace `useUsers().requireUser()` with `useAuth().authenticatedUser`
    - Update `settings.vue`: replace `useUsers().fetchUsers` with `useAuth().fetchUsers`
    - Update `useJobForm.ts` composable: replace `useUsers().requireUser()` with `useAuth().authenticatedUser`
    - _Requirements: 15.2, 15.3, 15.5_

  - [x] 11.5 Remove useUsers composable and old UserSelector
    - Delete `app/composables/useUsers.ts`
    - Delete `app/components/UserSelector.vue`
    - _Requirements: 15.4_

- [x] 12. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Update existing tests for auth migration
  - [x] 13.1 Update useUsers tests and property tests
    - Update or replace `tests/unit/composables/useUsers.test.ts` to test `useAuth()` instead
    - Update `tests/properties/userAdminComputed.property.test.ts` to use `useAuth()` composable
    - Update `tests/properties/userAdminJobGating.property.test.ts` to use `useAuth()` composable
    - _Requirements: 15.4, 15.5_

  - [x] 13.2 Write property tests for server-side auth (Properties 1–7, 10–15)
    - Create `tests/properties/pinAuthJwt.property.test.ts`
    - **Property 1: PIN bcrypt round-trip** — _Validates: Requirements 3.3, 4.2_
    - **Property 2: JWT structure completeness** — _Validates: Requirements 5.1, 5.2, 5.3, 5.4_
    - **Property 3: PIN validation rejects non-4-digit input** — _Validates: Requirements 3.6, 4.5_
    - **Property 4: Invalid PIN produces authentication error** — _Validates: Requirements 4.4_
    - **Property 5: Valid JWT attaches user context** — _Validates: Requirements 6.1, 6.2_
    - **Property 6: Missing or invalid token returns 401** — _Validates: Requirements 6.3, 6.5_
    - **Property 7: Token refresh produces a new valid token** — _Validates: Requirements 7.1, 7.4_
    - **Property 10: Rate limit exceeded returns 429** — _Validates: Requirements 12.1, 12.5_
    - **Property 11: Admin PIN reset sets pin_hash to NULL** — _Validates: Requirements 13.1_
    - **Property 12: Non-admin PIN reset throws ForbiddenError** — _Validates: Requirements 13.3, 13.4_
    - **Property 13: ensureDefaultAdmin is idempotent when users exist** — _Validates: Requirements 14.3_
    - **Property 14: ensureKeyPair is idempotent when key exists** — _Validates: Requirements 2.2_
    - **Property 15: Migration preserves existing users with pin_hash NULL** — _Validates: Requirements 1.3_

  - [x] 13.3 Write property tests for client-side auth (Properties 8–9)
    - Create `tests/properties/pinAuthComposable.property.test.ts`
    - **Property 8: Logout and switch clear token and state** — _Validates: Requirements 8.3, 8.4, 11.3, 11.4_
    - Create `tests/properties/avatarHelpers.property.test.ts`
    - **Property 9: Deterministic avatar color and initials** — _Validates: Requirements 10.2_

  - [x] 13.4 Write unit tests for auth service and middleware
    - Create `tests/unit/services/authService.test.ts`
    - Test: default admin bootstrap, PIN setup happy path, login happy path, refresh happy path, admin PIN reset, non-admin PIN reset rejection
    - Create `tests/unit/utils/pinValidation.test.ts` — PIN format validation edge cases
    - Create `tests/unit/utils/avatarHelpers.test.ts` — known inputs → known outputs
    - _Requirements: 3.3, 4.2, 4.4, 5.1, 13.1, 13.4, 14.1_

  - [x] 13.5 Write integration tests for auth flows
    - Create `tests/integration/authFlow.test.ts`
    - Test: full login flow, token refresh flow, admin PIN reset flow, first boot flow
    - _Requirements: 3.5, 4.3, 7.1, 13.1, 14.1_

- [x] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The migration number is 012, following the existing 011_priority_not_null_resequence.sql
- New dependencies: `jose`, `bcryptjs`, `rate-limiter-flexible`, `@types/bcryptjs` (dev)
- `server/middleware/` directory does not exist yet — task 4 creates it
