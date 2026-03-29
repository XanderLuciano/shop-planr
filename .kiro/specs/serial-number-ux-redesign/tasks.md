# Implementation Plan: Serial Number UX Redesign

## Overview

Reorganize the serial detail page's Routing tab into four section cards (Routing, Certificates, Notes, Advance Process) using a new reusable `SectionCard` wrapper component. Add a `hideHeading` prop to `PartDetailNotes`. All changes are purely presentational — no business logic, API, or data model changes. Tech stack: Vue 3 / TypeScript / Nuxt UI 4.

## Tasks

- [x] 1. Create the `SectionCard` component
  - [x] 1.1 Create `app/components/SectionCard.vue`
    - Accept props: `title: string`, `icon: string`
    - Render a `UCard` with `variant="outline"` and a `#header` slot containing a flex row with `UIcon` + title span
    - Provide a default `<slot />` for body content
    - Use `ui` prop to set consistent header/body padding: `{ header: 'px-4 py-3 sm:px-4', body: 'p-4 sm:p-4' }`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]\* 1.2 Write unit tests for `SectionCard`
    - Test that the component renders the provided icon and title in the header
    - Test that default slot content is rendered in the card body
    - Test each section header icon: `i-lucide-route`, `i-lucide-file-badge`, `i-lucide-message-square`, `i-lucide-arrow-right-circle`
    - Test file: `tests/unit/components/SectionCard.test.ts`
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 2. Add `hideHeading` prop to `PartDetailNotes`
  - [x] 2.1 Modify `app/components/PartDetailNotes.vue`
    - Add optional `hideHeading?: boolean` prop (default `false`)
    - Wrap the existing `<h4>` heading in a `v-if="!hideHeading"` guard
    - No other changes to the component's behavior, data fetching, or template
    - _Requirements: 4.1, 4.3_

  - [ ]\* 2.2 Write unit tests for `PartDetailNotes` hideHeading behavior
    - Test that heading is visible when `hideHeading` is `false` or omitted
    - Test that heading is hidden when `hideHeading` is `true`
    - Test file: `tests/unit/components/SectionCard.test.ts` (append to same file)
    - _Requirements: 4.3_

- [x] 3. Checkpoint — Ensure new component and prop compile, unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Restructure the Routing tab in `serials/[id].vue`
  - [x] 4.1 Wrap routing content in a `SectionCard` with icon `i-lucide-route` and title "Routing"
    - Move the step list, completed-state banner, step overrides, and `DeferredStepsList` inside this card
    - Keep the step overrides conditional on `overriddenSteps.length`
    - Keep the `DeferredStepsList` conditional on `deferredSteps.length`
    - Keep the completed-state banner inside the routing card
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 4.2 Wrap certificate content in a `SectionCard` with icon `i-lucide-file-badge` and title "Certificates"
    - Move `CertAttachButton` (guarded by `v-if="isInProgress && currentStep"`) inside this card
    - Move the attached certificates list inside this card
    - Add empty-state message "No certificates attached" when `!certAttachments.length && !isInProgress`
    - Remove the standalone `<h4>` headings that previously labeled these sections
    - _Requirements: 1.1, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 4.3 Wrap notes content in a `SectionCard` with icon `i-lucide-message-square` and title "Notes"
    - Render `<PartDetailNotes :serial-id="serialId" hide-heading />` inside this card
    - _Requirements: 1.1, 4.1, 4.2, 4.3_

  - [x] 4.4 Wrap advancement content in a `SectionCard` with icon `i-lucide-arrow-right-circle` and title "Advance Process"
    - Guard the entire card with `v-if="isInProgress && workQueueJob"`
    - Move `ProcessAdvancementPanel` inside this card, removing the old wrapper `div` with its border/padding
    - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.2, 5.3_

  - [x] 4.5 Ensure status banners remain above section cards
    - Verify the scrap banner, force-complete banner, and completed-state indicators remain between the tab bar and the first `SectionCard`, outside any card boundary
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 4.6 Verify no functional regression
    - Confirm all existing click handlers, navigation, event emissions, and data fetching remain unchanged
    - Confirm the Serials tab is untouched
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 5. Checkpoint — Ensure page renders correctly and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Write property-based tests for section rendering invariants
  - [ ]\* 6.1 Write property test: Section card count and order matches serial status
    - **Property 1: Section card count and order matches serial status**
    - **Validates: Requirements 1.1, 1.2, 1.3, 5.3**
    - Test file: `tests/properties/serialDetailSections.property.test.ts`

  - [ ]\* 6.2 Write property test: Routing section conditional content matches data presence
    - **Property 2: Routing section conditional content matches data presence**
    - **Validates: Requirements 2.2, 2.3, 2.4**
    - Test file: `tests/properties/serialDetailSections.property.test.ts`

  - [ ]\* 6.3 Write property test: CertAttachButton visibility matches in-progress status
    - **Property 3: CertAttachButton visibility matches in-progress status**
    - **Validates: Requirements 3.1, 3.2**
    - Test file: `tests/properties/serialDetailSections.property.test.ts`

  - [ ]\* 6.4 Write property test: Certificate list and empty state are mutually exclusive
    - **Property 4: Certificate list and empty state are mutually exclusive**
    - **Validates: Requirements 3.3, 3.4**
    - Test file: `tests/properties/serialDetailSections.property.test.ts`

  - [ ]\* 6.5 Write property test: No duplicate Notes heading
    - **Property 5: No duplicate Notes heading**
    - **Validates: Requirements 4.3**
    - Test file: `tests/properties/serialDetailSections.property.test.ts`

  - [x] 6.6 Write property test: Status banner placement above section cards
    - **Property 6: Status banner placement above section cards**
    - **Validates: Requirements 7.1, 7.2, 7.3**
    - Test file: `tests/properties/serialDetailSections.property.test.ts`

- [x] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- This feature is purely presentational — no backend, API, or data model changes
- The `SectionCard` component (task 1.1) is the foundation — build it first, then restructure the page
- All six property tests go in a single file (`serialDetailSections.property.test.ts`) since they test the same page
