# Requirements Document

## Introduction

The StepTracker component renders process steps as a horizontal flex row with arrows between them. When a job's path has many steps (e.g., 6+), the row overflows its parent container horizontally, pushing content off-screen and degrading the user experience. Additionally, the StepAssignmentDropdown (rendered inside each step card) opens a popover menu that can overflow the parent path card container, getting clipped or hidden. This feature addresses both overflow issues to ensure the step visualization and assignment controls remain usable and visually clean regardless of step count.

## Glossary

- **StepTracker**: The Vue component (`app/components/StepTracker.vue`) that renders process steps as a horizontal sequence of cards with arrows between them
- **StepAssignmentDropdown**: The Vue component (`app/components/StepAssignmentDropdown.vue`) that renders a `USelectMenu` for assigning a user to a process step
- **Path_Card**: The bordered container on the Job Detail page (`app/pages/jobs/[id].vue`) that wraps each path's header, advancement mode, StepTracker, and notes section
- **Step_Card**: An individual step box within the StepTracker, displaying step name, location, serial counts, and assignment dropdown
- **Job_Detail_Page**: The page at `/jobs/[id]` that displays job routing with paths and their step trackers

## Requirements

### Requirement 1: Graceful Step Overflow Handling

**User Story:** As a shop manager, I want to see all process steps for a path without horizontal content being cut off or requiring awkward scrolling, so that I can quickly assess the full routing at a glance.

#### Acceptance Criteria

1. WHEN a path has more steps than can fit in the visible width of the Path_Card, THE StepTracker SHALL wrap Step_Cards onto additional rows rather than overflowing horizontally
2. WHEN Step_Cards wrap onto multiple rows, THE StepTracker SHALL maintain directional arrow indicators between consecutive steps so the step sequence remains clear
3. WHEN Step_Cards wrap onto multiple rows, THE StepTracker SHALL maintain consistent spacing and alignment between rows so the layout appears intentional and tidy
4. THE StepTracker SHALL render each Step_Card at a consistent minimum width sufficient to display the step name, serial count, and assignment dropdown without truncation of critical data
5. WHEN a path has 1 to 3 steps, THE StepTracker SHALL display all steps in a single row without unnecessary wrapping

### Requirement 2: Condensed Step Card Layout

**User Story:** As a shop manager, I want step cards to use space efficiently so that more steps fit per row before wrapping occurs, reducing visual clutter on paths with many steps.

#### Acceptance Criteria

1. THE StepTracker SHALL render each Step_Card with compact padding and font sizes so that the maximum number of steps fit per row before wrapping is triggered
2. THE StepTracker SHALL truncate step names and location text that exceed the Step_Card width, using text truncation with the full text accessible via a tooltip or title attribute
3. WHEN a Step_Card displays serial count and completed count, THE StepTracker SHALL use a compact single-line format rather than stacking count labels vertically

### Requirement 3: Assignee Dropdown Width Containment

**User Story:** As a shop manager, I want the assignee dropdown trigger to fit within the step card so that it does not overflow the card boundary and break the layout.

#### Acceptance Criteria

1. THE StepAssignmentDropdown trigger element SHALL NOT exceed the width of its parent Step_Card at any viewport size
2. THE StepAssignmentDropdown trigger SHALL truncate long assignee names with an ellipsis so the full name does not push the trigger beyond the Step_Card boundary
3. THE StepAssignmentDropdown trigger SHALL use the full available width within the Step_Card rather than a fixed pixel width

### Requirement 4: Responsive Behavior

**User Story:** As a user on a smaller screen or resized browser window, I want the step tracker to adapt to the available width so that steps remain readable without horizontal page scrolling.

#### Acceptance Criteria

1. WHEN the viewport width decreases, THE StepTracker SHALL allow Step_Cards to wrap onto additional rows to fit the available space
2. WHEN the viewport width is narrow enough that a single Step_Card approaches the full container width, THE StepTracker SHALL stack steps vertically in a single column
3. THE Job_Detail_Page SHALL NOT produce a horizontal scrollbar on the page body due to StepTracker content at any viewport width above 320px
