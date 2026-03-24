# Requirements Document

## Introduction

The serial number detail page (`app/pages/serials/[id].vue`) currently renders all content within the Routing tab as a flat, unsectioned list. Routing steps, overrides, deferred steps, certificate attachment, certificate list, notes, and the process advancement panel are stacked without visual grouping or hierarchy. This creates a lack of unity between related interfaces and makes the page harder to scan and use.

This feature reorganizes the Routing tab into four clearly defined, visually distinct sections:

1. **Routing & Status** — step list, step overrides, deferred steps
2. **Certificates** — attach button + attached certificates list
3. **Notes** — existing PartDetailNotes component
4. **Advance Process** — ProcessAdvancementPanel (in-progress serials only)

Each section receives a consistent card-style container with a header, icon, and collapsible boundary so operators can quickly locate the information they need.

## Glossary

- **Serial_Detail_Page**: The page at `app/pages/serials/[id].vue` that displays full detail for a single serial number, including routing, certificates, notes, and advancement controls.
- **Routing_Tab**: The primary tab within the Serial_Detail_Page that shows process routing information and all operational controls.
- **Section_Card**: A visually distinct container with a header (icon + title), consistent border, and internal padding used to group related UI elements within the Routing_Tab.
- **Routing_Section**: The Section_Card grouping the step list, step status badges, step overrides, and deferred steps.
- **Certificates_Section**: The Section_Card grouping the certificate attach control and the attached certificates list.
- **Notes_Section**: The Section_Card grouping the PartDetailNotes component output.
- **Advancement_Section**: The Section_Card grouping the ProcessAdvancementPanel, visible only for in-progress serials.
- **Step_List**: The ordered list of process steps rendered within the Routing_Section, showing step order, name, status badge, location, assignment, and distribution count.
- **Operator**: A shop floor user interacting with the Serial_Detail_Page to view status, attach certificates, add notes, or advance parts.

## Requirements

### Requirement 1: Section-Based Layout for the Routing Tab

**User Story:** As an Operator, I want the Routing tab content organized into clearly separated sections, so that I can quickly find routing info, certificates, notes, and advancement controls without scanning a flat list.

#### Acceptance Criteria

1. WHEN the Routing_Tab is displayed, THE Serial_Detail_Page SHALL render exactly four Section_Cards in this order: Routing_Section, Certificates_Section, Notes_Section, Advancement_Section.
2. WHILE the serial has status "in_progress", THE Serial_Detail_Page SHALL display the Advancement_Section as the fourth Section_Card.
3. WHILE the serial has status "completed" or "scrapped", THE Serial_Detail_Page SHALL hide the Advancement_Section entirely.
4. THE Serial_Detail_Page SHALL render each Section_Card with a consistent visual container that includes a bordered card, a header row with an icon and title, and internal padding.

### Requirement 2: Routing Section Content Grouping

**User Story:** As an Operator, I want the step list, step overrides, and deferred steps grouped together under a single "Routing" heading, so that all route-related information is in one place.

#### Acceptance Criteria

1. THE Routing_Section SHALL contain the Step_List as its first child element.
2. WHEN active step overrides exist, THE Routing_Section SHALL display the step overrides list below the Step_List within the same Section_Card.
3. WHEN deferred steps exist, THE Routing_Section SHALL display the DeferredStepsList component below the step overrides (or below the Step_List if no overrides exist) within the same Section_Card.
4. WHEN no overrides and no deferred steps exist, THE Routing_Section SHALL display only the Step_List without extra empty subsections.
5. THE Routing_Section header SHALL display a route icon and the title "Routing".

### Requirement 3: Certificates Section Content Grouping

**User Story:** As an Operator, I want the certificate attach control and the attached certificates list grouped together under a single "Certificates" heading, so that all certificate-related actions and data are co-located.

#### Acceptance Criteria

