# Implementation Plan: API Documentation CMS

## Overview

Build an integrated API documentation site using Nuxt Content v3 within the existing Shop Planr Nuxt 4 app. The implementation proceeds incrementally: install the module, create the content structure, build the UI components and layout, wire up navigation and search, add the sidebar entry point, and author all 52+ endpoint docs.

## Tasks

- [x] 1. Install Nuxt Content v3 and configure the module
  - Install `@nuxt/content` package
  - Add `'@nuxt/content'` to the `modules` array in `nuxt.config.ts`
  - Add a `content: {}` config block if needed for defaults
  - Verify the dev server starts without errors after adding the module
  - _Requirements: 10.3, 11.1, 11.3_

- [ ] 2. Create content directory structure and seed content files
  - [x] 2.1 Create root overview and category index files
    - Create `content/api-docs/index.md` with API overview and getting-started guide
    - Create subdirectories for all 14 service domains: jobs, paths, serials, certs, templates, bom, audit, jira, settings, users, notes, operator, steps, library
    - Create `index.md` in each subdirectory with title, description, icon, and `navigation.order` frontmatter
    - _Requirements: 1.1, 1.2, 1.3, 2.5_

  - [x] 2.2 Author endpoint documentation files for jobs, paths, and serials
    - Create endpoint `.md` files for all routes under `/api/jobs/**`, `/api/paths/**`, `/api/serials/**`
    - Each file must have complete frontmatter: title, method, path, service, category, requestBody, responseType, errorCodes, navigation.order
    - Include request/response tables, example JSON, and error code documentation using `::endpoint-card` MDC syntax
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1_

  - [x] 2.3 Author endpoint documentation files for certs, templates, and bom
    - Create endpoint `.md` files for all routes under `/api/certs/**`, `/api/templates/**`, `/api/bom/**`
    - Same frontmatter and content structure as 2.2
    - _Requirements: 2.1, 2.2, 3.1_

  - [x] 2.4 Author endpoint documentation files for remaining services
    - Create endpoint `.md` files for all routes under `/api/audit/**`, `/api/jira/**`, `/api/settings/**`, `/api/users/**`, `/api/notes/**`, `/api/operator/**`, `/api/steps/**`, `/api/library/**`
    - Same frontmatter and content structure as 2.2
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [x] 2.5 Write property test: Content directory structure completeness (Property 2)
    - **Property 2: Content directory structure completeness**
    - For any service domain subdirectory in `content/api-docs/`, verify it contains an `index.md` with title, description, icon, and navigation order frontmatter
    - Test file: `tests/properties/docsDirectoryCompleteness.property.test.ts`
    - **Validates: Requirements 1.2, 2.5**

  - [x] 2.6 Write property test: Endpoint frontmatter validity (Property 3)
    - **Property 3: Endpoint frontmatter validity**
    - For any endpoint doc, verify frontmatter contains all required fields (title, method, path, service, category) and method is one of GET, POST, PUT, PATCH, DELETE
    - Test file: `tests/properties/docsFrontmatterValidity.property.test.ts`
    - **Validates: Requirements 2.1, 2.2**

- [x] 3. Checkpoint — Verify content parses correctly
  - Ensure the dev server starts and Nuxt Content indexes all markdown files without errors
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement EndpointCard MDC component
  - [x] 4.1 Create `app/components/docs/EndpointCard.vue`
    - Accept props: `method` (GET|POST|PUT|PATCH|DELETE), `path` (string), `description` (string, optional)
    - Render color-coded method badge: GET=green, POST=blue, PUT=amber, DELETE=red, PATCH=purple
    - Display endpoint path in monospace font
    - Wrap slot content in collapsible sections
    - Handle missing/empty description gracefully (no description block rendered)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 10.1_

  - [x] 4.2 Write property test: Method badge color mapping (Property 8)
    - **Property 8: Method badge color mapping**
    - For any valid HTTP method string, the badge color mapping returns the defined color
    - Test file: `tests/properties/docsMethodBadgeColor.property.test.ts`
    - **Validates: Requirement 8.1**

  - [x] 4.3 Write unit tests for EndpointCard
    - Test rendering with each HTTP method produces correct badge color
    - Test missing description prop renders without error
    - Test slot content renders inside collapsible section
    - Test file: `tests/unit/components/EndpointCard.test.ts`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 5. Implement DocsSidebar component and useDocsNavigation composable
  - [x] 5.1 Create `app/composables/useDocsNavigation.ts`
    - Return `navigation` (Ref of NavigationItem[]), `currentCategory` (ComputedRef), and `isActive(path)` function
    - Use Nuxt Content's `fetchContentNavigation()` to build the tree
    - _Requirements: 6.1, 6.5_

  - [x] 5.2 Create `app/components/docs/DocsSidebar.vue`
    - Accept props: `navigation` (ContentNavigationItem[]) and `currentPath` (string)
    - Render nested navigation tree grouped by service domain category
    - Highlight the currently active page
    - Display HTTP method badges next to endpoint page links
    - Sort items by `navigation.order` at every nesting level
    - Support expand/collapse for category groups
    - Show empty state when no documentation is available
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 10.2_

  - [x] 5.3 Write property test: Navigation tree ordering (Property 6)
    - **Property 6: Navigation tree ordering**
    - For any set of navigation items at any nesting level, items are sorted ascending by `navigation.order`
    - Test file: `tests/properties/docsNavOrdering.property.test.ts`
    - **Validates: Requirement 6.5**

