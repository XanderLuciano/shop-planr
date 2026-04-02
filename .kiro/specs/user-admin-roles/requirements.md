# Requirements Document

## Introduction

This feature extends the ShopUser model with `username`, `displayName`, and `isAdmin` fields to support a simple admin/user role distinction. The goal is UI scoping — reducing visual noise for regular users by hiding advanced features (like job creation) behind admin checks. This is not a security layer; there are no passwords or server-side auth enforcement. The existing kiosk-mode user selection remains, and the user selector dropdown will show display names. Admins can be flagged via a toggle in the Settings → Users tab.

## Glossary

- **ShopUser**: A kiosk-mode user identity stored in the `users` SQLite table. Currently has `id`, `name`, `department`, `active`, `createdAt`.
- **User_Service**: The server-side service (`userService`) that handles user CRUD operations.
- **User_Repository**: The data access layer (`UserRepository`) for reading/writing user records to SQLite.
- **User_Form**: The Vue component (`UserForm.vue`) used in Settings → Users tab for creating and editing users.
- **User_Selector**: The Vue dropdown component (`UserSelector.vue`) in the app header for selecting the active user.
- **useUsers_Composable**: The shared Vue composable (`useUsers.ts`) that manages user list state, selected user, and localStorage persistence.
- **Job_Creation_Page**: The `/jobs/new` page that renders the `JobCreationForm` component for creating new jobs.
- **Admin_User**: A ShopUser with `isAdmin` set to `true`, granting visibility of advanced UI features.
- **Regular_User**: A ShopUser with `isAdmin` set to `false`, seeing a simplified interface.
- **Migration**: A forward-only SQL file in `server/repositories/sqlite/migrations/` that alters the database schema.

## Requirements

### Requirement 1: Extend ShopUser with Username and Display Name

**User Story:** As a shop manager, I want each user to have a distinct username and a display name, so that users can be uniquely identified by a short handle while showing a friendly name in the UI.

#### Acceptance Criteria

1. THE ShopUser type SHALL include a `username` field of type string.
2. THE ShopUser type SHALL include a `displayName` field of type string.
3. THE Migration SHALL add `username` and `display_name` columns to the `users` table.
4. THE Migration SHALL populate `username` and `display_name` from the existing `name` column for all existing user rows.
5. THE Migration SHALL make the `username` column NOT NULL with a UNIQUE constraint.
6. THE Migration SHALL make the `display_name` column NOT NULL.
7. WHEN a new user is created, THE User_Service SHALL require both `username` and `displayName` to be non-empty strings.
8. WHEN a user is created with a `username` that already exists, THE User_Service SHALL return a validation error indicating the username is taken.

### Requirement 2: Add isAdmin Flag to ShopUser

**User Story:** As a shop manager, I want to flag certain users as admins, so that the app can show or hide advanced features based on the user's role.

#### Acceptance Criteria

1. THE ShopUser type SHALL include an `isAdmin` field of type boolean.
2. THE Migration SHALL add an `is_admin` column to the `users` table with a default value of `false`.
3. WHEN a new user is created without specifying `isAdmin`, THE User_Service SHALL default `isAdmin` to `false`.
4. WHEN a user is updated with an `isAdmin` value, THE User_Service SHALL persist the new `isAdmin` value.

### Requirement 3: Update User Form for New Fields

**User Story:** As a shop manager, I want the user creation and edit forms to include username, display name, and an admin toggle, so that I can manage all user properties from the Settings page.

#### Acceptance Criteria

1. THE User_Form SHALL display input fields for `username` and `displayName` instead of the single `name` field.
2. THE User_Form SHALL display a toggle switch for the `isAdmin` flag when editing an existing user.
3. THE User_Form SHALL display a toggle switch for the `isAdmin` flag when creating a new user.
4. WHEN the `username` field is empty on submission, THE User_Form SHALL display a validation error stating that username is required.
5. WHEN the `displayName` field is empty on submission, THE User_Form SHALL display a validation error stating that display name is required.

### Requirement 4: Display Name in User Selector

**User Story:** As a shop floor user, I want the user selector dropdown to show display names, so that I can easily identify and select myself.

#### Acceptance Criteria

1. THE User_Selector SHALL display each user's `displayName` as the label in the dropdown menu.
2. THE User_Selector SHALL display the selected user's `displayName` on the trigger button.
3. WHEN no user is selected, THE User_Selector SHALL display "Select User" as the trigger button label.

### Requirement 5: Admin Check Composable

**User Story:** As a developer, I want a reactive way to check if the currently selected user is an admin, so that I can use `v-if` directives in templates to conditionally show admin-only UI elements.

#### Acceptance Criteria

1. THE useUsers_Composable SHALL expose a reactive `isAdmin` computed property that returns `true` when the selected user has `isAdmin` set to `true`.
2. WHEN no user is selected, THE useUsers_Composable `isAdmin` property SHALL return `false`.
3. WHEN the selected user changes, THE useUsers_Composable `isAdmin` property SHALL reactively update to reflect the new user's admin status.

### Requirement 6: Restrict Job Creation to Admins

**User Story:** As a shop manager, I want job creation to be visible only to admin users, so that regular users see a simpler interface without advanced features they do not need.

#### Acceptance Criteria

1. WHEN a Regular_User navigates to the Job_Creation_Page, THE Job_Creation_Page SHALL redirect the user to the jobs list page.
2. WHEN an Admin_User navigates to the Job_Creation_Page, THE Job_Creation_Page SHALL render the job creation form.
3. WHILE a Regular_User is selected, THE jobs list page SHALL hide the "New Job" button or link.
4. WHILE an Admin_User is selected, THE jobs list page SHALL display the "New Job" button or link.
5. WHILE no user is selected, THE jobs list page SHALL hide the "New Job" button or link.

### Requirement 7: Admin Badge in User List

**User Story:** As a shop manager, I want to see which users are admins at a glance in the Settings user list, so that I can quickly audit role assignments.

#### Acceptance Criteria

1. WHILE a user in the Settings user list has `isAdmin` set to `true`, THE Settings page SHALL display an "Admin" badge next to that user's name.
2. WHILE a user in the Settings user list has `isAdmin` set to `false`, THE Settings page SHALL not display an "Admin" badge for that user.

### Requirement 8: Remove Name Field and Migrate References

**User Story:** As a developer, I want the migration to replace the `name` column with `username` and `display_name`, and update all codebase references to use `displayName`, so that the data model is clean and descriptive long-term.

#### Acceptance Criteria

1. THE Migration SHALL copy the existing `name` value into both `username` and `display_name` for each existing user row.
2. IF two existing users have the same `name` value, THEN THE Migration SHALL append a numeric suffix to the duplicate `username` values to satisfy the UNIQUE constraint.
3. THE Migration SHALL drop the `name` column from the `users` table after populating the new columns.
4. THE ShopUser type SHALL remove the `name` field entirely and use `username` and `displayName` instead.
5. ALL codebase references to `ShopUser.name` SHALL be updated to use `displayName` (or `username` where a unique identifier is needed).
6. THE User_Repository SHALL read and write using the new `username`, `displayName`, and `isAdmin` fields only.
7. THE seed script SHALL be updated to create users with `username` and `displayName` instead of `name`.
