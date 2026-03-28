# Requirements: Job View Utilities

## GitHub Issue #4 — UI/UX Feature Request: Job View Utilities

### Requirement 1: Expand All Jobs
**User Story**: As a shop floor user viewing the Jobs list, I want to expand all job rows at once so I can quickly see path summaries for every job without clicking each one individually.

**Acceptance Criteria**:
- [ ] A toolbar button with a "chevrons-down" icon and "Expand All Jobs" tooltip is visible on the Jobs page
- [ ] Clicking the button expands every job row in the filtered list, rendering their path sub-tables
- [ ] The button is disabled when there are no jobs to expand (empty list)
- [ ] The operation is idempotent — clicking when all jobs are already expanded produces no visible change

### Requirement 2: Collapse All Jobs
**User Story**: As a shop floor user, I want to collapse all expanded job rows at once so I can return to a clean summary view without clicking each row.

**Acceptance Criteria**:
- [ ] A toolbar button with a "chevrons-up" icon and "Collapse All Jobs" tooltip is visible on the Jobs page
- [ ] Clicking the button collapses every expanded job row, hiding all path sub-tables
- [ ] The button is disabled when no jobs are currently expanded
- [ ] Re-expanding a job restores its default (collapsed) path state; previously expanded paths are reloaded as needed
- [ ] Cached path distribution data may be cleared on collapse; re-expansion will fetch data again if needed

### Requirement 3: Expand All Paths
**User Story**: As a shop floor user, I want to expand all paths within all jobs at once so I can see step-level distribution details across the entire job list without drilling into each path individually.

**Acceptance Criteria**:
- [ ] A toolbar button with a "list-tree" icon and "Expand All Paths" tooltip is visible on the Jobs page
- [ ] Clicking the button expands every path within every expanded job, showing step distribution tables
- [ ] If no jobs are currently expanded, the operation first expands all jobs, then expands all paths
- [ ] Step distribution data is lazy-loaded only for paths not already cached — previously fetched data is reused
- [ ] Concurrent API requests are throttled (max 3 simultaneous) to avoid overwhelming the server
- [ ] Paths that fail to load display gracefully with a "No steps defined" fallback instead of an error
- [ ] The button is disabled when there are no jobs in the list (empty list)

### Requirement 4: Collapse All Paths
**User Story**: As a shop floor user, I want to collapse all expanded paths at once so I can return to the job/path summary level without collapsing the jobs themselves.

**Acceptance Criteria**:
- [ ] A toolbar button with a "list-minus" icon and "Collapse All Paths" tooltip is visible on the Jobs page
- [ ] Clicking the button collapses every expanded path across all expanded jobs, hiding step tables
- [ ] Job-level expansion is not affected — jobs remain expanded showing their path rows
- [ ] Cached step distribution data is preserved — re-expanding a path does not re-fetch
- [ ] The button is disabled when no paths are currently expanded

### Requirement 5: Multi-Path Expansion Support
**User Story**: As a user, I want to expand multiple paths within a single job simultaneously so that expand-all-paths works correctly and I can also manually open several paths at once.

**Acceptance Criteria**:
- [ ] The JobExpandableRow component supports multiple simultaneously expanded paths (not just one at a time)
- [ ] Clicking a path row toggles that individual path without collapsing other expanded paths
- [ ] Each expanded path independently shows its step distribution table with loading state

### Requirement 6: Toolbar Layout and Placement
**User Story**: As a user, I want the expand/collapse controls to be easily accessible but not cluttering the main interface.

**Acceptance Criteria**:
- [ ] The four utility buttons are grouped in a compact horizontal toolbar in the page header, next to the "New Job" button
- [ ] Buttons use ghost variant, neutral color, and xs size to match existing UI patterns
- [ ] Each button has a tooltip describing its action
- [ ] Disabled buttons are visually distinct (reduced opacity) to indicate unavailable actions
- [ ] The toolbar is only visible when there are jobs in the list (hidden during loading and empty states)

### Requirement 7: Rapid Interaction Resilience
**User Story**: As a user clicking quickly through the interface, I want the expand/collapse controls to behave predictably even if I click multiple buttons in rapid succession.

**Acceptance Criteria**:
- [ ] Clicking "Expand All Paths" then immediately "Collapse All Paths" results in all paths collapsed, even if fetches from the expand are still in-flight
- [ ] In-flight fetches from a cancelled expand still populate the cache for future use
- [ ] No visual glitches, duplicate renders, or console errors occur during rapid toggling
