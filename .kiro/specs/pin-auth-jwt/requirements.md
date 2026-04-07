# Requirements Document

## Introduction

This feature replaces Shop Planr's simple user-selector dropdown with a secure PIN-based authentication system backed by JWT session management. Users authenticate via a fullscreen avatar picker and 4-digit PIN entry. The server validates PINs against bcrypt hashes, issues ES256-signed JWTs, and enforces authentication on all API requests via Nitro middleware. A multi-tier rate limiter protects against brute-force attacks. The existing `useUsers()` composable is retired in favor of a new `useAuth()` composable that serves as the single source of truth for authenticated identity across the entire client application.

## Glossary

- **Auth_Overlay**: The fullscreen avatar picker and PIN entry UI that appears when no valid JWT session exists
- **Avatar_Picker**: The grid of user avatar circles (generated initials with deterministic colors) displayed in the Auth_Overlay
- **PIN_Entry**: The 4-digit numeric input screen shown after a user selects their avatar
- **PIN_Setup_Flow**: The first-time flow where a user without a stored PIN hash enters and confirms a new 4-digit PIN
- **Auth_Service**: The server-side service responsible for PIN validation, JWT signing, JWT verification, and token refresh
- **Auth_Middleware**: The Nitro server middleware that reads the Authorization header, decodes the JWT, and attaches user context to the request event
- **Rate_Limit_Middleware**: The Nitro server middleware that enforces multi-tier sliding-window rate limits on all incoming requests
- **Auth_Plugin**: The Nuxt client plugin that creates an `ofetch` instance with automatic `Authorization: Bearer <token>` header injection
- **Auth_Composable**: The `useAuth()` Vue composable that provides reactive authenticated user state, login/logout/switch actions, and JWT management
- **Key_Store**: The database storage for the ES256 (ECDSA P-256) key pair used to sign and verify JWTs
- **Refresh_Token_Endpoint**: The server API endpoint that issues a new JWT before the current token expires
- **User_Menu**: The header dropdown replacing the current UserSelector, showing avatar + name with "Switch User" and "Log Out" options

## Requirements

### Requirement 1: Database Schema for PIN Authentication

**User Story:** As a system administrator, I want PIN hashes stored securely in the database, so that user credentials are protected and the authentication system has persistent storage.

#### Acceptance Criteria

1. THE Migration SHALL add a `pin_hash` column of type TEXT (nullable) to the `users` table
2. THE Migration SHALL add a `crypto_keys` table with columns for `id` (TEXT PRIMARY KEY), `algorithm` (TEXT NOT NULL), `public_key` (TEXT NOT NULL), `private_key` (TEXT NOT NULL), and `created_at` (TEXT NOT NULL)
3. WHEN the migration is applied to an existing database, THE Migration SHALL preserve all existing user data with `pin_hash` set to NULL
4. THE Migration SHALL use the next sequential migration number after the existing migrations (012)

### Requirement 2: ES256 Key Pair Generation and Storage

**User Story:** As a system administrator, I want the server to auto-generate its signing key pair on first boot, so that JWT authentication works with zero manual setup.

#### Acceptance Criteria

1. WHEN the server starts and no ES256 key pair exists in the Key_Store, THE Auth_Service SHALL generate a new ECDSA P-256 key pair and persist it to the `crypto_keys` table
2. WHEN the server starts and an ES256 key pair already exists in the Key_Store, THE Auth_Service SHALL load the existing key pair without generating a new one
3. THE Auth_Service SHALL store the key pair in PEM format in the `crypto_keys` table
4. THE Auth_Service SHALL not require any environment variables or manual configuration for key management

### Requirement 3: PIN Setup Flow

**User Story:** As a new user (or existing user after deployment), I want to set my own 4-digit PIN on first login, so that I can authenticate in the future.

#### Acceptance Criteria

1. WHEN a user with a NULL `pin_hash` selects their avatar in the Auth_Overlay, THE Auth_Overlay SHALL display the PIN_Setup_Flow instead of the PIN_Entry screen
2. THE PIN_Setup_Flow SHALL require the user to enter a 4-digit numeric PIN and then confirm the PIN by entering it a second time
3. WHEN the two PIN entries in the PIN_Setup_Flow match, THE Auth_Service SHALL hash the PIN using bcrypt and store the hash in the `pin_hash` column for that user
4. WHEN the two PIN entries in the PIN_Setup_Flow do not match, THE Auth_Overlay SHALL display an error message and allow the user to retry
5. WHEN the PIN_Setup_Flow completes successfully, THE Auth_Service SHALL issue a signed JWT and log the user in
6. THE PIN_Setup_Flow SHALL accept only 4-digit numeric values (0000–9999)

### Requirement 4: PIN Login Flow

**User Story:** As a returning user, I want to enter my PIN to authenticate, so that I can access the application securely.

