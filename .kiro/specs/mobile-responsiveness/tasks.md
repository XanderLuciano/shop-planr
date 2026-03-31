# Implementation Plan: Mobile Responsiveness

## Overview

Comprehensive mobile responsiveness overhaul for Shop Planr. Adds mobile navigation via `UDashboardNavbar` with built-in sidebar toggle, makes the header responsive, relocates the color mode toggle to the header, converts tables to card-based layouts on mobile (jobs, parts browser, job parts tab), adds vertical StepTracker layout on mobile, applies global CSS overflow prevention, makes the UserSelector compact on narrow viewports, and disables pinch zoom. All changes are CSS/template-level in existing components plus one new component (`JobMobileCard`) and one new composable (`useMobileBreakpoint`). No API or data model changes needed.

## Tasks

- [x] 1. Disable Pinch Zoom (Req 5)
  - [x] 1.1 Update viewport meta tag in `app/app.vue` to add `maximum-scale=1, user-scalable=no`
    - _Requirements: 5.1, 5.2_

- [x] 2. Create useMobileBreakpoint Composable
  - [x] 2.1 Create `app/composables/useMobileBreakpoint.ts` with `matchMedia('(max-width: 767.9px)')` listener
    - _Requirements: 1.1, 1.2, 4.2_
  - [x] 2.2 Write unit test `tests/unit/composables/useMobileBreakpoint.test.ts` with mocked `matchMedia`
    - _Requirements: 1.1, 1.2_

- [x] 3. Mobile Navigation via UDashboardNavbar (Req 1)
  - [x] 3.1 Replace custom header div with `UDashboardNavbar` in `app/layouts/default.vue`
    - Navbar auto-renders `UDashboardSidebarToggle` on mobile
    - Sidebar `autoClose` (default true) handles closing on route change
    - No `useDashboardSidebar()` composable needed
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 4. Responsive Header Layout (Req 2, Req 3)
  - [x] 4.1 Use `UDashboardNavbar` `left` slot for BarcodeInput (wrapped in `flex-1 min-w-0`) and `right` slot for ColorMode + UserSelector
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

- [x] 5. Responsive BarcodeInput (Req 2)
  - [x] 5.1 In `app/components/BarcodeInput.vue`, change `UInput` class from `w-56` to `w-full md:w-56`
    - _Requirements: 2.1, 2.2, 2.4_

- [x] 6. Responsive UserSelector (Req 6)
  - [x] 6.1 In `app/components/UserSelector.vue`, render two `UButton` variants: icon-only (`md:hidden`) and full-label (`hidden md:inline-flex`)
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 7. JobMobileCard Component (Req 4)
  - [x] 7.1 Create `app/components/JobMobileCard.vue` with props `job: Job` and `progress: JobProgress | null`
    - _Requirements: 4.2, 4.3, 4.4_

- [x] 8. Jobs Page Responsive View (Req 4)
  - [x] 8.1 In `app/pages/jobs/index.vue`, use `useMobileBreakpoint` to conditionally show UTable (desktop) or JobMobileCard list (mobile)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 9. Checkpoint — All tests pass (891 tests, 152 files)

- [x] 10. Unit Tests
  - [x] 10.1 Write `tests/unit/components/JobMobileCard.test.ts` (9 tests)
    - _Requirements: 4.3_
  - [x] 10.2 Write property test `tests/properties/jobMobileCard.test.ts` (5 tests)
    - **Property 1: JobMobileCard Field Rendering**
    - _Requirements: 4.3, 4.5_

- [x] 11. Final Verification
  - [x] 11.1 Run `npm run test` — 891 tests pass across 152 files
  - [x] 11.2 Run `npm run typecheck` — no new type errors introduced

- [x] 12. Global Overflow Prevention (Req 7)
  - [x] 12.1 Add `* { min-width: 0 }` to `app/assets/css/main.css` to force flex/grid children to shrink
  - [x] 12.2 Add `overflow-wrap: break-word; word-break: break-word` to body
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 13. StepTracker Mobile Layout (Req 8)
  - [x] 13.1 Vertical stack on mobile with down-arrows; horizontal row layout per card (info left, stats right, assignee below)
  - [x] 13.2 Desktop keeps original horizontal flex-wrap with right-arrows and centered compact cards
  - [x] 13.3 "Done" column: horizontal layout on mobile, centered on desktop
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 14. Parts Browser Mobile Layout (Req 9)
  - [x] 14.1 Desktop table hidden on mobile (`hidden md:block`), card list shown (`md:hidden`)
  - [x] 14.2 Each card shows part ID, job name, step, status badge, assignee
  - [x] 14.3 Search input changed to `w-full md:w-56`
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 15. Job Parts Tab Mobile Layout (Req 10)
  - [x] 15.1 Desktop table hidden on mobile, card list shown with advance/scrap action buttons
  - [x] 15.2 Filter inputs changed to responsive widths (`w-full md:w-32`, `w-full md:w-36`)
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 16. Settings Page Tab Responsiveness (Req 11)
  - [x] 16.1 Tab bar container: `overflow-x-auto`; tab buttons: `whitespace-nowrap shrink-0`
    - _Requirements: 11.1, 11.2, 11.3_

- [x] 17. Templates Page Step Row Wrapping (Req 12)
  - [x] 17.1 Added `flex-wrap` to step editor rows
    - _Requirements: 12.1_

## Notes

- Breakpoint strategy uses Tailwind's `md` (768px) as the primary mobile/desktop threshold, consistent with Nuxt UI's dashboard component conventions
- No new npm packages required — leverages Nuxt UI's built-in `UDashboardNavbar` + `UDashboardSidebarToggle` and Tailwind responsive utilities
- Disabling pinch zoom (`user-scalable=no`) is an intentional accessibility trade-off for the native-app-like experience
- `useDashboardSidebar()` composable does NOT exist in Nuxt UI v4 — sidebar toggle is handled by `UDashboardNavbar` automatically
- Global `* { min-width: 0 }` prevents flex/grid overflow without clipping content
