---
name: 'nuxtui-components'
displayName: 'NuxtUI Components Reference'
description: 'Complete reference guide for NuxtUI 4.3.0 components with props, variants, and usage examples. Quick access to all 110+ components organized by category.'
keywords: ['nuxtui', 'vue', 'components', 'ui', 'tailwind', 'props', 'variants']
author: '@xanderr'
---

# NuxtUI Components Reference

## Overview

Complete reference documentation for NuxtUI 4.3.0 - a comprehensive Vue UI component library with 110+ accessible, Tailwind CSS components. This power provides quick access to component APIs, props, variants, sizes, and usage patterns.

NuxtUI is built on Reka UI, Tailwind CSS, and Tailwind Variants, providing production-ready components that work with both Nuxt and plain Vue applications.

## Component Categories

NuxtUI components are organized into the following categories:

### Layout

Core structural components for organizing your application's layout:

- **Container** - Responsive container with max-width constraints
- **Main** - Main content area wrapper
- **Header** - Application header component
- **Footer** - Application footer component
- **Footer Columns** - Multi-column footer layout

### Element

Essential UI building blocks:

- **Button** - Interactive button with variants and states
- **Badge** - Status indicators and labels
- **Avatar** - User profile images with fallbacks
- **Avatar Group** - Multiple avatars with overlap
- **Chip** - Removable tags and filters
- **Icon** - Icon display component
- **Kbd** - Keyboard shortcut display
- **Link** - Enhanced anchor links
- **Separator** - Visual dividers
- **Skeleton** - Loading placeholders
- **Empty** - Empty state displays
- **Error** - Error state displays

### Form

Comprehensive form components:

- **Input** - Text input field
- **Input Number** - Numeric input with controls
- **Input Date** - Date picker input
- **Input Time** - Time picker input
- **Input Tags** - Tag input field
- **Input Menu** - Input with dropdown menu
- **Select** - Native select dropdown
- **Select Menu** - Custom select with search
- **Textarea** - Multi-line text input
- **Checkbox** - Single checkbox
- **Checkbox Group** - Multiple checkboxes
- **Radio Group** - Radio button group
- **Switch** - Toggle switch
- **Slider** - Range slider
- **Pin Input** - PIN/OTP input
- **File Upload** - File upload component
- **Color Picker** - Color selection
- **Form** - Form wrapper with validation
- **Form Field** - Form field wrapper
- **Field Group** - Group related fields

### Data

Components for displaying and organizing data:

- **Table** - Data tables with sorting
- **Accordion** - Collapsible content sections
- **Carousel** - Image/content carousel
- **Timeline** - Event timeline display
- **Tree** - Hierarchical tree view
- **User** - User profile display
- **Marquee** - Scrolling content

### Navigation

Components for user navigation:

- **Navigation Menu** - Main navigation menu
- **Breadcrumb** - Breadcrumb navigation
- **Pagination** - Page navigation
- **Tabs** - Tabbed interface
- **Stepper** - Step-by-step navigation
- **Link** - Navigation links
- **Command Palette** - Command search interface

### Overlay

Floating UI elements:

- **Modal** - Modal dialogs
- **Drawer** - Side drawer panels
- **Slideover** - Sliding overlay panels
- **Popover** - Popover tooltips
- **Tooltip** - Hover tooltips
- **Context Menu** - Right-click menus
- **Dropdown Menu** - Dropdown menus
- **Toast** - Toast notifications
- **Toaster** - Toast container
- **Alert** - Alert messages
- **Banner** - Banner notifications

### Page

Pre-built marketing and content sections:

- **Page** - Page wrapper
- **Page Header** - Page header section
- **Page Hero** - Hero section
- **Page Body** - Page content area
- **Page Section** - Content sections
- **Page Grid** - Grid layouts
- **Page Columns** - Column layouts
- **Page Card** - Card layouts
- **Page Feature** - Feature sections
- **Page CTA** - Call-to-action sections
- **Page Links** - Link sections
- **Page List** - List sections
- **Page Logos** - Logo grids
- **Page Anchors** - Anchor navigation
- **Page Aside** - Sidebar content

### Dashboard

Specialized dashboard components:

- **Dashboard Panel** - Resizable panels
- **Dashboard Group** - Panel groups
- **Dashboard Resize Handle** - Panel resize controls
- **Dashboard Sidebar** - Dashboard sidebar
- **Dashboard Sidebar Toggle** - Sidebar toggle button
- **Dashboard Sidebar Collapse** - Collapsible sidebar
- **Dashboard Navbar** - Dashboard navigation bar
- **Dashboard Toolbar** - Dashboard toolbar
- **Dashboard Search** - Dashboard search
- **Dashboard Search Button** - Search trigger button

