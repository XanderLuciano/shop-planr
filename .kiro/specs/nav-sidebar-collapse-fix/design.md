# Nav Sidebar Collapse Fix — Bugfix Design

## Overview

When the sidebar is collapsed, the `UColorModeButton` in the sidebar footer overlaps the `UDashboardSidebarCollapse` button and the navigation icons, making them unusable. Since a `UColorModeButton` already exists in the top navbar (`UDashboardNavbar`), the sidebar instance is redundant. The fix removes the `UColorModeButton` from the sidebar footer and simplifies the wrapper markup so the collapse button stands alone.

## Glossary

- **Bug_Condition (C)**: The sidebar is collapsed while the footer contains both `UColorModeButton` and `UDashboardSidebarCollapse`, causing overlap
- **Property (P)**: The sidebar footer renders only the collapse button with no overlapping elements when collapsed
- **Preservation**: The color mode toggle in the top navbar, the API Docs link in the sidebar footer, the collapse button itself, and all navigation icons must remain unchanged
- **`UColorModeButton`**: Nuxt UI component that toggles light/dark mode
- **`UDashboardSidebarCollapse`**: Nuxt UI component that toggles sidebar collapsed/expanded state
- **`UDashboardNavbar`**: Nuxt UI component rendering the top navigation bar (already contains a `UColorModeButton`)

## Bug Details

### Bug Condition

The bug manifests when the sidebar is collapsed and the footer still renders both the `UColorModeButton` and `UDashboardSidebarCollapse` inside a flex row. In collapsed state, the sidebar shrinks to icon-width, but both buttons compete for the same narrow space, causing the color mode button to overlap the collapse button and the navigation icons above.

**Formal Specification:**
```
FUNCTION isBugCondition(state)
  INPUT: state of type { sidebarCollapsed: boolean, sidebarFooterHasColorModeButton: boolean }
  OUTPUT: boolean

  RETURN state.sidebarCollapsed = true
         AND state.sidebarFooterHasColorModeButton = true
END FUNCTION
```

### Examples

- User collapses sidebar → color mode button overlaps collapse button → user cannot click expand button to restore sidebar (bug)
- User collapses sidebar → color mode button overlaps navigation icons → user cannot navigate via sidebar icons (bug)
- User collapses sidebar after fix → only collapse button in footer → expand button is fully clickable (expected)
- User wants to toggle dark mode after fix → uses the `UColorModeButton` in the top navbar → works as before (expected)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- The `UColorModeButton` in the `UDashboardNavbar` (top navbar) must continue to work for toggling light/dark mode
- The `UDashboardSidebarCollapse` button must continue to appear in the sidebar footer
- The API Docs link in the sidebar footer must continue to render and function
- All sidebar navigation icons must remain fully visible and clickable in both collapsed and expanded states
- Sidebar collapsible/resizable behavior must remain unchanged

**Scope:**
All inputs that do NOT involve the sidebar footer's color mode button should be completely unaffected by this fix. This includes:
- Top navbar color mode toggle
- Sidebar navigation menu items
- Sidebar header (logo/brand link)
- Sidebar collapse/expand behavior
- All page content and routing

## Hypothesized Root Cause

Based on the bug description and code inspection, the root cause is straightforward:

1. **Redundant `UColorModeButton` in sidebar footer**: The sidebar footer template in `app/layouts/default.vue` renders both `UDashboardSidebarCollapse` and `UColorModeButton` inside a `<div class="flex items-center justify-between">`. When the sidebar collapses to icon-width, both buttons cannot fit, causing overlap.

2. **Unnecessary wrapper div**: The `<div class="flex items-center justify-between">` exists solely to lay out two buttons side by side. With only the collapse button remaining, this wrapper is unnecessary overhead.

## Correctness Properties

Property 1: Bug Condition — Sidebar footer contains no color mode button

_For any_ state where the sidebar is rendered (collapsed or expanded), the sidebar footer SHALL NOT contain a `UColorModeButton` component, ensuring no overlap with the collapse button or navigation icons.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation — Top navbar color mode toggle and sidebar footer elements unchanged

_For any_ state where the layout is rendered, the top navbar SHALL continue to contain a `UColorModeButton`, the sidebar footer SHALL continue to contain the `UDashboardSidebarCollapse` button and the API Docs link, preserving all existing functionality unrelated to the removed sidebar color mode button.

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `app/layouts/default.vue`

**Section**: `UDashboardSidebar` component and its slots

**Specific Changes**:

#### 1. Remove `UColorModeButton` and wrapper div from sidebar footer
- Delete the `<UColorModeButton size="xs" />` from the sidebar footer
- Replace the `<div class="flex items-center justify-between">` wrapper with the bare `<UDashboardSidebarCollapse />` component

#### 2. Add `collapsed-size` prop to prevent resize overlap
- Add `:collapsed-size="4"` to `UDashboardSidebar` so the resizable panel system allocates 4% width when collapsed, preventing the adjacent panel/resize handle from overlapping the sidebar's `min-w-16` visual area

#### 3. Add `group` class and collapsed-aware UI overrides
- Add `group` class to the sidebar root via `:ui` prop so `group-data-[collapsed=true]` selectors work on child elements
- Add collapsed-aware padding/centering: body gets `items-center` and `px-2` when collapsed, header gets `justify-center`, footer gets `items-center` and `px-2`

#### 4. Hide header/footer text when collapsed
- Add `group-data-[collapsed=true]:hidden` to the "Shop Planr" header text span
- The existing `group-data-[collapsed]:hidden` classes on "API Docs" text and external link icon were updated to `group-data-[collapsed=true]:hidden` (value-specific match required because `data-collapsed` is set to `"true"` or `"false"`, not just present/absent)