#### Acceptance Criteria

1. WHEN a user with a non-NULL `pin_hash` selects their avatar in the Auth_Overlay, THE Auth_Overlay SHALL display the PIN_Entry screen
2. WHEN the user submits a PIN, THE Auth_Service SHALL validate the PIN against the stored bcrypt hash
3. WHEN the PIN is valid, THE Auth_Service SHALL issue a signed JWT and return it to the client
4. WHEN the PIN is invalid, THE Auth_Service SHALL return a 401 Unauthorized response without revealing whether the username or PIN was incorrect
5. THE PIN_Entry SHALL accept only 4-digit numeric values (0000–9999)

### Requirement 5: JWT Issuance and Structure

**User Story:** As a developer, I want JWTs to contain all necessary user fields, so that the server can identify the authenticated user from the token alone.

#### Acceptance Criteria

1. THE Auth_Service SHALL sign JWTs using the ES256 algorithm (ECDSA with P-256 curve) with the stored private key
2. THE Auth_Service SHALL include the following ShopUser fields in the JWT payload: `id`, `username`, `displayName`, `isAdmin`, `department`, `active`, `createdAt`
3. THE Auth_Service SHALL set the JWT expiry to 24 hours from the time of issuance
4. THE Auth_Service SHALL include an `iat` (issued at) claim and an `exp` (expiration) claim in every JWT

### Requirement 6: JWT Validation Middleware

**User Story:** As a developer, I want all API requests to be authenticated via JWT, so that only authorized users can access server resources.

#### Acceptance Criteria

1. THE Auth_Middleware SHALL read the `Authorization` header from every incoming API request and extract the Bearer token
2. WHEN a valid JWT is present, THE Auth_Middleware SHALL decode the token, verify the signature using the stored public key, and attach the user context to the event
3. WHEN no Authorization header is present or the token is invalid, THE Auth_Middleware SHALL return a 401 Unauthorized response for protected routes
4. THE Auth_Middleware SHALL exempt the login endpoint, the PIN setup endpoint, and the user list endpoint from authentication requirements
5. WHEN a JWT has expired, THE Auth_Middleware SHALL return a 401 Unauthorized response

### Requirement 7: Silent Token Refresh

**User Story:** As a user, I want my session to stay active without re-entering my PIN, so that I can work uninterrupted during long shifts.

#### Acceptance Criteria

1. THE Refresh_Token_Endpoint SHALL accept a valid (non-expired) JWT and return a new JWT with a fresh 24-hour expiry
2. THE Auth_Composable SHALL schedule a background refresh before the current JWT expires (e.g., when 80% of the token lifetime has elapsed)
3. WHEN the background refresh fails (network error or expired token), THE Auth_Composable SHALL clear the session and display the Auth_Overlay
4. THE Refresh_Token_Endpoint SHALL verify the existing token signature and expiry before issuing a new token

### Requirement 8: Client-Side Auth State Management

**User Story:** As a developer, I want a single composable for authentication state, so that all components use a consistent source of truth for the current user.

#### Acceptance Criteria

1. THE Auth_Composable SHALL provide the following reactive state: `authenticatedUser`, `isAuthenticated`, `isAdmin`, `token`, and the following actions: `login()`, `logout()`, `switchUser()`
2. THE Auth_Composable SHALL store the JWT in `localStorage` for persistence across page loads
3. WHEN `logout()` is called, THE Auth_Composable SHALL remove the JWT from `localStorage` and reset all reactive state
4. WHEN `switchUser()` is called, THE Auth_Composable SHALL remove the JWT from `localStorage` and display the Auth_Overlay
5. THE Auth_Composable SHALL replace the existing `useUsers()` composable entirely as the source of authenticated user identity
6. WHEN the application loads and a JWT exists in `localStorage`, THE Auth_Composable SHALL validate the token expiry and restore the session if the token is still valid

### Requirement 9: Automatic Authorization Header Injection

**User Story:** As a developer, I want the JWT token automatically attached to all API requests, so that I do not need to manually add authorization headers in every fetch call.

#### Acceptance Criteria

1. THE Auth_Plugin SHALL create an `ofetch` instance using `ofetch.create()` with an `onRequest` hook that injects the `Authorization: Bearer <token>` header
2. THE Auth_Plugin SHALL read the current token from the Auth_Composable on each request
3. WHEN no token is available, THE Auth_Plugin SHALL send the request without an Authorization header

### Requirement 10: Fullscreen Auth Overlay UI

**User Story:** As a user, I want a clear, fullscreen login screen with avatar selection, so that I can easily identify and select my account.

#### Acceptance Criteria

