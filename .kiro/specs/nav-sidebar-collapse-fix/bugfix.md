# Bugfix Requirements Document

## Introduction

When the sidebar is collapsed in the default layout, the `UColorModeButton` and `UDashboardSidebarCollapse` button overlap in the sidebar footer, making both the nav icons and the expand button unusable. Since a `UColorModeButton` already exists in the top navbar (`UDashboardNavbar`), the sidebar instance is redundant and should be removed.

GitHub Issue #116.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the sidebar is collapsed THEN the system renders the `UColorModeButton` overlapping the `UDashboardSidebarCollapse` button, making the expand button un-clickable

1.2 WHEN the sidebar is collapsed THEN the system renders the `UColorModeButton` on top of the navigation icons, making them unusable

### Expected Behavior (Correct)

2.1 WHEN the sidebar is collapsed THEN the system SHALL render only the `UDashboardSidebarCollapse` button in the sidebar footer without any overlapping elements

2.2 WHEN the sidebar is collapsed THEN the system SHALL keep all navigation icons fully visible and clickable

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the sidebar is expanded THEN the system SHALL CONTINUE TO display the collapse button in the sidebar footer

3.2 WHEN the user wants to toggle light/dark mode THEN the system SHALL CONTINUE TO provide the color mode toggle in the top navbar

3.3 WHEN the sidebar is collapsed or expanded THEN the system SHALL CONTINUE TO display the API Docs link in the sidebar footer