1. WHILE the serial has status "in_progress", THE Certificates_Section SHALL display the CertAttachButton component at the top of the section.
2. WHILE the serial does not have status "in_progress", THE Certificates_Section SHALL hide the CertAttachButton component.
3. WHEN certificate attachments exist, THE Certificates_Section SHALL display the attached certificates list below the CertAttachButton (or as the only content if the serial is not in-progress).
4. WHEN no certificate attachments exist and the serial is not in-progress, THE Certificates_Section SHALL display an empty-state message "No certificates attached".
5. THE Certificates_Section header SHALL display a file-badge icon and the title "Certificates".

### Requirement 4: Notes Section Presentation

**User Story:** As an Operator, I want notes displayed in their own dedicated section, so that I can review process notes without them being lost among routing and certificate data.

#### Acceptance Criteria

1. THE Notes_Section SHALL contain the PartDetailNotes component as its sole content.
2. THE Notes_Section header SHALL display a message-square icon and the title "Notes".
3. THE Notes_Section SHALL remove the duplicate "Notes" heading currently rendered inside the PartDetailNotes component, so that only the Section_Card header displays the title.

### Requirement 5: Advancement Section Presentation

**User Story:** As an Operator, I want the process advancement panel in its own clearly labeled section at the bottom of the page, so that the primary action of advancing a part is easy to locate.

#### Acceptance Criteria

1. WHILE the serial has status "in_progress" and a valid work queue job exists, THE Advancement_Section SHALL display the ProcessAdvancementPanel component.
2. THE Advancement_Section header SHALL display an arrow-right-circle icon and the title "Advance Process".
3. IF the serial is not in-progress or no valid work queue job exists, THEN THE Serial_Detail_Page SHALL not render the Advancement_Section at all.

### Requirement 6: Visual Consistency Across Sections

**User Story:** As an Operator, I want all sections to look and feel consistent, so that the page has a unified, professional appearance.

#### Acceptance Criteria

1. THE Serial_Detail_Page SHALL render each Section_Card with the same border style, border radius, and background treatment using the existing UI theme tokens (--ui-border, --ui-bg-elevated).
2. THE Serial_Detail_Page SHALL render each Section_Card header with a consistent layout: icon on the left, title text in semibold, and a uniform font size across all sections.
3. THE Serial_Detail_Page SHALL maintain consistent vertical spacing between Section_Cards.
4. THE Serial_Detail_Page SHALL use icons from the `@iconify-json/lucide` icon set for all Section_Card headers.

### Requirement 7: Completed and Scrapped State Indicators

**User Story:** As an Operator, I want the completed-state and scrapped-state banners to remain visible above the sections, so that the serial's terminal status is immediately obvious regardless of which section I'm looking at.

#### Acceptance Criteria

1. WHEN the serial status is "completed" and not force-completed, THE Serial_Detail_Page SHALL display the green completion banner above the Section_Cards, outside of any section.
2. WHEN the serial status is "scrapped", THE Serial_Detail_Page SHALL display the red scrap banner above the Section_Cards, outside of any section.
3. WHEN the serial is force-completed, THE Serial_Detail_Page SHALL display the amber force-complete banner above the Section_Cards, outside of any section.

### Requirement 8: No Functional Regression

**User Story:** As an Operator, I want all existing functionality preserved after the redesign, so that I can still perform every action I could before.

#### Acceptance Criteria

1. THE Serial_Detail_Page SHALL preserve all existing click handlers, navigation links, and event emissions without modification to their behavior.
2. THE Serial_Detail_Page SHALL preserve the step list click-to-navigate behavior that routes to the operator view for the selected step.
3. THE Serial_Detail_Page SHALL preserve the certificate attach flow, including search, selection, and the attach API call.
4. THE Serial_Detail_Page SHALL preserve the process advancement flow, including serial selection, quantity input, note entry, and the advance API call.
5. THE Serial_Detail_Page SHALL preserve the deferred step complete and waive actions.
6. THE Serial_Detail_Page SHALL preserve the Serials tab and its sibling serial table without changes.
