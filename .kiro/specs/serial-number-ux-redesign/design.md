# Design Document: Serial Number UX Redesign

## Overview

This design reorganizes the serial number detail page's Routing tab from a flat, unsectioned layout into four visually distinct section cards: Routing, Certificates, Notes, and Advance Process. The change is purely presentational — no business logic, API calls, or data flows change. The existing child components (`PartDetailNotes`, `ProcessAdvancementPanel`, `DeferredStepsList`, `CertAttachButton`) are relocated into card containers without modification to their props, events, or internal behavior.

The implementation introduces a reusable `SectionCard` wrapper component that provides consistent card styling (border, header with icon + title, internal padding) and is used four times in the Routing tab template. The `PartDetailNotes` component receives a new optional `hideHeading` prop to suppress its internal "Notes" heading when the parent section card already provides one.

## Architecture

The change is confined to the UI layer only:

```
┌─────────────────────────────────────────────────┐
│  app/pages/serials/[id].vue  (Routing tab)      │
│                                                  │
│  ┌─ SectionCard: "Routing" ──────────────────┐  │
│  │  Step list                                 │  │
│  │  Step overrides (conditional)              │  │
│  │  DeferredStepsList (conditional)           │  │
│  │  Completed-state banner (conditional)      │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ SectionCard: "Certificates" ─────────────┐  │
│  │  CertAttachButton (in-progress only)       │  │
│  │  Attached certificates list                │  │
│  │  Empty state (conditional)                 │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ SectionCard: "Notes" ────────────────────┐  │
│  │  PartDetailNotes (hideHeading)             │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ SectionCard: "Advance Process" ──────────┐  │
│  │  ProcessAdvancementPanel (in-progress only)│  │
│  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

No new composables, API routes, services, or repositories are needed. The dependency flow remains:

```
SectionCard (new) ← serials/[id].vue → existing child components (unchanged behavior)
```

### Design Decisions

1. **Dedicated `SectionCard` component vs. inline `UCard`**: A thin wrapper component (`SectionCard.vue`) encapsulates the icon + title header pattern so the page template stays clean and the four cards are guaranteed consistent. The component uses Nuxt UI's `UCard` internally with the `outline` variant (project default) and a `#header` slot for the icon/title row.

2. **`hideHeading` prop on `PartDetailNotes`**: Rather than forking or wrapping the notes component, a single boolean prop suppresses the internal `<h4>` heading. This is the minimal change that avoids a duplicate "Notes" title while keeping the component usable standalone elsewhere.

3. **Completed/scrapped/force-complete banners stay outside sections**: These status banners (Requirement 7) remain between the tab bar and the section cards, not inside any card. This keeps terminal-status indicators immediately visible at the top.

4. **Advancement section conditionally rendered, not hidden**: When the serial is not in-progress or has no valid work queue job, the entire fourth `SectionCard` is removed from the DOM via `v-if`, not hidden with CSS. This matches the existing behavior and avoids empty card shells.

## Components and Interfaces

### New Component: `SectionCard`

**File:** `app/components/SectionCard.vue`

**Purpose:** Reusable card wrapper providing consistent section styling with icon + title header.

```typescript
// Props
interface SectionCardProps {
  title: string // Section heading text
  icon: string // Lucide icon name (e.g. "i-lucide-route")
}

// Slots
// default — section body content
```

**Template structure:**

```vue
<UCard variant="outline" :ui="{ header: 'px-4 py-3 sm:px-4', body: 'p-4 sm:p-4' }">
  <template #header>
    <div class="flex items-center gap-2">
      <UIcon :name="icon" class="size-4 text-(--ui-text-muted)" />
      <span class="text-sm font-semibold text-(--ui-text-highlighted)">{{ title }}</span>
    </div>
  </template>
  <slot />
</UCard>
```

### Modified Component: `PartDetailNotes`

**File:** `app/components/PartDetailNotes.vue`

**Change:** Add optional `hideHeading` prop (default `false`). When `true`, the `<h4>` with icon and "Notes" text is not rendered.

```typescript
// Updated props
interface PartDetailNotesProps {
  serialId: string
  hideHeading?: boolean // NEW — suppress internal heading
}
```

### Modified Page: `serials/[id].vue`

**File:** `app/pages/serials/[id].vue`

**Change:** Restructure the Routing tab's `<div v-if="activeTab === 'routing'">` block to wrap content in four `SectionCard` instances. All existing logic, computed properties, event handlers, and data fetching remain unchanged.

**Section mapping:**

| Section Card    | Icon                          | Title           | Content                                                   |
| --------------- | ----------------------------- | --------------- | --------------------------------------------------------- |
| Routing         | `i-lucide-route`              | Routing         | Step list + overrides + deferred steps + completed banner |
| Certificates    | `i-lucide-file-badge`         | Certificates    | CertAttachButton + cert list + empty state                |
| Notes           | `i-lucide-message-square`     | Notes           | PartDetailNotes (hideHeading)                             |
| Advance Process | `i-lucide-arrow-right-circle` | Advance Process | ProcessAdvancementPanel                                   |