### AI Chat

Conversational interface components:

- **Chat Messages** - Message list container
- **Chat Message** - Individual message
- **Chat Prompt** - Message input
- **Chat Prompt Submit** - Submit button
- **Chat Palette** - Command palette for chat

### Editor

Rich text editor components (4.3+):

- **Editor** - Main editor component
- **Editor Toolbar** - Formatting toolbar
- **Editor Drag Handle** - Drag and drop handle
- **Editor Emoji Menu** - Emoji picker
- **Editor Mention Menu** - Mention suggestions
- **Editor Suggestion Menu** - Content suggestions

### Content

Documentation site components:

- **Blog Posts** - Blog post list
- **Blog Post** - Individual blog post
- **Changelog Versions** - Changelog list
- **Changelog Version** - Individual changelog entry

### Pricing

Pricing page components:

- **Pricing Plans** - Pricing plan grid
- **Pricing Plan** - Individual pricing plan
- **Pricing Table** - Feature comparison table

### Auth

Authentication components:

- **Auth Form** - Authentication form

### Utilities

Utility components:

- **Scroll Area** - Custom scrollbar area
- **Collapsible** - Collapsible content
- **Progress** - Progress indicators
- **Calendar** - Calendar component

## Common Props and Patterns

### Color Variants

Most components support these color options:

- `primary` - Primary brand color
- `secondary` - Secondary brand color
- `success` - Success/positive state
- `info` - Informational state
- `warning` - Warning state
- `error` - Error/danger state
- `neutral` - Neutral/default state

### Visual Variants

Common visual styles across components:

- `solid` - Filled background
- `outline` - Border only
- `soft` - Subtle background
- `subtle` - Subtle background with border
- `ghost` - Transparent background
- `link` - Link style (buttons only)

### Size Options

Standard size scale:

- `xs` - Extra small
- `sm` - Small
- `md` - Medium (default)
- `lg` - Large
- `xl` - Extra large

Some components also support:

- `3xs`, `2xs` - Micro sizes (Avatar)
- `2xl`, `3xl` - Larger sizes (Avatar)

### Common Props

**Button Component:**

```vue
<UButton
  color="primary"
  variant="solid"
  size="md"
  :loading="false"
  :disabled="false"
  :block="false"
  :square="false"
  :leading-icon="'icon-name'"
  :trailing-icon="'icon-name'"
  :avatar="{ src: 'url' }"
>
  Button Text
</UButton>
```

**Input Component:**

```vue
<UInput
  v-model="value"
  type="text"
  placeholder="Enter text"
  color="primary"
  variant="outline"
  size="md"
  :disabled="false"
  :loading="false"
  :leading-icon="'icon-name'"
  :trailing-icon="'icon-name'"
/>
```

**Card Component:**

```vue
<UCard variant="outline">
  <template #header>
    Card Header
  </template>
  
  Card Body Content
  
  <template #footer>
    Card Footer
  </template>
</UCard>
```

**Badge Component:**

```vue
<UBadge
  color="primary"
  variant="solid"
  size="md"
  :square="false"
  :leading-icon="'icon-name'"
  :trailing-icon="'icon-name'"
>
  Badge Text
</UBadge>
```

**Avatar Component:**

```vue
<UAvatar src="image-url" alt="User name" size="md" :icon="'icon-name'" :text="'AB'" />
```

**Select Component:**

```vue
<USelect
  v-model="selected"
  :options="options"
  placeholder="Select option"
  color="primary"
  variant="outline"
  size="md"
/>
```

**Modal Component:**

```vue
<UModal v-model="isOpen">
  <UCard>
    <template #header>
      Modal Title
    </template>
    
    Modal Content
    
    <template #footer>
      <UButton @click="isOpen = false">Close</UButton>
    </template>
  </UCard>
</UModal>
```

## Usage Patterns

### Form with Validation

```vue
<template>
  <UForm :state="state" @submit="onSubmit">
    <UFormField label="Email" name="email">
      <UInput v-model="state.email" type="email" />
    </UFormField>

    <UFormField label="Password" name="password">
      <UInput v-model="state.password" type="password" />
    </UFormField>

    <UButton type="submit">Submit</UButton>
  </UForm>
</template>
```

### Field Groups

```vue
<UFieldGroup orientation="horizontal">
  <UInput placeholder="First" />
  <UInput placeholder="Second" />
  <UButton>Submit</UButton>
</UFieldGroup>
```

### Data Table

```vue
<UTable :columns="columns" :rows="rows" :loading="loading" @select="onSelect" />
```

