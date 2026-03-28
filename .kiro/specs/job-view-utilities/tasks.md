# Implementation Plan: Job View Utilities

## Overview

Add four expand/collapse utility buttons to the Jobs list page. Implementation modifies `JobExpandableRow` to support multi-path expansion (Set-based), creates a new `JobViewToolbar` component, and wires everything together in `jobs/index.vue`. No backend changes — purely frontend UI state management.

## Tasks

- [x] 1. Upgrade JobExpandableRow to multi-path expansion
  - [x] 1.1 Convert `expandedPathId` (string | null) to `expandedPathIds` (Set\<string\>) in `app/components/JobExpandableRow.vue`
    - Replace `expandedPathId = ref<string | null>(null)` with `expandedPathIds = ref<Set<string>>(new Set())`
    - Update `togglePath()` to add/remove from the Set instead of toggling a single string
    - Update all template references from `expandedPathId === path.id` to `expandedPathIds.has(path.id)`
    - Update chevron icon binding to use `expandedPathIds.has(path.id)`
    - Fetch path data on expand if not cached (existing behavior preserved)
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 1.2 Add bulk expand/collapse signal props and emit to JobExpandableRow
    - Add props: `expandAllPathsSignal: number` (default 0), `collapseAllPathsSignal: number` (default 0)
    - Add emit: `paths-expanded-change` with payload `{ jobId: string, hasExpandedPaths: boolean }`
    - Watch `expandAllPathsSignal` — on increment, set `expandedPathIds` to all path IDs and lazy-fetch uncached distributions with throttled concurrency (max 3 simultaneous)
    - Watch `collapseAllPathsSignal` — on increment, clear `expandedPathIds` to empty Set
    - Emit `paths-expanded-change` whenever `expandedPathIds` changes (including from togglePath)
    - Failed fetches during bulk expand set empty array in `pathDistributions` (graceful degradation)
    - _Requirements: 3.2, 3.4, 3.5, 3.6, 4.2, 4.3, 4.4, 5.1, 7.1, 7.2_

  - [x] 1.3 Write property test: cache preservation on collapse (PBT-JV1)
    - **Property PBT-JV1: For any subset of path IDs, after expand-all followed by collapse-all, expandedPathIds is empty and pathDistributions cache is unchanged**
    - **Validates: Requirements 2.4, 2.5, 4.3, 4.4**

  - [x] 1.4 Write property test: bulk expand populates all distributions (PBT-JV3)
    - **Property PBT-JV3: For any list of paths with arbitrary fetch success/failure, after bulk expand, every path ID has an entry in pathDistributions (either real data or empty array)**
    - **Validates: Requirements 3.4, 3.6**

- [x] 2. Create JobViewToolbar component
  - [x] 2.1 Create `app/components/JobViewToolbar.vue` with four icon buttons
    - Props: `hasExpandedJobs: boolean`, `hasExpandedPaths: boolean`, `jobCount: number`
    - Emits: `expand-all-jobs`, `collapse-all-jobs`, `expand-all-paths`, `collapse-all-paths`
    - Render four `UButton` (ghost variant, neutral color, xs size) wrapped in `UTooltip`
    - Icons: `i-lucide-chevrons-down`, `i-lucide-chevrons-up`, `i-lucide-list-tree`, `i-lucide-list-minus`
    - Tooltips: "Expand All Jobs", "Collapse All Jobs", "Expand All Paths", "Collapse All Paths"
    - Disable logic: Expand All Jobs disabled when `jobCount === 0`; Collapse All Jobs disabled when `!hasExpandedJobs`; Expand All Paths disabled when `!hasExpandedJobs`; Collapse All Paths disabled when `!hasExpandedPaths`
    - _Requirements: 1.1, 1.3, 2.1, 2.3, 3.1, 3.7, 4.1, 4.5, 6.1, 6.2, 6.3, 6.4_

  - [x] 2.2 Write unit tests for JobViewToolbar disabled states and emits
    - Test each button's disabled state based on prop combinations
    - Test that clicking each button emits the correct event
    - Test tooltips render with correct text
    - _Requirements: 1.3, 2.3, 3.7, 4.5, 6.2, 6.3, 6.4_

- [x] 3. Wire toolbar and signals into jobs/index.vue
  - [x] 3.1 Add orchestration state and handlers to `app/pages/jobs/index.vue`
    - Add `expandAllPathsSignal` and `collapseAllPathsSignal` refs (number, default 0)
    - Add `jobsWithExpandedPaths` ref (Set\<string\>)
    - Implement `expandAllJobs()`: set `expanded = true`
    - Implement `collapseAllJobs()`: set `expanded = {}`
    - Implement `expandAllPaths()`: ensure `expanded = true` first, then increment `expandAllPathsSignal`
    - Implement `collapseAllPaths()`: increment `collapseAllPathsSignal`
    - Implement `onPathsExpandedChange()` handler to maintain `jobsWithExpandedPaths` set
    - Compute `hasExpandedJobs` from `expanded` ref (true when `expanded === true` or has keys)
    - _Requirements: 1.2, 1.4, 2.2, 3.2, 3.3, 4.2, 7.1, 7.2, 7.3_

  - [x] 3.2 Update template in `app/pages/jobs/index.vue`
    - Add `JobViewToolbar` in the header row, between the title and "New Job" button
    - Pass computed `hasExpandedJobs`, `hasExpandedPaths`, and `filteredJobs.length` as props
    - Wire toolbar emits to handler functions
    - Pass `expandAllPathsSignal` and `collapseAllPathsSignal` props to `JobExpandableRow` in the `#expanded` slot
    - Wire `@paths-expanded-change` emit from `JobExpandableRow` to `onPathsExpandedChange`
    - Hide toolbar during loading and empty states (only visible when jobs exist)
    - _Requirements: 6.1, 6.5_

  - [x] 3.3 Write property test: ExpandedState validity (PBT-JV2)
    - **Property PBT-JV2: For any sequence of expand/collapse operations on jobs, expanded state is always either `true` or a plain object (valid ExpandedState)**
    - **Validates: Requirements 1.2, 1.4, 2.2**

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Integration verification
  - [x] 5.1 Write integration tests for full expand/collapse flow
    - Test expand-all-jobs renders all JobExpandableRow instances
    - Test collapse-all-jobs removes all JobExpandableRow instances
    - Test expand-all-paths triggers fetches only for uncached paths
    - Test collapse-all-paths leaves jobs expanded but paths collapsed
    - Test toolbar disabled states update reactively after operations
    - Test rapid expand-then-collapse sequence results in collapsed state with cache populated
    - _Requirements: 1.2, 2.2, 3.2, 3.4, 4.2, 4.3, 7.1, 7.2, 7.3_

- [x] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirement acceptance criteria for traceability
- Property tests use fast-check and validate correctness properties from the design document
- No backend changes needed — all work is frontend UI state management
- The design uses signal-based communication (increment counters) for parent→child bulk operations
