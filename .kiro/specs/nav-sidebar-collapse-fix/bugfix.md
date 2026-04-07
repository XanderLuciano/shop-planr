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

### Additional Defects (Discovered During Fix)

4.1 WHEN the sidebar is collapsed THEN the resizable panel allocates 0% width (default `collapsed-size`), causing the adjacent panel and resize handle to overlap the sidebar's visual area, making nav icons and the expand button unclickable

4.2 WHEN the sidebar is collapsed THEN the "Shop Planr" header text and "API Docs" link text are not hidden, causing text to wrap in the narrow collapsed sidebar

4.3 WHEN the sidebar is collapsed THEN the `UNavigationMenu` does not receive the `collapsed` prop, so it does not switch to icon-only mode (labels leak through, highlight padding is wrong)

4.4 WHEN the sidebar is collapsed THEN the body/footer `px-4` padding pushes icons off-center in the narrow collapsed width

### Additional Expected Behavior

5.1 WHEN the sidebar is collapsed THEN the system SHALL allocate sufficient resize panel width (`collapsed-size="4"`) so the sidebar's visual area is fully interactive

5.2 WHEN the sidebar is collapsed THEN the system SHALL hide the "Shop Planr" header text and "API Docs" link text, showing only icons

5.3 WHEN the sidebar is collapsed THEN the `UNavigationMenu` SHALL receive the `collapsed` prop so it renders in icon-only mode with correct highlight styling

5.4 WHEN the sidebar is collapsed THEN the body, header, and footer padding SHALL be reduced and items centered so icons appear visually centered
