# Requirements Document

## Introduction

This document defines the requirements for adding a GitHub Issues navigation link to the sidebar footer of Shop Planr. The link gives users a quick way to report bugs and request features by opening the project's GitHub Issues page in a new browser tab. This addresses GitHub Issue #106.

## Glossary

- **Sidebar**: The collapsible `UDashboardSidebar` component rendered in `app/layouts/default.vue`, containing the primary navigation menu and a footer section.
- **Sidebar_Footer**: The `#footer` template slot of the Sidebar, currently containing the API Docs link, a collapse button, and a color mode toggle.
- **GitHub_Issues_Link**: A `NuxtLink` element in the Sidebar Footer that navigates to the project's GitHub Issues page in a new browser tab.
- **API_Docs_Link**: The existing `NuxtLink` element in the Sidebar Footer that opens the API documentation page in a new tab.

## Requirements

### Requirement 1: Display GitHub Issues Link in Sidebar Footer

**User Story:** As a user, I want to see a GitHub Issues link in the sidebar navigation footer, so that I can quickly access the project's issue tracker to report bugs or request features.

#### Acceptance Criteria

1. THE Sidebar_Footer SHALL display the GitHub_Issues_Link below the API_Docs_Link and above the collapse/color-mode row.
2. THE GitHub_Issues_Link SHALL display a bug icon (`i-lucide-bug`), the text label "Report Issue", and a trailing external-link icon (`i-lucide-external-link`).
3. THE GitHub_Issues_Link SHALL use identical CSS classes and icon sizing as the API_Docs_Link to maintain visual consistency.

### Requirement 2: Open GitHub Issues in a New Tab

**User Story:** As a user, I want the GitHub Issues link to open in a new browser tab, so that I do not lose my current place in the application.

#### Acceptance Criteria

1. WHEN a user clicks the GitHub_Issues_Link, THE Sidebar SHALL open the GitHub Issues URL in a new browser tab using `target="_blank"`.
2. WHEN a user clicks the GitHub_Issues_Link, THE Sidebar SHALL keep the current application tab unchanged and not navigate away.
3. THE GitHub_Issues_Link SHALL point to a valid GitHub Issues URL for the project repository.

### Requirement 3: Secure External Navigation

**User Story:** As a user, I want external links to be secure, so that the opened page cannot interfere with my application session.

#### Acceptance Criteria

1. THE GitHub_Issues_Link SHALL include `rel="noopener noreferrer"` to prevent the target page from accessing `window.opener`.

### Requirement 4: Collapsed Sidebar Behavior

**User Story:** As a user, I want the GitHub Issues link to adapt when the sidebar is collapsed, so that the interface remains clean and usable.

#### Acceptance Criteria

1. WHILE the Sidebar is collapsed, THE GitHub_Issues_Link SHALL display only the bug icon.
2. WHILE the Sidebar is collapsed, THE GitHub_Issues_Link SHALL hide the text label and the external-link icon using `group-data-[collapsed]:hidden`.

### Requirement 5: Accessibility

**User Story:** As a user relying on assistive technology, I want the GitHub Issues link to be accessible, so that I can navigate to it using a screen reader or keyboard.

#### Acceptance Criteria

1. THE GitHub_Issues_Link SHALL render as a semantic `<a>` element (via `NuxtLink`) with visible text content for screen readers.

### Requirement 6: No Side Effects on Existing Navigation

**User Story:** As a user, I want the addition of the GitHub Issues link to have no impact on existing navigation behavior, so that the app continues to work as expected.

#### Acceptance Criteria

1. THE GitHub_Issues_Link SHALL NOT affect page toggle filtering, route middleware, or any other existing navigation behavior.
2. THE GitHub_Issues_Link SHALL NOT require any new components, composables, API routes, or server-side changes.
