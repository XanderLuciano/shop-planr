# Requirements Document

## Introduction

This document defines the requirements for the Work Queue Filtering & Grouping feature (GitHub Issue #68). The current work queue page (`/queue`) groups work exclusively by operator (assigned user). This feature introduces flexible grouping by user, location, or step name, client-side property filtering with URL-synced state, text search, and saved filter/group presets persisted to localStorage. The default grouping changes from "user" to "location" to reflect the most common shop-floor workflow.

## Glossary

- **Work_Queue_Page**: The `/queue` page that displays active work entries grouped by a chosen dimension
- **WorkQueueFilterBar**: A Vue component that renders group-by selector, filter dropdowns, text search, and preset controls
- **useWorkQueueFilters**: A Vue composable that manages filter/group state, URL synchronization, client-side filtering, and preset CRUD
- **useOperatorWorkQueue**: The existing Vue composable that fetches grouped work queue data from the API
- **GroupByDimension**: One of three grouping dimensions: `user`, `location`, or `step`
- **WorkQueueFilterState**: An object with optional `location`, `stepName`, and `userId` filter fields
- **WorkQueuePreset**: A named, saved configuration of groupBy, filters, and searchQuery persisted to localStorage
- **WorkQueueGroup**: A generalized group containing a groupKey, groupLabel, groupType, and sorted jobs array
- **Filter_Bar**: The UI region containing group-by toggle, filter dropdowns, text search input, and preset controls
- **API_Endpoint**: The `GET /api/operator/work-queue` server route that returns grouped work queue data
- **Preset_Storage**: The localStorage key `wq-filter-presets` where saved presets are serialized as JSON

## Requirements

### Requirement 1: Group-By Dimension Selection

**User Story:** As a shop floor operator, I want to group work queue entries by user, location, or step name, so that I can organize work in the way that best fits my current workflow.

#### Acceptance Criteria

1. THE Work_Queue_Page SHALL provide a group-by selector with three options: `user`, `location`, and `step`
2. WHEN no groupBy value is specified in the URL, THE Work_Queue_Page SHALL default to grouping by `location`
3. WHEN a user selects a different groupBy dimension, THE useWorkQueueFilters composable SHALL update the URL query parameter and trigger an API re-fetch with the new `groupBy` value
4. WHEN the API_Endpoint receives a `groupBy` query parameter with value `user`, `location`, or `step`, THE API_Endpoint SHALL return work entries grouped by the requested dimension
5. IF the API_Endpoint receives an invalid `groupBy` value, THEN THE API_Endpoint SHALL ignore the invalid value and default to `location`

### Requirement 2: Server-Side Grouping

**User Story:** As a shop floor operator, I want the server to return work entries pre-grouped by my chosen dimension, so that the page loads with correctly organized data without client-side re-aggregation.

#### Acceptance Criteria

1. WHEN grouping by `user`, THE API_Endpoint SHALL group entries by the `assignedTo` field and label groups with the operator display name, using "Unassigned" for entries with no assigned user
2. WHEN grouping by `location`, THE API_Endpoint SHALL group entries by the `stepLocation` field, using "No Location" for entries with no location value
3. WHEN grouping by `step`, THE API_Endpoint SHALL group entries by the `stepName` field, using "Unknown Step" for entries with no step name
4. THE API_Endpoint SHALL ensure every work entry appears in exactly one group
5. THE API_Endpoint SHALL compute each group's `totalParts` as the sum of `partCount` across all jobs in that group
6. THE API_Endpoint SHALL exclude empty groups (groups with zero jobs) from the response

### Requirement 3: Priority Ordering Within Groups

**User Story:** As a shop floor operator, I want jobs within each group sorted by priority, so that I can focus on the most important work first.

#### Acceptance Criteria

1. THE API_Endpoint SHALL sort jobs within each group by parent job `priority` in descending order (highest priority first)
2. WHEN two jobs have equal priority, THE API_Endpoint SHALL maintain a stable relative order between them

### Requirement 4: Client-Side Property Filtering

**User Story:** As a shop floor operator, I want to filter work queue entries by location, step name, or assigned user, so that I can narrow down the visible work to what is relevant to me.

#### Acceptance Criteria

1. THE WorkQueueFilterBar SHALL provide filter dropdowns for location, step name, and user, populated from the unfiltered dataset
2. WHEN one or more property filters are active, THE useWorkQueueFilters composable SHALL apply AND logic, showing only jobs that match all active filters
3. WHEN property filters are applied, THE useWorkQueueFilters composable SHALL return a subset of the input groups, preserving original group and job ordering
4. WHEN all property filters result in an empty group (all jobs filtered out), THE useWorkQueueFilters composable SHALL exclude that group from the result
5. WHEN all filters are empty and the search query is empty, THE useWorkQueueFilters composable SHALL return the input groups unchanged

### Requirement 5: Text Search

**User Story:** As a shop floor operator, I want to search work queue entries by keyword, so that I can quickly find specific jobs, steps, or locations.

#### Acceptance Criteria

1. THE WorkQueueFilterBar SHALL provide a text search input field
2. WHEN a search query is entered, THE useWorkQueueFilters composable SHALL match against job name, step name, step location, and group label using case-insensitive substring matching with OR logic across fields
3. WHEN both text search and property filters are active, THE useWorkQueueFilters composable SHALL apply text search AND property filters together (a job must pass both)
4. THE Work_Queue_Page SHALL debounce text search input with a 300ms delay before applying the filter

### Requirement 6: URL State Synchronization

**User Story:** As a shop floor operator, I want my filter and grouping configuration reflected in the URL, so that I can share or bookmark a specific view of the work queue.

#### Acceptance Criteria

1. WHEN the groupBy dimension is not the default (`location`), THE useWorkQueueFilters composable SHALL include a `groupBy` query parameter in the URL
2. WHEN property filters are active, THE useWorkQueueFilters composable SHALL include corresponding query parameters (`filterLocation`, `filterStep`, `filterUser`) in the URL
3. WHEN a search query is active, THE useWorkQueueFilters composable SHALL include a `q` query parameter in the URL
4. WHEN the Work_Queue_Page loads with filter-related query parameters in the URL, THE useWorkQueueFilters composable SHALL restore the filter state from those parameters
5. THE useWorkQueueFilters composable SHALL preserve non-filter query parameters (e.g., `operator`) when updating the URL
6. WHEN serializing filter state to URL query parameters and deserializing back, THE useWorkQueueFilters composable SHALL produce the original filter state (round-trip)

### Requirement 7: Saved Filter Presets

**User Story:** As a shop floor operator, I want to save named filter/group configurations as presets, so that I can quickly switch between frequently used views without reconfiguring filters each time.

#### Acceptance Criteria

1. THE WorkQueueFilterBar SHALL provide controls to save the current filter configuration as a named preset
2. THE WorkQueueFilterBar SHALL provide a dropdown to load and delete saved presets
3. WHEN a user saves a preset, THE useWorkQueueFilters composable SHALL persist the preset (including groupBy, filters, and searchQuery) to Preset_Storage
4. WHEN a user loads a preset, THE useWorkQueueFilters composable SHALL restore the exact groupBy, filters, and searchQuery values from the preset and update the URL accordingly
5. THE useWorkQueueFilters composable SHALL enforce a maximum of 20 saved presets; WHEN a 21st preset is saved, THE useWorkQueueFilters composable SHALL evict the oldest preset
6. THE useWorkQueueFilters composable SHALL validate that preset names are non-empty and do not exceed 50 characters
7. WHEN a user deletes a preset that is currently active, THE useWorkQueueFilters composable SHALL clear the active preset indicator without changing the current filter state

### Requirement 8: Available Filter Values

**User Story:** As a shop floor operator, I want filter dropdowns populated with values from the current dataset, so that I only see filter options that are relevant to the active work queue.

#### Acceptance Criteria

1. THE useWorkQueueFilters composable SHALL extract available locations, step names, and user IDs from the unfiltered (pre-filter) dataset
2. THE useWorkQueueFilters composable SHALL return unique, sorted values for each filter dimension
3. THE useWorkQueueFilters composable SHALL exclude empty or undefined values from the available filter options

### Requirement 9: Empty and Error States

**User Story:** As a shop floor operator, I want clear feedback when filters produce no results or when errors occur, so that I understand the current state and can take corrective action.

#### Acceptance Criteria

1. WHEN active filters result in zero visible groups, THE Work_Queue_Page SHALL display a "No results matching filters" empty state with a "Clear filters" button
2. WHEN the API fetch fails, THE Work_Queue_Page SHALL display an error message with a retry button and preserve the current filter and groupBy state across the retry
3. IF Preset_Storage contains invalid JSON or an unexpected data shape, THEN THE useWorkQueueFilters composable SHALL silently reset presets to an empty array

### Requirement 10: Backward Compatibility

**User Story:** As a shop floor operator, I want the existing work queue behavior preserved when no new parameters are used, so that my current workflow is not disrupted.

#### Acceptance Criteria

1. WHEN the API_Endpoint is called without a `groupBy` parameter, THE API_Endpoint SHALL return data grouped by `location` (the new default)
2. THE Work_Queue_Page SHALL preserve the existing operator selector and its URL-synced `operator` query parameter
3. THE useWorkQueueFilters composable SHALL preserve the existing text search behavior (matching jobName, stepName, pathName, and operator name) as a subset of the new filtering system
