# Requirements: Mobile Responsiveness

## Requirement 1: Mobile Navigation (#39)

### Description
Provide mobile navigation via a hamburger menu that opens the sidebar as a drawer overlay, so users are no longer trapped on mobile.

### Acceptance Criteria
- 1.1 A toggle button is visible in the header navbar on viewports narrower than 768px (provided by `UDashboardNavbar`'s built-in `UDashboardSidebarToggle`)
- 1.2 The toggle button is hidden on viewports 768px and wider
- 1.3 Tapping the toggle button opens the sidebar as a full-height drawer overlay (via `UDashboardSidebar`'s built-in mobile drawer mode)
- 1.4 The sidebar drawer closes automatically after navigating to a new route (via `UDashboardSidebar`'s `autoClose` prop, default `true`)
- 1.5 All navigation items from the sidebar (Dashboard, Jobs, Parts Browser, etc.) are accessible in the mobile drawer
- 1.6 The drawer can be dismissed by tapping outside the overlay area

### Correctness Properties
- **Property 1.5**: ∀ nav item `n` in `filteredNavItems`: `n` is rendered and clickable in the mobile sidebar drawer.

---

## Requirement 2: Responsive Header (#42)

### Description
Make the dashboard header responsive so that the barcode search/scan input and QR scanner button are never cut off on mobile viewports.

### Acceptance Criteria
- 2.1 BarcodeInput uses full available width on mobile (flex-1) and fixed width (w-56) on desktop
- 2.2 The QR scanner camera button remains visible and clickable on all viewports
- 2.3 The header uses `UDashboardNavbar` with `left` slot (barcode input) and `right` slot (color mode, user selector); the navbar automatically renders the sidebar toggle on mobile
- 2.4 No header element is clipped or overflows the viewport at widths down to 320px

### Correctness Properties
- **Property 2.1**: ∀ viewport width `w` where 320 ≤ w < 768: BarcodeInput container has CSS class `flex-1` and fills remaining header space.

---

## Requirement 3: Color Mode Toggle Accessibility (#41)

### Description
Make the dark mode toggle accessible on mobile by adding it to the header, since the sidebar footer is hidden on mobile.

### Acceptance Criteria
- 3.1 A `UColorModeButton` is rendered in the header on all viewports (mobile and desktop)
- 3.2 The `UColorModeButton` remains in the sidebar footer for desktop convenience (dual placement)
- 3.3 Clicking the header color mode button toggles between light and dark mode

### Correctness Properties
- **Property 3.1**: ∀ viewport width `w`: the header contains exactly one `UColorModeButton` that is visible and interactive.

---

## Requirement 4: Jobs Table Mobile Layout (#40)

### Description
Replace the overflowing jobs table with a card-based layout on mobile so all job data is visible without horizontal scrolling.

### Acceptance Criteria
- 4.1 On viewports 768px and wider, the existing `UTable` with all columns (expand, name, part #, goal qty, progress, priority) is displayed
- 4.2 On viewports narrower than 768px, a list of `JobMobileCard` components is displayed instead of the table
- 4.3 Each `JobMobileCard` displays the job name, part number, goal quantity, progress bar, and priority
- 4.4 Tapping a `JobMobileCard` navigates to the job detail page (`/jobs/:id`)
- 4.5 The mobile card list and desktop table render the same set of `filteredJobs`
- 4.6 Empty state and loading state are shown identically on both mobile and desktop

### Correctness Properties
- **Property 4.3**: ∀ job `j` with non-null fields: `JobMobileCard` renders `j.name`, and conditionally renders `j.jiraPartNumber`, `j.goalQuantity`, `j.jiraPriority`, and progress bar when `progress` is provided.
- **Property 4.5**: ∀ array `jobs` of filtered jobs: the set of job IDs rendered in mobile card view equals the set rendered in desktop table view.

---

## Requirement 5: Disable Pinch Zoom

### Description
Add viewport meta attributes to prevent pinch-to-zoom, treating the app as a native-like mobile experience.

### Acceptance Criteria
- 5.1 The viewport meta tag in `app.vue` includes `maximum-scale=1` and `user-scalable=no`
- 5.2 The viewport meta tag retains `width=device-width` and `initial-scale=1`

### Correctness Properties
- **Property 5.1**: The document head viewport meta content string contains both `maximum-scale=1` and `user-scalable=no`.

---

## Requirement 6: Responsive UserSelector

### Description
Make the user selector compact on mobile to prevent header overflow.

### Acceptance Criteria
- 6.1 On viewports narrower than 768px, the UserSelector shows only the user icon (no label text, no chevron)
- 6.2 On viewports 768px and wider, the UserSelector shows the full label text and trailing chevron icon
- 6.3 The dropdown menu functionality works identically on both mobile and desktop

### Correctness Properties
- **Property 6.1**: ∀ viewport width `w` < 768: UserSelector button renders with icon only and no visible label text.

---

## Requirement 7: Global Overflow Prevention

### Description
Prevent horizontal scrolling on all pages by applying global CSS rules that force content to wrap and respect container boundaries.

### Acceptance Criteria
- 7.1 `* { min-width: 0 }` is applied globally so flex/grid children shrink to fit their containers
- 7.2 `overflow-wrap: break-word` and `word-break: break-word` are applied to `body` so long strings wrap
- 7.3 No page produces a horizontal scrollbar at any viewport width ≥ 320px

---

## Requirement 8: StepTracker Mobile Layout

### Description
Replace the horizontal step card row with a vertical stacked layout on mobile, using a horizontal row layout within each card (info left, stats right, assignee below).

### Acceptance Criteria
- 8.1 On viewports narrower than 768px, step cards stack vertically with down-arrows between them
- 8.2 Each mobile step card uses a horizontal layout: step name/location left-aligned, part count/done count right-aligned, assignee dropdown spanning full width below
- 8.3 On viewports 768px and wider, the existing horizontal flex-wrap layout with right-arrows is preserved
- 8.4 The "Done" column uses a horizontal layout on mobile (icon + label left, count right)

---

## Requirement 9: Parts Browser Mobile Layout

### Description
Replace the parts browser table with a card-based layout on mobile so all part data is visible without horizontal scrolling.

### Acceptance Criteria
- 9.1 On viewports 768px and wider, the existing sortable table is displayed
- 9.2 On viewports narrower than 768px, a list of part cards is displayed instead of the table
- 9.3 Each part card displays the part ID, job name, current step, status badge, and assignee
- 9.4 Tapping a part card navigates to the part detail page

---

## Requirement 10: Job Parts Tab Mobile Layout

### Description
Replace the job parts tab table with a card-based layout on mobile.

### Acceptance Criteria
- 10.1 On viewports 768px and wider, the existing parts table with sorting is displayed
- 10.2 On viewports narrower than 768px, a list of part cards is displayed instead of the table
- 10.3 Each part card displays the part ID, path name, current step, status badge, and action buttons (advance/scrap for in-progress parts)
- 10.4 Filter inputs use responsive widths (`w-full md:w-32`)

---

## Requirement 11: Settings Page Tab Responsiveness

### Description
Make the settings page tab bar scrollable on mobile instead of overflowing the page.

### Acceptance Criteria
- 11.1 The tab bar container has `overflow-x-auto` to allow horizontal scrolling within the tab area
- 11.2 Tab buttons use `whitespace-nowrap shrink-0` to prevent text compression
- 11.3 The tab bar does not cause the page to scroll horizontally

---

## Requirement 12: Templates Page Step Row Wrapping

### Description
Make the template step editor rows wrap on mobile instead of overflowing.

### Acceptance Criteria
- 12.1 Step editor rows use `flex-wrap` so controls wrap to the next line on narrow viewports