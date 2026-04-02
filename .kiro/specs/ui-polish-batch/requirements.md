# Requirements Document

## Introduction

A batch of UI polish items covering two bug fixes and three small feature enhancements across the Step View, Parts View, and Part Browser Detail pages. These changes improve reactivity after destructive actions, add missing navigation affordances, and provide better visual feedback for step distribution state.

## Glossary

- **Step_View**: The page at `/parts/step/[stepId]` that shows parts at a specific process step and provides advancement/creation controls.
- **Parts_View**: The page at `/parts` that lists all active parts grouped by job, with each row representing a process step that has parts.
- **Part_Browser_Detail**: The page at `/parts-browser/[id]` that shows full detail for a single part including routing, certificates, notes, and sibling parts.
- **ProcessAdvancementPanel**: The component rendered inside Step_View (and Part_Browser_Detail) that lists parts with checkboxes and provides Advance, Scrap, and Force Complete actions.
- **ScrapDialog**: The modal component that collects a scrap reason and calls the scrap API endpoint.
- **WorkQueueList**: The component rendered inside Parts_View that groups work-queue jobs by job name and renders clickable step rows.
- **StepDistribution**: A computed view type containing `stepId`, `stepName`, `partCount`, `completedCount`, and `isBottleneck` for each step in a path.
- **Part**: A tracked unit moving through process steps; has `id`, `currentStepId`, `status`, and routing history.
- **ProcessStep**: An ordered step in a path; has `id`, `name`, `order`, `optional`, and `dependencyType`.
- **PartStepStatus**: A routing history entry for a part at a step; has `status` values including `skipped`.

## Requirements

### Requirement 1: Immediate Part Removal After Scrap (GitHub #77)

**User Story:** As an operator, I want a scrapped part to disappear from the step's part list immediately, so that I do not have to refresh the page to see the updated list.

#### Acceptance Criteria

1. WHEN the ScrapDialog emits a `scrapped` event, THE ProcessAdvancementPanel SHALL remove the scrapped part from the displayed part list without requiring a page reload.
2. WHEN the ScrapDialog emits a `scrapped` event, THE Step_View SHALL re-fetch the step data from the server to synchronize the part list and part count.
3. WHEN a part is scrapped from the ProcessAdvancementPanel, THE ProcessAdvancementPanel SHALL deselect the scrapped part from the selected-parts set.
4. WHEN a part is scrapped and the step has zero remaining parts, THE Step_View SHALL display the "waiting for previous step" empty state.

### Requirement 2: Skip Optional Steps (GitHub #81)

**User Story:** As an operator, I want to skip an optional step that a part is currently at, so that I can move the part forward without performing unnecessary work.

#### Acceptance Criteria

1. WHILE a part is at a ProcessStep where `optional` is true, THE Step_View SHALL display a "Skip" button alongside the Advance button.
2. WHEN the operator clicks the "Skip" button, THE Step_View SHALL call the advance-to-step API with the next step as the target, causing the current optional step to be classified as `skipped` in the part's routing history.
3. WHEN the operator clicks the "Skip" button and no operator is selected, THE Step_View SHALL display a validation message requiring operator selection before proceeding.
4. WHEN a step is skipped, THE Part_Browser_Detail routing view SHALL display the step status as "Skipped" with a neutral-colored badge.
5. THE Step_View SHALL only display the "Skip" button for steps where the ProcessStep `optional` flag is true.
6. WHEN the skip action completes, THE Step_View SHALL re-fetch step data to reflect the updated part list.

### Requirement 3: Highlight Steps With Parts (GitHub #78)

**User Story:** As a production manager, I want process steps that have parts at them to be visually highlighted in the step distribution view on the Job Detail page, so that I can see at a glance which steps have hardware in progress.

#### Acceptance Criteria

1. WHILE a step in the Job_Detail step distribution (StepTracker component) has `partCount > 0` and `isBottleneck` is false, THE StepTracker SHALL render that step with a blue/highlighted border and background style.
2. WHILE a step has `isBottleneck` set to true, THE StepTracker SHALL continue to render the existing amber bottleneck styling without applying the blue highlight.
3. WHILE a step has `partCount` equal to zero, THE StepTracker SHALL render that step with the default non-highlighted background.
4. THE StepTracker SHALL apply the blue highlight based solely on the `partCount` field from StepDistribution.

### Requirement 4: Eye Icon for Part Detail Navigation (GitHub #80)

**User Story:** As an operator, I want an eye icon next to each part ID on the step page, so that I can quickly navigate to the full detail page for any individual part.

#### Acceptance Criteria

1. THE ProcessAdvancementPanel SHALL display a clickable eye icon (lucide `eye` icon) next to each part ID in the part list.
2. WHEN the operator clicks the eye icon for a part, THE ProcessAdvancementPanel SHALL navigate to `/parts-browser/{partId}`.
3. THE eye icon SHALL be visually distinct from the existing Scrap and Force Complete action icons.
4. THE eye icon click SHALL NOT trigger the part's checkbox toggle or any other action.

### Requirement 5: Sibling Parts Tab URL Hash

**User Story:** As a user, I want the sibling parts tab on the part detail page to use a URL hash, so that I can link directly to it and use browser back/forward navigation between tabs.

#### Acceptance Criteria

1. WHEN the user clicks the "Siblings" tab on Part_Browser_Detail, THE Part_Browser_Detail SHALL update the URL hash to `#parts`.
2. WHEN the user clicks the "Routing" tab on Part_Browser_Detail, THE Part_Browser_Detail SHALL update the URL hash to `#routing` or remove the hash.
3. WHEN Part_Browser_Detail loads with `#parts` in the URL, THE Part_Browser_Detail SHALL activate the Siblings tab and trigger sibling data loading.
4. WHEN Part_Browser_Detail loads with no hash or `#routing` in the URL, THE Part_Browser_Detail SHALL activate the Routing tab.
5. WHEN the user navigates using browser back/forward buttons between tab states, THE Part_Browser_Detail SHALL switch to the corresponding tab without a full page reload.

### Requirement 6: Force Complete Icon Color Change

**User Story:** As an operator, I want the Force Complete icon on the step page to be green instead of amber, so that it is visually distinct from warning-colored actions and clearly represents a completion action.

#### Acceptance Criteria

1. THE Force Complete button icon in the ProcessAdvancementPanel part list SHALL use a green color (`success` or equivalent) instead of the current amber/warning color.
2. THE Force Complete button SHALL retain its existing icon (`i-lucide-shield-check`) and tooltip/label.
