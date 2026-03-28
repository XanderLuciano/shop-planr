# Requirements Document

## Introduction

Shop Planr requires an integrated API documentation CMS that catalogs all 52+ REST endpoints across 14 route prefixes. The system uses Nuxt Content v3 to render Markdown-authored documentation files into browsable pages under `/api-docs`, with sidebar navigation, full-text search, and styled endpoint cards. Documentation is co-located with the codebase, version-controlled, and deployed with the app.

## Glossary

- **Docs_CMS**: The API documentation content management system built with Nuxt Content v3, serving pages under the `/api-docs` route prefix
- **Content_Directory**: The `content/api-docs/` directory containing Markdown documentation files organized by service domain
- **Endpoint_Doc**: A Markdown file in the Content_Directory representing a single API endpoint, with YAML frontmatter metadata
- **Category_Index**: An `index.md` file within a service domain subdirectory providing an overview of that API category
- **Docs_Layout**: The `docs.vue` layout providing sidebar navigation, search, and content area for documentation pages
- **Catch_All_Page**: The `[...slug].vue` page component that resolves URL slugs to content files and renders them
- **EndpointCard**: An MDC component used in Markdown files to render styled API endpoint blocks with method badge, path, and collapsible sections
- **Docs_Sidebar**: The navigation component rendering a tree of documentation pages grouped by service domain
- **Docs_Search**: The search component providing full-text search across all documentation content
- **Sidebar_Entry**: The "API Docs" button in the main app's default layout sidebar footer that opens documentation in a new tab
- **Navigation_Tree**: The hierarchical structure of documentation pages auto-generated from the Content_Directory structure and frontmatter ordering
- **Frontmatter**: YAML metadata at the top of each Markdown file containing fields like title, method, path, service, and category

## Requirements

### Requirement 1: Content Directory Structure

**User Story:** As a developer, I want API documentation organized by service domain in the content directory, so that documentation mirrors the codebase structure and is easy to maintain.

#### Acceptance Criteria

1. THE Content_Directory SHALL contain subdirectories for each service domain (jobs, paths, serials, certs, templates, bom, audit, jira, settings, users, notes, operator, steps, library)
2. WHEN a new service domain subdirectory is created, THE Content_Directory SHALL contain a Category_Index file (`index.md`) within that subdirectory
3. THE Content_Directory SHALL contain a root `index.md` file providing an API overview and getting-started guide

### Requirement 2: Endpoint Documentation Frontmatter

**User Story:** As a developer, I want each endpoint documentation file to have structured metadata, so that the CMS can generate navigation, badges, and cross-references automatically.

#### Acceptance Criteria

1. THE Endpoint_Doc SHALL contain frontmatter with all required fields: title, method, path, service, and category
2. WHEN an Endpoint_Doc specifies a `method` field, THE Endpoint_Doc SHALL use one of the valid HTTP method values: GET, POST, PUT, PATCH, or DELETE
3. WHEN an Endpoint_Doc specifies a `requestBody` field, THE Endpoint_Doc SHALL reference a TypeScript interface name that exists in the project type definitions
4. WHEN an Endpoint_Doc specifies a `responseType` field, THE Endpoint_Doc SHALL reference a TypeScript interface name that exists in the project type definitions
5. THE Category_Index SHALL contain frontmatter with title, description, icon, and navigation order fields

### Requirement 3: API Route Documentation Coverage

**User Story:** As a developer, I want every API route to have corresponding documentation, so that the documentation site is a complete reference for the entire API surface.

#### Acceptance Criteria

1. FOR ALL API routes in `server/api/`, THE Content_Directory SHALL contain a corresponding Endpoint_Doc with matching path and HTTP method
2. WHEN a new API route is added to the server, THE Content_Directory SHALL be updated with a corresponding Endpoint_Doc

### Requirement 4: Documentation Page Rendering

**User Story:** As a user, I want to browse API documentation pages by navigating to their URL, so that I can read endpoint details in a well-formatted layout.

#### Acceptance Criteria

1. WHEN a user navigates to `/api-docs/{slug}`, THE Catch_All_Page SHALL resolve the slug to the corresponding content file and render the Markdown content
2. WHEN a user navigates to `/api-docs`, THE Catch_All_Page SHALL render the root overview page from `content/api-docs/index.md`
3. WHEN a user navigates to `/api-docs/{category}`, THE Catch_All_Page SHALL render the Category_Index page for that service domain
4. IF a user navigates to a slug with no matching content file, THEN THE Catch_All_Page SHALL return a 404 error page with a link back to the docs index
5. THE Catch_All_Page SHALL use the Docs_Layout for rendering documentation pages
6. THE Catch_All_Page SHALL display previous and next navigation links for sequential browsing