- [ ] 6. Implement DocsSearch component and useDocsSearch composable
  - [x] 6.1 Create `app/composables/useDocsSearch.ts`
    - Return `query` (Ref<string>), `results` (Ref<SearchResult[]>), `isSearching` (Ref<boolean>), and `search()` function
    - Debounce input for 300ms before executing search
    - Scope results to `/api-docs` path only using Nuxt Content's `searchContent()`
    - _Requirements: 7.1, 7.2_

  - [x] 6.2 Create `app/components/docs/DocsSearch.vue`
    - Debounced search input field
    - Display results with title, path, and content snippet
    - Navigate to selected result on click
    - Show empty-state message when no results found
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 6.3 Write property test: Search result scoping (Property 7)
    - **Property 7: Search result scoping**
    - For any search query, all returned results have paths starting with `/api-docs`
    - Test file: `tests/properties/docsSearchScoping.property.test.ts`
    - **Validates: Requirement 7.2**

- [ ] 7. Implement Docs Layout and catch-all page
  - [x] 7.1 Create `app/layouts/docs.vue`
    - Render DocsSidebar, DocsSearch, and main content area
    - Display breadcrumb trail based on current URL slug
    - Collapse sidebar into toggleable panel on mobile viewports
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 7.2 Create `app/pages/api-docs/[...slug].vue`
    - Use `definePageMeta({ layout: 'docs' })` to activate docs layout
    - Resolve URL slug to content file via `queryContent(route.path).findOne()`
    - Render markdown content with `<ContentRenderer>`
    - Cache navigation tree client-side via `useAsyncData`
    - Display previous/next navigation links
    - Return 404 error with link back to docs index when no matching content
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 11.2_

  - [x] 7.3 Write property test: Slug resolution correctness (Property 5)
    - **Property 5: Slug resolution correctness**
    - For any valid content file path in `content/api-docs/`, the URL slug `/api-docs/{slug}` resolves to that file
    - Test file: `tests/properties/docsSlugResolution.property.test.ts`
    - **Validates: Requirements 4.1, 4.3**

- [x] 8. Checkpoint — Verify docs pages render end-to-end
  - Ensure all tests pass, ask the user if questions arise.
  - Verify navigating to `/api-docs`, `/api-docs/jobs`, and `/api-docs/jobs/create` renders correctly

- [ ] 9. Add sidebar entry point in default layout
  - [x] 9.1 Add "API Docs" link to `app/layouts/default.vue` sidebar footer
    - Add a NuxtLink to `/api-docs` with `target="_blank"` in the `#footer` template slot of `UDashboardSidebar`
    - Include book icon (`i-lucide-book-open`) and external-link indicator (`i-lucide-external-link`)
    - Style consistently with existing sidebar (muted text, hover states)
    - Respect sidebar collapsed state (icon-only when collapsed)
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 10. Final checkpoint — Full integration verification
  - Ensure all tests pass, ask the user if questions arise.
  - Verify sidebar entry point opens docs in new tab
  - Verify search returns results scoped to api-docs
  - Verify 404 handling for nonexistent slugs

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The project uses TypeScript, Vue 3, Nuxt UI 4, and fast-check for property-based tests
- Content files are authored as Markdown with YAML frontmatter and MDC component syntax