1. WHEN no valid JWT session exists, THE Auth_Overlay SHALL display as a fullscreen overlay with a dimmed background, blocking access to the application
2. THE Avatar_Picker SHALL display all active users as circular avatars with generated initials and deterministic background colors, with the user's first name displayed underneath
3. WHEN a user taps an avatar, THE Auth_Overlay SHALL animate a transition from the Avatar_Picker to the PIN_Entry or PIN_Setup_Flow screen for that user
4. THE Auth_Overlay SHALL provide a back button on the PIN_Entry and PIN_Setup_Flow screens to return to the Avatar_Picker

### Requirement 11: Header User Menu

**User Story:** As an authenticated user, I want to see my identity in the header and have options to switch users or log out, so that I can manage my session.

#### Acceptance Criteria

1. WHEN a user is authenticated, THE User_Menu SHALL display the user's avatar (generated initials with deterministic color) and display name in the header
2. THE User_Menu SHALL provide a dropdown with "Switch User" and "Log Out" menu items
3. WHEN "Switch User" is selected, THE Auth_Composable SHALL clear the JWT from `localStorage` and display the Auth_Overlay
4. WHEN "Log Out" is selected, THE Auth_Composable SHALL clear the JWT from `localStorage` and display the Auth_Overlay
5. THE User_Menu SHALL replace the existing `UserSelector` component in the default layout header

### Requirement 12: Multi-Tier Rate Limiting

**User Story:** As a system administrator, I want rate limiting on all API endpoints, so that the application is protected against brute-force attacks and abuse.

#### Acceptance Criteria

1. THE Rate_Limit_Middleware SHALL enforce sliding-window rate limits across three time windows: 15 seconds, 1 minute, and 1 hour
2. THE Rate_Limit_Middleware SHALL apply the following limits for authenticated users: 60 requests per 15 seconds, 300 requests per minute, and 10000 requests per hour
3. THE Rate_Limit_Middleware SHALL apply the following limits for unauthenticated users: 10 requests per 15 seconds, 30 requests per minute, and 300 requests per hour
4. THE Rate_Limit_Middleware SHALL apply the following limits for the login endpoint: 3 requests per 15 seconds, 10 requests per minute, and 30 requests per hour
5. WHEN a rate limit is exceeded, THE Rate_Limit_Middleware SHALL return a 429 Too Many Requests response with a `Retry-After` header
6. THE Rate_Limit_Middleware SHALL use in-memory sliding-window counters (Map-based) for tracking request counts per client IP

### Requirement 13: Admin PIN Reset

**User Story:** As an administrator, I want to reset another user's PIN, so that I can help users who have forgotten their PIN regain access.

#### Acceptance Criteria

1. WHEN an admin user requests a PIN reset for another user, THE Auth_Service SHALL set that user's `pin_hash` to NULL
2. WHEN a user whose `pin_hash` has been reset next selects their avatar, THE Auth_Overlay SHALL display the PIN_Setup_Flow
3. THE Auth_Service SHALL verify that the requesting user has `isAdmin` set to true before allowing a PIN reset
4. IF a non-admin user attempts a PIN reset, THEN THE Auth_Service SHALL return a 403 Forbidden response

### Requirement 14: First Admin Bootstrap

**User Story:** As a system administrator deploying Shop Planr for the first time, I want a default admin account created automatically, so that I can set up the system without manual database edits.

#### Acceptance Criteria

1. WHEN the server starts and the `users` table is empty, THE Auth_Service SHALL create a default admin user with username "admin", display name "Administrator", `isAdmin` set to true, and `pin_hash` set to NULL
2. WHEN the default admin user first selects their avatar, THE Auth_Overlay SHALL display the PIN_Setup_Flow so the admin can set their PIN
3. WHEN the `users` table already contains one or more users, THE Auth_Service SHALL not create the default admin user

### Requirement 15: useUsers() to useAuth() Migration

**User Story:** As a developer, I want all components to use the new auth composable, so that user identity is consistently derived from the authenticated JWT session.

#### Acceptance Criteria

1. THE Auth_Composable SHALL provide a `users` list (fetched from the server) for components that need to display user lists (e.g., WorkQueueFilterBar, Settings page)
2. WHEN a component previously called `useUsers().selectedUser`, THE component SHALL instead use `Auth_Composable.authenticatedUser`
3. WHEN a component previously called `useUsers().requireUser()`, THE component SHALL instead use `Auth_Composable.authenticatedUser` (which is guaranteed non-null when authenticated)
4. THE `useUsers()` composable file SHALL be removed after all references are migrated to the Auth_Composable
5. THE following components and files SHALL be migrated: UserSelector.vue, PathDeleteButton.vue, PartBatchForm.vue, StepNoteForm.vue, JobCreationForm.vue, PathEditor.vue, WorkQueueFilterBar.vue, useJobForm.ts, jobs/[id].vue, jobs/new.vue, jobs/index.vue, certs.vue, settings.vue, parts/step/[stepId].vue, and default.vue
