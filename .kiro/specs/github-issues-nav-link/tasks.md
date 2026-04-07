# Implementation Plan: GitHub Issues Nav Link

## Overview

Add a "Report Issue" `NuxtLink` to the sidebar footer in `app/layouts/default.vue`, positioned between the existing "API Docs" link and the collapse/color-mode row. The link opens the project's GitHub Issues page in a new tab. This is a single-file, markup-only change following the exact pattern of the existing API Docs link.

## Tasks

- [x] 1. Add GitHub Issues NuxtLink to sidebar footer
  - Open `app/layouts/default.vue`
  - In the `#footer` template slot, insert a new `NuxtLink` immediately after the existing API Docs `NuxtLink` and before the collapse/color-mode `<div>`
  - Set `to` to the project's GitHub Issues URL (e.g. `https://github.com/<owner>/<repo>/issues`)
  - Set `target="_blank"` and `rel="noopener noreferrer"`
  - Use the same CSS classes as the API Docs link: `flex items-center gap-2 px-2 py-1.5 text-sm text-(--ui-text-muted) hover:text-(--ui-text-highlighted) rounded-md hover:bg-(--ui-bg-elevated) transition-colors`
  - Add `<UIcon name="i-lucide-bug" class="size-4" />` as the leading icon
  - Add `<span class="truncate group-data-[collapsed]:hidden">Report Issue</span>` as the label
  - Add `<UIcon name="i-lucide-external-link" class="size-3 ml-auto opacity-50 group-data-[collapsed]:hidden" />` as the trailing icon
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 4.1, 4.2, 5.1, 6.1, 6.2_

- [x] 2. Final checkpoint — Verify implementation
  - Ensure no lint or type errors in `app/layouts/default.vue`
  - Confirm the new link uses identical markup pattern as the API Docs link
  - Confirm no new files were created (no components, composables, API routes, or server changes)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- This is a single-file change to `app/layouts/default.vue` — no other files are modified
- No property-based tests or unit tests are needed (static markup, no logic)
- The GitHub Issues URL placeholder `<owner>/<repo>` should be replaced with the actual repository owner and name during implementation
