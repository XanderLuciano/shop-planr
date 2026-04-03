# Implementation Plan: Work Queue Filtering & Grouping

## Overview

Extend the work queue page (`/queue`) with flexible grouping (user/location/step), client-side property filtering, text search, URL-synced state, and saved presets. The server-side API is extended with a `groupBy` query parameter; client-side filtering is handled by a new `useWorkQueueFilters` composable and `WorkQueueFilterBar.vue` component. Default grouping changes from "user" to "location".

## Tasks

- [x] 1. Define shared types and pure utility functions
  - [x] 1.1 Add `GroupByDimension`, `WorkQueueFilterState`, `WorkQueuePreset`, and `WorkQueueGroup` types to `server/types/computed.ts` and re-export from `app/types/computed.ts`
    - `GroupByDimension = 'user' | 'location' | 'step'`
    - `WorkQueueFilterState` with optional `location`, `stepName`, `userId`
    - `WorkQueuePreset` with `id`, `name`, `groupBy`, `filters`, `searchQuery`, `createdAt`
    - `WorkQueueGroup` with `groupKey`, `groupLabel`, `groupType`, `jobs`, `totalParts`
    - Keep existing `OperatorGroup` and `WorkQueueGroupedResponse` for backward compatibility
    - _Requirements: 1.1, 1.4, 2.1–2.6, 7.3_

  - [x] 1.2 Implement `groupEntriesByDimension()` pure function in a new `server/utils/workQueueGrouping.ts`
    - Takes entries array, dimension, and userNameMap
    - Groups by the requested dimension key (`assignedTo`, `stepLocation`, `stepName`)
    - Labels null keys as "Unassigned" / "No Location" / "Unknown Step"
    - Sorts jobs within each group by `jobPriority` descending
    - Computes `totalParts` per group
    - Excludes empty groups
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2_

  - [x] 1.3 Implement `applyFilters()` and `extractAvailableValues()` pure functions in a new `app/utils/workQueueFilters.ts`
    - `applyFilters(groups, filters, searchQuery)`: AND logic for property filters, OR across fields for text search, excludes empty groups, preserves ordering
    - `extractAvailableValues(groups)`: returns unique sorted locations, stepNames, userIds from all jobs across all groups
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 5.2, 5.3, 8.1, 8.2, 8.3_

  - [x] 1.4 Write unit tests for `groupEntriesByDimension()`
    - Test each dimension (user, location, step) with known inputs
    - Test null/missing key handling and label generation
    - Test priority sorting within groups
    - Test empty entries array
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1_

  - [x] 1.5 Write unit tests for `applyFilters()` and `extractAvailableValues()`
    - Test AND logic for property filters
    - Test text search OR across fields
    - Test empty filter identity
    - Test empty group exclusion
    - Test deduplication and sorting of available values
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 5.2, 8.1, 8.2, 8.3_

- [x] 2. Property-based tests for pure functions
  - [x] 2.1 Write property test for grouping completeness (CP-WQF-1)
    - **Property 1: Grouping Completeness (CP-WQF-1)**
    - For any set of entries and any valid groupBy dimension, every entry appears in exactly one group, sum of totalParts equals input total, no empty groups
    - **Validates: Requirements 2.4, 2.5, 2.6**

  - [x] 2.2 Write property test for filter subset (CP-WQF-2)
    - **Property 2: Filter Subset (CP-WQF-2)**
    - For any groups and any filter combination, every job in filtered output exists in input, no duplicates, ordering preserved
    - **Validates: Requirements 4.2, 4.3, 4.4**

  - [x] 2.3 Write property test for empty filter identity (CP-WQF-3)
    - **Property 3: Empty Filter Identity (CP-WQF-3)**
    - When all filters empty and search empty, applyFilters returns input unchanged
    - **Validates: Requirement 4.5**

  - [x] 2.4 Write property test for filter monotonicity (CP-WQF-4)
    - **Property 4: Filter Monotonicity (CP-WQF-4)**
    - Adding an additional filter can only narrow or maintain the result set
    - **Validates: Requirements 4.2, 5.3**

  - [x] 2.5 Write property test for group-by dimension consistency (CP-WQF-6)
    - **Property 6: Group-By Dimension Consistency (CP-WQF-6)**
    - Every group in the response has groupType matching the requested dimension
    - **Validates: Requirement 1.4**

  - [x] 2.6 Write property test for priority ordering (CP-WQF-10)
    - **Property 10: Priority Ordering (CP-WQF-10)**
    - Jobs within each group are sorted by jobPriority descending
    - **Validates: Requirement 3.1**

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Extend server-side API with groupBy parameter
  - [x] 4.1 Add `jobPriority` field to `WorkQueueJob` type in `server/types/computed.ts` and populate it in the API route entry-building loop from `job.priority`
    - _Requirements: 3.1_

  - [x] 4.2 Refactor `server/api/operator/work-queue.get.ts` to accept `groupBy` query parameter
    - Read `groupBy` from query, validate against `['user', 'location', 'step']`, default to `'location'`
    - Replace inline grouping logic with call to `groupEntriesByDimension()`
    - Also pass `stepLocation` in entries for location-based grouping
    - Return response using `WorkQueueGroup[]` structure (keep backward-compatible `OperatorGroup` shape for `groupBy=user`)
    - _Requirements: 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 10.1_

  - [x] 4.3 Write unit tests for the refactored API grouping logic
    - Test each groupBy dimension returns correct group structure
    - Test invalid groupBy defaults to location
    - Test backward compatibility when no groupBy param
    - _Requirements: 1.4, 1.5, 10.1_