#### 5. Pass `collapsed` prop to `UNavigationMenu`
- Wrap the `UNavigationMenu` in `<template #default="{ collapsed }">` to receive the sidebar's collapsed state
- Pass `:collapsed="collapsed"` to `UNavigationMenu` so it switches to icon-only mode with correct `px-1.5` link padding and hidden labels

**Before:**
```vue
<UDashboardSidebar
  id="default-sidebar"
  collapsible
  resizable
  :min-size="10"
  :default-size="15"
  :max-size="20"
>
  <template #header>
    <NuxtLink to="/" class="flex items-center gap-2 px-1">
      <span class="font-bold text-lg ...">Shop Planr</span>
    </NuxtLink>
  </template>

  <UNavigationMenu :items="filteredNavItems" orientation="vertical" />

  <template #footer>
    <div class="flex flex-col gap-2">
      <NuxtLink to="/api-docs" ...>...</NuxtLink>
      <div class="flex items-center justify-between">
        <UDashboardSidebarCollapse />
        <UColorModeButton size="xs" />
      </div>
    </div>
  </template>
</UDashboardSidebar>
```

**After:**
```vue
<UDashboardSidebar
  id="default-sidebar"
  collapsible
  resizable
  :min-size="10"
  :default-size="15"
  :max-size="20"
  :collapsed-size="4"
  :ui="{ root: 'group', body: 'group-data-[collapsed=true]:items-center group-data-[collapsed=true]:px-2', header: 'group-data-[collapsed=true]:justify-center', footer: 'group-data-[collapsed=true]:items-center group-data-[collapsed=true]:px-2' }"
>
  <template #header>
    <NuxtLink to="/" class="flex items-center gap-2 px-1">
      <span class="font-bold text-lg ... group-data-[collapsed=true]:hidden">Shop Planr</span>
    </NuxtLink>
  </template>

  <template #default="{ collapsed }">
    <UNavigationMenu :items="filteredNavItems" :collapsed="collapsed" orientation="vertical" />
  </template>

  <template #footer>
    <div class="flex flex-col gap-2">
      <NuxtLink to="/api-docs" ...>
        <UIcon name="i-lucide-book-open" class="size-4" />
        <span class="truncate group-data-[collapsed=true]:hidden">API Docs</span>
        <UIcon name="i-lucide-external-link" class="size-3 ml-auto opacity-50 group-data-[collapsed=true]:hidden" />
      </NuxtLink>
      <UDashboardSidebarCollapse />
    </div>
  </template>
</UDashboardSidebar>
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, confirm the bug exists in the current markup, then verify the fix resolves it and preserves existing behavior. Since this is a pure template change (no logic), testing focuses on structural assertions against the rendered DOM.

### Exploratory Bug Condition Checking

**Goal**: Confirm the sidebar footer currently renders both `UColorModeButton` and `UDashboardSidebarCollapse` in the same container, which is the root cause of the overlap.

**Test Plan**: Inspect the `app/layouts/default.vue` template to verify the presence of both components in the sidebar footer. This is a static code inspection rather than a runtime test, since the bug is a markup issue.

**Test Cases**:
1. **Sidebar footer inspection**: Verify `UColorModeButton` exists inside `<template #footer>` of `UDashboardSidebar` (will be true on unfixed code)
2. **Wrapper div inspection**: Verify the `<div class="flex items-center justify-between">` wraps both buttons (will be true on unfixed code)

**Expected Counterexamples**:
- The sidebar footer contains `UColorModeButton` alongside `UDashboardSidebarCollapse`
- Cause: redundant color mode button added to sidebar when one already exists in the navbar

### Fix Checking

**Goal**: Verify that after the fix, the sidebar footer no longer contains a `UColorModeButton` and the collapse button renders without a wrapper div.

**Pseudocode:**
```
FOR ALL renders of default layout DO
  sidebarFooter := querySelector('#default-sidebar [slot=footer]')
  ASSERT sidebarFooter does NOT contain UColorModeButton
  ASSERT sidebarFooter contains UDashboardSidebarCollapse
END FOR
```

### Preservation Checking

**Goal**: Verify that the top navbar still contains `UColorModeButton`, the sidebar footer still has the API Docs link and collapse button, and no other layout elements are affected.

**Pseudocode:**
```
FOR ALL renders of default layout DO
  navbar := querySelector('UDashboardNavbar')
  ASSERT navbar contains UColorModeButton
  sidebarFooter := querySelector('#default-sidebar [slot=footer]')
  ASSERT sidebarFooter contains NuxtLink[to="/api-docs"]
  ASSERT sidebarFooter contains UDashboardSidebarCollapse
END FOR
```

**Testing Approach**: Since this is a template-only change with no business logic, manual visual inspection and a lightweight unit test on the rendered component are sufficient. Property-based testing is not applicable here — there is no input domain to generate over.

### Unit Tests

- Render `default.vue` layout and assert the sidebar footer does not contain `UColorModeButton`
- Render `default.vue` layout and assert the sidebar footer contains `UDashboardSidebarCollapse`
- Render `default.vue` layout and assert the navbar contains `UColorModeButton`
- Render `default.vue` layout and assert the sidebar footer contains the API Docs link

### Property-Based Tests

Not applicable — this is a static template change with no parameterized logic or input domain.

### Integration Tests

- Load the app in a browser, collapse the sidebar, and verify the collapse button is fully clickable
- Load the app, collapse the sidebar, and verify all navigation icons are visible and clickable
- Load the app and verify the top navbar color mode toggle still switches between light and dark mode
