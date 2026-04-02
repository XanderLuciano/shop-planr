# Implementation Plan: UI Polish Batch

## Overview

Six frontend polish items: scrap reactivity fix, skip optional steps, step highlight in StepTracker, eye icon navigation, sibling tab URL hash routing, and force complete icon color change. All changes are frontend-only except the skip feature which extends the step view API endpoint and calls the existing `advanceToStep` API.

## Tasks

- [x] 1. Create pure utility functions and property tests
  - [x] 1.1 Create `app/utils/scrapPartFromList.ts` with `removePartFromList` and `removePartFromSelection` functions
    - `removePartFromList(partIds: string[], scrappedId: string): string[]` filters out the scrapped ID
    - `removePartFromSelection(selected: Set<string>, scrappedId: string): Set<string>` deletes the scrapped ID from the set
    - _Requirements: 1.1, 1.3_

  - [x] 1.2 Create `app/utils/stepHighlight.ts` with `shouldHighlightStep` function
    - `shouldHighlightStep(partCount: number, isBottleneck: boolean): boolean` returns `partCount > 0 && !isBottleneck`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.3 Create `app/utils/tabHash.ts` with `tabToHash` and `hashToTab` functions
    - `tabToHash(tab: string): string` maps `'siblings'` → `'#parts'`, else `'#routing'`
    - `hashToTab(hash: string): string` maps `'#parts'` → `'siblings'`, else `'routing'`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 1.4 Create `app/utils/eyeIconLink.ts` with `partDetailLink` function
    - `partDetailLink(partId: string): string` returns `/parts-browser/${encodeURIComponent(partId)}`
    - _Requirements: 4.1, 4.2_

  - [x] 1.5 Write property test: Scrap removes part from list and deselects
    - **Property 1: Scrap removes part from list and deselects**
    - Generate random part ID arrays and random selected subsets, pick a random member to scrap, verify removal from both collections
    - Test file: `tests/properties/uiPolishBatch.property.test.ts`
    - **Validates: Requirements 1.1, 1.3**

  - [x] 1.6 Write property test: Skip button visibility equals stepOptional flag
    - **Property 2: Skip button visibility equals stepOptional flag**
    - Generate random boolean for `stepOptional`, verify visibility matches
    - **Validates: Requirements 2.1, 2.5**

  - [x] 1.7 Write property test: Step highlight classification
    - **Property 3: Step highlight classification**
    - Generate random `StepDistribution` objects (varying `partCount`, `isBottleneck`), verify highlight class applied correctly
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 1.8 Write property test: Eye icon link target correctness
    - **Property 4: Eye icon link target correctness**
    - Generate random part ID strings, verify link resolves to `/parts-browser/${partId}`
    - **Validates: Requirements 4.1, 4.2**

  - [x] 1.9 Write property test: Tab-hash round trip
    - **Property 5: Tab-hash round trip**
    - Generate random tab values, verify round-trip through hash conversion and back
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [x] 2. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement scrap reactivity (Item 1)
  - [x] 3.1 Update `ProcessAdvancementPanel.vue` to handle scrap event and emit upward
    - Listen for `@scrapped` event on `ScrapDialog`
    - On scrapped: remove the part from `job.partIds` (create a local reactive copy of partIds), deselect from `selectedParts`
    - Add new emit `scrapped: []` and emit it upward after local removal
    - _Requirements: 1.1, 1.3_

  - [x] 3.2 Update Step View `[stepId].vue` to re-fetch on scrap
    - Listen for `@scrapped` on `ProcessAdvancementPanel`
    - On scrapped: call `fetchStep()` to re-sync from server
    - The existing zero-parts empty state logic already handles Requirement 1.4
    - _Requirements: 1.2, 1.4_

- [x] 4. Implement skip optional steps (Item 2)
  - [x] 4.1 Extend `WorkQueueJob` type and API endpoint
    - Add `stepOptional?: boolean` field to `WorkQueueJob` in `server/types/computed.ts`
    - Populate it in `server/api/operator/step/[stepId].get.ts` from `step.optional`
    - _Requirements: 2.1, 2.5_

  - [x] 4.2 Add Skip button and handler to Step View `[stepId].vue`
    - Add a "Skip" button next to the Advance button, visible only when `job.stepOptional === true`
    - Skip handler: calls `useLifecycle().advanceToStep(partId, { targetStepId: job.nextStepId, userId: operatorId })` for each selected part
    - Validate operator is selected before skip (same pattern as advance); show validation message if not
    - Do not show Skip button if `job.isFinalStep` (no target step)
    - After skip completes: call `fetchStep()` to refresh
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [x] 4.3 Write unit test for skip validation
    - Verify skip handler rejects when no operator selected
    - Verify skip calls `advanceToStep` with correct `targetStepId`
    - _Requirements: 2.2, 2.3_

- [x] 5. Implement step highlight in StepTracker (Item 3)
  - [x] 5.1 Update `stepBorderClass` in `StepTracker.vue`
    - Import and use `shouldHighlightStep` from `app/utils/stepHighlight.ts`
    - Add blue highlight case: after bottleneck check, if `shouldHighlightStep(step.partCount, step.isBottleneck)` → return `'border-blue-400 bg-blue-50 dark:bg-blue-950/30'`
    - Bottleneck amber styling takes precedence (checked first), then blue highlight, then optional dashed, then default
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Implement eye icon for part detail navigation (Item 4)
  - [x] 6.1 Add eye icon link in `ProcessAdvancementPanel.vue`
    - Import and use `partDetailLink` from `app/utils/eyeIconLink.ts`
    - Add a `NuxtLink` with `i-lucide-eye` icon next to each part ID in the part list
    - Use `@click.stop` to prevent checkbox toggle
    - Style as a ghost button with `neutral` color, visually distinct from red Scrap and green Force Complete icons
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 7. Implement sibling parts tab URL hash (Item 5)
  - [x] 7.1 Update Part Browser Detail `[id].vue` to use hash-based tab state
    - Import and use `tabToHash` and `hashToTab` from `app/utils/tabHash.ts`
    - Replace `const activeTab = ref('routing')` with a computed that reads from `useRoute().hash` via `hashToTab`
    - Tab click: `useRouter().replace({ hash: tabToHash(tab) })`
    - On mount: derive initial tab from `route.hash` (default to routing)
    - Watch `route.hash` for browser back/forward navigation
    - Trigger sibling data loading when hash changes to `#parts`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 8. Implement force complete icon color change (Item 6)
  - [x] 8.1 Change Force Complete button color in `ProcessAdvancementPanel.vue`
    - Change the Force Complete `UButton` `color` prop from `warning` to `success`
    - No icon or label changes — just the color
    - _Requirements: 6.1, 6.2_

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Pure utility functions are extracted so property tests can validate logic without DOM rendering
- Property tests use `fast-check` with minimum 100 iterations per the project convention
- Test file: `tests/properties/uiPolishBatch.property.test.ts`