### Navigation Menu

```vue
<UNavigationMenu :items="menuItems" />
```

### Toast Notifications

```vue
<script setup>
const toast = useToast()

function showToast() {
  toast.add({
    title: 'Success',
    description: 'Operation completed',
    color: 'success',
  })
}
</script>
```

## Component Discovery

### By Use Case

**Need a button?**

- Basic action: `UButton`
- Icon only: `UButton` with `square` prop
- Link style: `UButton` with `variant="link"`

**Need input?**

- Text: `UInput`
- Number: `UInputNumber`
- Date: `UInputDate`
- Time: `UInputTime`
- Tags: `UInputTags`
- With dropdown: `UInputMenu`

**Need selection?**

- Simple dropdown: `USelect`
- Searchable: `USelectMenu`
- Multiple options: `UCheckboxGroup`
- Single choice: `URadioGroup`
- Toggle: `USwitch`

**Need overlay?**

- Full screen: `UModal`
- Side panel: `UDrawer` or `USlideover`
- Small popup: `UPopover`
- Hover info: `UTooltip`
- Right-click: `UContextMenu`
- Dropdown: `UDropdownMenu`

**Need data display?**

- Tabular: `UTable`
- Expandable: `UAccordion`
- Hierarchical: `UTree`
- Timeline: `UTimeline`
- Slideshow: `UCarousel`

**Need navigation?**

- Main menu: `UNavigationMenu`
- Tabs: `UTabs`
- Steps: `UStepper`
- Pages: `UPagination`
- Path: `UBreadcrumb`

## Theming and Customization

All components use Tailwind Variants for styling. You can customize components globally in your `app.config.ts`:

```typescript
export default defineAppConfig({
  ui: {
    button: {
      slots: {
        base: 'custom-classes',
      },
      variants: {
        color: {
          custom: 'custom-color-classes',
        },
      },
    },
  },
})
```

Or override per instance using the `ui` prop:

```vue
<UButton
  :ui="{
    base: 'custom-classes',
    variant: {
      solid: 'custom-solid-classes',
    },
  }"
>
  Custom Button
</UButton>
```

## Local Component Definitions

Your project has local TypeScript definitions for all components in `.nuxt/ui/` directory. These files contain:

- Available slots
- Variant options
- Size scales
- Color options
- Compound variants
- Default values

Example: `.nuxt/ui/button.ts` contains the complete Button component configuration.

## Best Practices

1. **Use v-model for form inputs** - All form components support v-model for two-way binding
2. **Leverage color variants** - Use semantic colors (success, error, warning) for better UX
3. **Consistent sizing** - Stick to the standard size scale across your app
4. **Accessibility** - Components are built with accessibility in mind, maintain ARIA attributes
5. **Composition** - Combine simple components to build complex UIs
6. **Theming** - Use app.config.ts for global customization, ui prop for local overrides
7. **Icons** - Use leading/trailing icon props instead of manual icon placement
8. **Loading states** - Use built-in loading props for async operations
9. **Validation** - Use UForm and UFormField for form validation
10. **Responsive** - Components are responsive by default, use Tailwind breakpoints for custom behavior

## Troubleshooting

### Component not found

**Problem:** Component not auto-imported
**Solution:** Ensure `@nuxt/ui` is in your `nuxt.config.ts` modules array

### Styling not applied

**Problem:** Custom styles not working
**Solution:** Check Tailwind CSS configuration and ensure classes are not being purged

### TypeScript errors

**Problem:** Props not recognized
**Solution:** Run `nuxt prepare` to regenerate type definitions

### Icons not showing

**Problem:** Icons not displaying
**Solution:** Install required icon collections: `@iconify-json/lucide` or others

### Dark mode issues

**Problem:** Colors not switching in dark mode
**Solution:** Ensure `@nuxtjs/color-mode` is configured properly

## Additional Resources

- Official Documentation: https://ui.nuxt.com
- GitHub Repository: https://github.com/nuxt/ui
- Component Examples: https://ui.nuxt.com/components
- Theming Guide: https://ui.nuxt.com/docs/getting-started/theme
- Reka UI (underlying library): https://reka-ui.com

## Quick Reference

### Installation

```bash
npm install @nuxt/ui
```

### Configuration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
})
```

### Import (auto-imported in Nuxt)

```vue
<template>
  <UButton>Click me</UButton>
</template>
```

---

**Version:** NuxtUI 4.3.0
**Framework:** Vue 3 / Nuxt 4
**Styling:** Tailwind CSS + Tailwind Variants
**Accessibility:** Built on Reka UI (accessible primitives)