### Requirement 5: Docs Layout

**User Story:** As a user, I want a documentation-specific layout with sidebar and search, so that I can navigate and find API information efficiently.

#### Acceptance Criteria

1. THE Docs_Layout SHALL render the Docs_Sidebar, Docs_Search, and a main content area
2. THE Docs_Layout SHALL display a breadcrumb trail based on the current URL slug
3. WHEN the viewport is mobile-sized, THE Docs_Layout SHALL collapse the sidebar into a toggleable panel

### Requirement 6: Sidebar Navigation

**User Story:** As a user, I want a sidebar navigation tree grouped by service domain, so that I can browse all available API endpoints organized by category.

#### Acceptance Criteria

1. THE Docs_Sidebar SHALL render a nested navigation tree generated from the Content_Directory structure
2. THE Docs_Sidebar SHALL group endpoint pages under their parent service domain category
3. WHEN a user views a documentation page, THE Docs_Sidebar SHALL highlight the currently active page in the navigation tree
4. THE Docs_Sidebar SHALL display HTTP method badges next to endpoint page links
5. THE Docs_Sidebar SHALL sort navigation items by the `navigation.order` frontmatter field at every nesting level
6. THE Docs_Sidebar SHALL support expand and collapse interactions for category groups

### Requirement 7: Documentation Search

**User Story:** As a user, I want to search across all API documentation content, so that I can quickly find endpoints and information by keyword.

#### Acceptance Criteria

1. WHEN a user types a search query, THE Docs_Search SHALL debounce the input for 300 milliseconds before executing the search
2. WHEN a search is executed, THE Docs_Search SHALL return results scoped to content under the `/api-docs` path only
3. WHEN search results are displayed, THE Docs_Search SHALL show each result with its title, path, and a content snippet
4. WHEN a user selects a search result, THE Docs_Search SHALL navigate to the selected documentation page
5. IF a search query returns no results, THEN THE Docs_Search SHALL display an empty-state message

### Requirement 8: EndpointCard MDC Component

**User Story:** As a documentation author, I want a styled endpoint card component usable in Markdown, so that API endpoint blocks are visually consistent and informative.

#### Acceptance Criteria

1. THE EndpointCard SHALL render a color-coded method badge based on the HTTP method: GET as green, POST as blue, PUT as amber, DELETE as red, PATCH as purple
2. THE EndpointCard SHALL display the endpoint path in a monospace font
3. WHEN the EndpointCard contains child content, THE EndpointCard SHALL wrap the child content in collapsible sections for request and response documentation
4. IF the EndpointCard receives a missing or empty description prop, THEN THE EndpointCard SHALL render gracefully without displaying a description block

### Requirement 9: Sidebar Entry Point

**User Story:** As an app user, I want an entry point in the main app sidebar to access API documentation, so that I can reach the docs without memorizing the URL.

#### Acceptance Criteria

1. THE Sidebar_Entry SHALL render an "API Docs" link with a book icon and external-link indicator in the footer area of the default layout sidebar
2. WHEN a user clicks the Sidebar_Entry, THE Sidebar_Entry SHALL open the `/api-docs` page in a new browser tab
3. WHEN the sidebar is in collapsed state, THE Sidebar_Entry SHALL display only the icon without text

### Requirement 10: Error Handling

**User Story:** As a user, I want graceful error handling when documentation content is missing or malformed, so that I always see a helpful response instead of a broken page.

#### Acceptance Criteria

1. IF a content file has invalid or missing YAML frontmatter, THEN THE EndpointCard SHALL render with fallback text for missing fields
2. IF the Content_Directory does not exist, THEN THE Docs_Sidebar SHALL display an empty state indicating no documentation is available
3. IF the `@nuxt/content` module is not installed, THEN THE Docs_CMS SHALL fail at build time with a clear module resolution error

### Requirement 11: Performance

**User Story:** As a user, I want documentation pages to load quickly, so that browsing the API reference is a smooth experience.

#### Acceptance Criteria

1. THE Docs_CMS SHALL pre-parse Markdown content at build time to avoid runtime parsing overhead
2. THE Catch_All_Page SHALL cache the Navigation_Tree client-side via `useAsyncData` to avoid redundant fetches
3. THE Docs_Search SHALL use Nuxt Content's built-in MiniSearch index for search without requiring an external search service