## Data Models

No data model changes. This feature is purely presentational. All existing domain types, API types, and computed types remain unchanged:

- `WorkQueueJob` — used by `ProcessAdvancementPanel` (unchanged)
- `StepNote` — used by `PartDetailNotes` (unchanged)
- `CertAttachment` — used by cert list rendering (unchanged)
- `SnStepStatusView` — used by `DeferredStepsList` (unchanged)
- `SnStepOverride` — used by overrides display (unchanged)

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Section card count and order matches serial status

_For any_ serial number, when the Routing tab is displayed: if the serial is in-progress with a valid work queue job, exactly four section cards shall be rendered in the order [Routing, Certificates, Notes, Advance Process]; if the serial is completed or scrapped, exactly three section cards shall be rendered in the order [Routing, Certificates, Notes] with no Advancement section.

**Validates: Requirements 1.1, 1.2, 1.3, 5.3**

### Property 2: Routing section conditional content matches data presence

_For any_ serial number, the Routing section card shall contain the step overrides list if and only if active step overrides exist, and shall contain the DeferredStepsList if and only if deferred steps exist. When neither overrides nor deferred steps exist, only the step list shall be present.

**Validates: Requirements 2.2, 2.3, 2.4**

### Property 3: CertAttachButton visibility matches in-progress status

_For any_ serial number, the CertAttachButton component shall be rendered inside the Certificates section if and only if the serial has status "in_progress".

**Validates: Requirements 3.1, 3.2**

### Property 4: Certificate list and empty state are mutually exclusive

_For any_ serial number, the Certificates section shall display the attached certificates list if certificate attachments exist, and shall display the empty-state message "No certificates attached" if and only if no attachments exist and the serial is not in-progress.

**Validates: Requirements 3.3, 3.4**

### Property 5: No duplicate Notes heading

_For any_ rendering of the Notes section, the PartDetailNotes component shall suppress its internal heading when `hideHeading` is true, resulting in exactly one "Notes" title (from the section card header) visible in the Notes section.

**Validates: Requirements 4.3**

### Property 6: Status banner placement above section cards

_For any_ serial number with a terminal status, the appropriate status banner (green for completed, red for scrapped, amber for force-completed) shall be rendered above the section cards and outside of any section card boundary.

**Validates: Requirements 7.1, 7.2, 7.3**

## Error Handling

This feature introduces no new error states. All existing error handling remains unchanged:

- **Loading state**: The existing loading spinner and "Loading part detail..." message continue to display while data is fetched. Section cards are only rendered after data is available.
- **API errors**: The existing error display (`error && !serial`) continues to show above the section cards.
- **Missing data graceful degradation**: The existing `v-if` guards on `serial && job && path` remain the gate for rendering the entire detail view. Individual sections handle missing optional data (e.g., no overrides, no certs) with conditional rendering or empty states.
- **PartDetailNotes internal error handling**: The component's own loading and empty states are preserved unchanged.

## Testing Strategy

### Dual Testing Approach

This feature uses both unit tests and property-based tests:

- **Property-based tests** verify universal properties (section count/order, conditional visibility) across randomly generated serial states using `fast-check`.
- **Unit tests** verify specific examples, edge cases, and static rendering (icon names, title text, DOM structure).

### Property-Based Testing

**Library:** `fast-check` (already in the project)

**Configuration:** Minimum 100 iterations per property test.

**Tag format:** Each test is tagged with a comment: `Feature: serial-number-ux-redesign, Property {N}: {title}`

Each correctness property maps to a single property-based test. The tests generate random serial states (varying `status`, `currentStepIndex`, `forceCompleted`, presence/absence of overrides, deferred steps, cert attachments) and assert the corresponding rendering invariants.

**Test file:** `tests/properties/serialDetailSections.property.test.ts`

Properties to implement:

1. Section card count and order (Property 1)
2. Routing section conditional content (Property 2)
3. CertAttachButton visibility (Property 3)
4. Certificate list vs empty state (Property 4)
5. No duplicate Notes heading (Property 5)
6. Status banner placement (Property 6)

### Unit Tests

**Test file:** `tests/unit/components/SectionCard.test.ts`

Unit tests cover:

- SectionCard renders with correct icon and title
- SectionCard renders slot content
- Section header icons match spec (i-lucide-route, i-lucide-file-badge, i-lucide-message-square, i-lucide-arrow-right-circle)
- PartDetailNotes hides heading when `hideHeading` is true
- PartDetailNotes shows heading when `hideHeading` is false or omitted

### What NOT to Test

- CSS visual properties (padding, border-radius, spacing) — guaranteed by the shared SectionCard component using UCard
- Existing functionality regression (click handlers, API calls, advancement flow) — covered by existing integration tests
- Serials tab — not modified by this feature
