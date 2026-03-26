# Requirements Document

## Introduction

This document defines the requirements for the Nav Page Toggles feature, which adds a "Page Visibility" tab to the Settings page allowing administrators to toggle sidebar navigation pages on or off. Each toggleable page has a feature flag stored in the `settings` singleton. When toggled off, pages are hidden from the sidebar and inaccessible via direct URL. Dashboard and Settings are always visible and cannot be toggled off.

## Glossary

- **Settings_Page**: The existing application settings page at `/settings`, extended with a "Page Visibility" tab
- **PageVisibilitySettings_Component**: A new Vue component that renders toggle switches for each toggleable page
- **PageToggles**: A JSON object mapping page identifiers (e.g., `jobs`, `serials`, `parts`) to boolean enabled/disabled values
- **Sidebar**: The navigation sidebar rendered in `default.vue` containing links to all application pages
- **PageGuard_Middleware**: A global Nuxt route middleware that prevents navigation to disabled pages
- **Settings_Service**: The existing `settingsService` module extended to handle `pageToggles` persistence
- **Settings_API**: The existing `PUT /api/settings` endpoint extended to accept `pageToggles` updates
- **Always_Visible_Pages**: Dashboard (`/`) and Settings (`/settings`), which cannot be toggled off
- **Toggleable_Pages**: Jobs, Serials, Parts, Queue, Templates, BOM, Certs, Jira, Audit
- **Detail_Route**: A child route of a toggleable page (e.g., `/jobs/123`, `/serials/456`)
- **DEFAULT_PAGE_TOGGLES**: The default configuration where all toggleable pages are enabled (`true`)

## Requirements

### Requirement 1: Display Page Visibility Controls

**User Story:** As an administrator, I want to see a list of toggleable pages with on/off switches in the Settings page, so that I can control which pages are visible in the application.

#### Acceptance Criteria

1. WHEN an administrator navigates to the Settings_Page, THE Settings_Page SHALL display a "Page Visibility" tab containing the PageVisibilitySettings_Component
2. WHEN the PageVisibilitySettings_Component renders, THE PageVisibilitySettings_Component SHALL display a toggle switch for each of the nine Toggleable_Pages with its label and icon
3. WHEN the PageVisibilitySettings_Component renders, THE PageVisibilitySettings_Component SHALL reflect the current enabled or disabled state of each page from the PageToggles stored in settings
4. THE PageVisibilitySettings_Component SHALL display Always_Visible_Pages (Dashboard and Settings) as non-toggleable, visually indicating they cannot be disabled

### Requirement 2: Persist Page Toggle State

**User Story:** As an administrator, I want page toggle changes to be saved to the database, so that visibility settings persist across sessions and page reloads.

#### Acceptance Criteria

1. WHEN an administrator changes a toggle switch, THE Settings_API SHALL accept a partial PageToggles object and persist the merged result to the SQLite settings table
2. WHEN the Settings_Service receives a partial PageToggles update, THE Settings_Service SHALL merge the update with the existing PageToggles, preserving toggle values not included in the update
3. WHEN the Settings_Service receives a PageToggles update containing unknown keys, THE Settings_Service SHALL ignore the unknown keys and persist only valid PageToggles keys
4. WHEN the Settings_Service receives a PageToggles update, THE Settings_Service SHALL validate that all provided values are booleans before persisting

### Requirement 3: Default Page Visibility

**User Story:** As an administrator on a fresh installation, I want all pages to be visible by default, so that no pages are accidentally hidden before I configure visibility.

#### Acceptance Criteria

1. WHEN the settings record has no PageToggles value (fresh install or missing column), THE Settings_Service SHALL treat all Toggleable_Pages as enabled by using DEFAULT_PAGE_TOGGLES
2. WHEN the settings record has a partial PageToggles object with missing keys, THE Settings_Service SHALL treat missing keys as enabled (`true`)

### Requirement 4: Sidebar Filtering

**User Story:** As a user, I want the sidebar to only show pages that are enabled, so that I have a clean navigation experience without links to disabled pages.

#### Acceptance Criteria

1. WHEN PageToggles are loaded, THE Sidebar SHALL display only navigation items whose corresponding page toggle is enabled
2. THE Sidebar SHALL always display navigation items for Always_Visible_Pages regardless of PageToggles state
3. WHEN a page toggle changes from enabled to disabled, THE Sidebar SHALL reactively remove the corresponding navigation item without requiring a page reload
4. WHEN a page toggle changes from disabled to enabled, THE Sidebar SHALL reactively add the corresponding navigation item without requiring a page reload

### Requirement 5: Route Access Control

**User Story:** As an administrator, I want disabled pages to be inaccessible via direct URL navigation, so that users cannot bypass visibility settings by typing a URL.

#### Acceptance Criteria

1. WHEN a user navigates to a route whose corresponding page toggle is disabled, THE PageGuard_Middleware SHALL redirect the user to the Dashboard (`/`)
2. WHEN a user navigates to a Detail_Route whose parent page toggle is disabled, THE PageGuard_Middleware SHALL redirect the user to the Dashboard (`/`)
3. THE PageGuard_Middleware SHALL allow navigation to Always_Visible_Pages regardless of PageToggles state
4. WHEN a user navigates to a route that has no corresponding page toggle, THE PageGuard_Middleware SHALL allow the navigation

### Requirement 6: Sidebar Item Count Bounds

**User Story:** As a user, I want to always see at least Dashboard and Settings in the sidebar, so that I can always access core application functionality.

#### Acceptance Criteria

1. FOR ALL possible PageToggles configurations, THE Sidebar SHALL display at least 2 navigation items (Dashboard and Settings)
2. FOR ALL possible PageToggles configurations, THE Sidebar SHALL display at most the total number of navigation items defined in the application

### Requirement 7: Idempotent Toggle Updates

**User Story:** As an administrator, I want setting a toggle to its current value to produce no observable change, so that repeated saves do not cause unexpected side effects.

#### Acceptance Criteria

1. WHEN the Settings_Service receives a PageToggles update where all values match the current state, THE Settings_Service SHALL persist the settings with only the `updatedAt` timestamp changed

### Requirement 8: Database Migration

**User Story:** As a system operator, I want the database schema to support page toggles, so that the feature has proper storage.

#### Acceptance Criteria

1. WHEN the application starts, THE migration system SHALL add a `page_toggles` TEXT column to the settings table with a default value of `'{}'`
2. WHEN existing settings records lack a `page_toggles` column value, THE Settings_Service SHALL apply DEFAULT_PAGE_TOGGLES so all pages remain visible

### Requirement 9: Error Handling on Toggle Save Failure

**User Story:** As an administrator, I want clear feedback when a toggle save fails, so that I know my changes were not applied.

#### Acceptance Criteria

1. IF the Settings_API returns an error when saving PageToggles, THEN THE PageVisibilitySettings_Component SHALL display an error notification to the user
2. IF the Settings_API returns an error when saving PageToggles, THEN THE PageVisibilitySettings_Component SHALL revert the toggle switches to their previous state

### Requirement 10: Settings Not Yet Loaded

**User Story:** As a user navigating before settings have loaded, I want all pages to remain accessible, so that I am not incorrectly blocked from pages.

#### Acceptance Criteria

1. WHILE settings have not yet been fetched by the application, THE PageGuard_Middleware SHALL treat all pages as enabled using DEFAULT_PAGE_TOGGLES
2. WHILE settings have not yet been fetched by the application, THE Sidebar SHALL display all navigation items