- [ ] 5. Implement `useWorkQueueFilters` composable
  - [x] 5.1 Create `app/composables/useWorkQueueFilters.ts`
    - Reactive state: `groupBy` (default 'location'), `filters`, `searchQuery`, `presets`, `activePresetId`
    - Computed: `filteredGroups` (calls `applyFilters`), `activeFilterCount`, `availableLocations`, `availableSteps` (calls `extractAvailableValues`)
    - Actions: `setGroupBy()` (triggers API re-fetch), `setFilter()`, `clearFilters()`
    - Calls `useOperatorWorkQueue().fetchGroupedWork()` with groupBy param on dimension change
    - _Requirements: 1.2, 1.3, 4.1, 4.2, 4.3, 4.4, 4.5, 5.2, 5.3, 8.1, 8.2, 8.3_

  - [x] 5.2 Add URL synchronization to `useWorkQueueFilters`
    - `syncToUrl()`: serialize groupBy (omit default 'location'), filterLocation, filterStep, filterUser, q to URL query params; preserve non-filter params (e.g. `operator`)
    - `syncFromUrl()`: deserialize URL query params to restore filter state on page load
    - Call `syncToUrl()` on every state change; call `syncFromUrl()` on mount
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 5.3 Add preset management to `useWorkQueueFilters`
    - `savePreset(name)`: validate name (non-empty, ≤50 chars), create preset with `crypto.randomUUID()`, persist to localStorage key `wq-filter-presets`, cap at 20 (evict oldest)
    - `loadPreset(presetId)`: restore groupBy, filters, searchQuery from preset, update URL, trigger re-fetch if groupBy changed
    - `deletePreset(presetId)`: remove from localStorage, clear activePresetId if deleted preset was active
    - Handle corrupt localStorage gracefully (reset to empty array)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 9.3_

  - [x] 5.4 Write property test for URL state round-trip (CP-WQF-5)
    - **Property 5: URL State Round-Trip (CP-WQF-5)**
    - Serializing filter state to URL params and deserializing back produces original state
    - **Validates: Requirement 6.6**

  - [x] 5.5 Write property test for search backward compatibility (CP-WQF-7)
    - **Property 7: Search Backward Compatibility (CP-WQF-7)**
    - Any text search matching a job via existing fields (jobName, stepName) also matches in the new system
    - **Validates: Requirement 10.3**

  - [x] 5.6 Write property test for preset round-trip (CP-WQF-8)
    - **Property 8: Preset Round-Trip (CP-WQF-8)**
    - Saving filter state as preset and loading it restores exact same values
    - **Validates: Requirements 7.3, 7.4**

  - [x] 5.7 Write property test for preset capacity (CP-WQF-9)
    - **Property 9: Preset Capacity (CP-WQF-9)**
    - Presets array length never exceeds 20; 21st save evicts oldest
    - **Validates: Requirement 7.5**

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Build `WorkQueueFilterBar.vue` component
  - [x] 7.1 Create `app/components/WorkQueueFilterBar.vue`
    - Props: `groupBy`, `filters`, `availableLocations`, `availableSteps`, `availableUsers`, `presets`, `activePresetId`
    - Emits: `update:groupBy`, `update:filters`, `clear`, `savePreset`, `loadPreset`, `deletePreset`
    - Render group-by toggle (USelect or segmented control) with user/location/step options
    - Render filter dropdowns for location, step name, user (populated from available values)
    - Render text search input (UInput with search icon)
    - Render active filter count badge
    - Render preset dropdown with save/load/delete actions
    - Render "Clear filters" button when filters are active
    - _Requirements: 1.1, 4.1, 5.1, 7.1, 7.2_

  - [x] 7.2 Write unit tests for `WorkQueueFilterBar.vue`
    - Test emit correctness on group-by change
    - Test emit correctness on filter selection
    - Test preset dropdown rendering and actions
    - Test clear button visibility and emit
    - _Requirements: 1.1, 4.1, 7.1, 7.2_

- [x] 8. Integrate into queue.vue page
  - [x] 8.1 Refactor `app/pages/queue.vue` to use `useWorkQueueFilters` and `WorkQueueFilterBar`
    - Replace inline search input with `WorkQueueFilterBar` component
    - Replace `useOperatorWorkQueue` direct usage with `useWorkQueueFilters` (which wraps it)
    - Wire all filter bar events to composable actions
    - Update `sortedGroups` computed to work with `WorkQueueGroup[]` instead of `OperatorGroup[]`
    - Update group rendering template to use `groupKey`/`groupLabel`/`groupType` instead of `operatorId`/`operatorName`
    - Preserve existing operator selector and its URL-synced `operator` query parameter
    - Update summary bar text to reflect dynamic group type (not hardcoded "operators")
    - _Requirements: 1.1, 1.2, 1.3, 10.2_

  - [x] 8.2 Add empty/error state handling for filtered results
    - Show "No results matching filters" with "Clear filters" button when filters produce zero groups
    - Preserve filter and groupBy state across API retry on error
    - Debounce text search with 300ms delay (existing behavior preserved)
    - _Requirements: 5.4, 9.1, 9.2_

  - [x] 8.3 Wire URL sync: restore filter state from URL on page mount, sync on every change
    - Call `syncFromUrl()` on mount (after operator identity init)
    - URL param `groupBy` takes precedence; if absent, default to 'location'
    - Ensure `operator` param coexists with filter params
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (CP-WQF-1 through CP-WQF-10)
- Unit tests validate specific examples and edge cases
- The implementation language is TypeScript throughout (Nuxt 4 / Vue 3 stack)
- Pure functions (`groupEntriesByDimension`, `applyFilters`, `extractAvailableValues`) are implemented first to enable early testing
- The existing `OperatorGroup` type and backward-compatible API behavior are preserved
