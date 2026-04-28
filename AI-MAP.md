# AI-MAP — Shop Planr Quick Reference

> Master index for AI agents. Consult this FIRST before searching the codebase.
> For deeper dives, see sub-maps in `.ai/` folder.

## Project Overview

Shop Planr (package name: `shop-erp`) is a job routing and ERP application for machine shops. It tracks production orders (Jobs) through multi-path routing of parts across sequential Process Steps, with serial number management, certificate traceability, progress visualization, and optional Jira integration. Built as a full-stack Nuxt 4 app with SQLite persistence.

**Status**: All features implemented. Job lifecycle management added (scrap, force-complete, flexible advancement, step overrides, waivers, BOM versioning, process/location libraries). Dedicated job creation/edit pages. Serial detail page Routing tab reorganized into SectionCard sections. First-step serial creation panel (SerialCreationPanel) for operator work queue. Operator view redesigned: monolithic operator.vue split into Parts View (/parts), Step View (/parts/step/[stepId]), and Operator Work Queue (/queue). Inline note creation on serial detail page. Step overflow UX: StepTracker uses flex-wrap instead of horizontal scroll, compact step cards, condensed serial counts. Nav page toggles: Settings → Page Visibility tab to hide/show sidebar pages, with route middleware guard and reactive sidebar filtering. Step 1 disabled-after-advance bugfix: zero-serial steps return 200 with partCount:0 instead of 404; first steps always visible in Parts View; prev/next step navigation; deduplicated step headers. Page toggle refresh bugfix: `app/plugins/settings.ts` plugin fetches settings once on app init so sidebar filtering and route middleware have correct toggle state on every page load (no flash, no stale fallback). Nav jobs-to-steps back arrow bugfix: Step View back arrow is context-aware via `from` query parameter, returning to Job detail when navigated from there. Job-step dashboard redirect bugfix: `ALWAYS_ENABLED_ROUTES` constant in `pageToggles.ts` ensures `/parts/step/*` routes are always accessible regardless of the `parts` toggle state. API Documentation: Nitro OpenAPI 3.1 with `defineRouteMeta` on all ~85 routes; Scalar UI at `/_scalar`; Zod schemas auto-converted via `zodRequestBody()` helper; replaces old Nuxt Content v3 hand-maintained docs. FK-safe path update: `reconcileSteps()` pure function + `hasStepDependents()` guard replaces delete-and-recreate strategy in `pathService.updatePath()` and `SQLitePathRepository.update()`, preserving step IDs and FK references during path edits (GitHub Issue #9). Path "Done" total fix: `getPathCompletedCount()` returns path-level completed count separately; `getStepDistribution()` no longer copies completed count onto every step entry; API returns `completedCount` as top-level field; frontend uses it directly instead of buggy `.reduce()` sum (GitHub Issue #24). Step "Done" count fix: `getStepDistribution()` now computes correct per-step `completedCount` (parts past step OR completed) instead of hardcoded 0; uses single `listByPathId` query with in-memory filtering instead of N per-step queries (GitHub Issue #50). Job view utilities: JobViewToolbar component with expand/collapse all jobs and paths buttons; JobExpandableRow upgraded to multi-path expansion (Set-based) with signal-driven bulk expand/collapse and throttled concurrent fetching (GitHub Issue #4). Job delete: `deleteJob` + `canDeleteJob` on jobService with safety checks (paths, parts, BOM refs), `DELETE /api/jobs/:id` API route, `countContributingJobRefs` on BomRepository, delete button + confirmation modal on job detail page, 5 property tests (GitHub Issue #46). User admin roles: ShopUser extended with `username` (unique), `displayName`, `isAdmin`; migration 009 replaces `name` column with dedup logic; `useUsers()` composable exposes reactive `isAdmin` computed; job creation, job deletion, and path deletion gated behind admin flag; Admin badge in Settings user list; 8 property tests. Job priority: `priority` INTEGER column on jobs table (migration 010), `bulkUpdatePriority` + `getMaxPriority` on JobRepository, `updatePriorities` on jobService with full validation, `PATCH /api/jobs/priorities` endpoint, `useJobPriority` composable for drag-and-drop editing, priority edit mode on Jobs page (desktop table + mobile cards), 7 property tests + 8 unit tests (GitHub Issue #71). HTTP error handler: centralized `defineApiHandler()` wrapper in `server/utils/httpError.ts` replaces duplicated try/catch blocks across all ~65 API routes; data-driven error-to-HTTP mapping with correct RFC 9110 statusMessage fields; 4 property tests + 11 unit tests (GitHub Issue #28). Admin path delete: admin force-delete for paths with cascade deletion of all dependent records (notes, overrides, cert attachments, step statuses, parts) in FK-safe order within a single transaction; `ForbiddenError` class + 403 HTTP mapping; server-side admin authorization via `userId` in request body; `path_deleted` audit trail entry with deleted part IDs; `PathDeleteButton` updated with UModal confirmation for paths with parts, inline confirmation for zero-part paths; parts browser gains "Scrapped" status filter option; 4 property tests + 12 unit tests. Admin part delete: `deletePart` on partService with admin check + cascade (cert attachments, part step overrides, part step statuses) in a single transaction; `delete(id)` method on PartRepository; `DELETE /api/parts/:id` route with Zod-validated id param via `partSchemas.ts`; `recordPartDeletion` + `part_deleted` audit action; `PartDeleteButton` component on part detail page (`/parts-browser/:id`) with UModal confirmation, admin-gated via `useAuth().isAdmin`; navigates back to parts browser after deletion; 12 service unit tests + 4 schema tests + 15 component tests. Full frontend with lifecycle dialogs, configuration panels, and audit filters. Bulk API endpoints: 5 new bulk endpoints replacing N+1 HTTP call patterns — `POST /api/paths/batch-distributions` (bulk path distributions), `POST /api/parts/batch-step-statuses` (bulk step statuses), `POST /api/parts/advance-to` (batch advance-to-step), `GET /api/notes/path/:pathId` (notes by path), `POST /api/jobs/:id/paths/batch` (batch path create/update/delete); all frontend callers updated (`JobExpandableRow`, `jobs/[id].vue`, `parts/step/[stepId].vue`, `ProcessAdvancementPanel`, `skipStep.ts`, `AdvanceToStepDropdown`, `useJobForm`); Zod schemas for all request bodies; `NoteRepository.listByPathId()` + `noteService.getNotesForPath()` added; `useLifecycle.batchAdvanceToStep()` composable method; `SkipStepParams` interface migrated from single-part to bulk.

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Nuxt 4.2.2 (Vue 3, Nitro server) |
| UI Library | Nuxt UI 4.3.0 (Tailwind CSS v4, Reka UI) |
| API Docs | Nitro OpenAPI 3.1 + Scalar UI (auto-generated from route metadata + Zod schemas) |
| Language | TypeScript 5.9 |
| Icons | `@iconify-json/lucide` |
| Database | SQLite via `better-sqlite3` |
| ID Generation | `nanoid` |
| Validation | `zod` (API request body schemas) |
| Testing | Vitest 3.2 + `happy-dom` + `fast-check` (PBT) + `tsx` (seed scripts) |
| Linting | ESLint 9 via `@nuxt/eslint` |
| Deployment | Docker (single container, copies `.output/`) |
| Font | Public Sans (custom) |

## Project Structure

```
app/
  app.vue                → Root layout: UApp + UDashboardGroup + sidebar nav
  app.config.ts          → UI color config (primary: violet, neutral: neutral)
  pages/
    index.vue            → Placeholder homepage (to become dashboard)
  components/            → 50+ components: SectionCard (reusable card wrapper), lifecycle dialogs (ScrapDialog, ForceCompleteDialog, AdvanceToStepDropdown), config panels (StepConfigPanel, AdvancementModeSelector, LibraryManager), job form (JobCreationForm), serial creation (SerialCreationPanel — first-step batch creation + advancement), page visibility (PageVisibilitySettings — toggle switches for nav pages), job view (JobViewToolbar — expand/collapse all jobs/paths buttons, JobExpandableRow — multi-path expansion with bulk signals, JobMobileCard — card-based job display for mobile viewports, JobTagPill — colored pill badge for tags), job tags (TagManager — Settings CRUD with color picker + usage count, TagSelector — multi-select dropdown with inline create), work queue (WorkQueueFilterBar — group-by selector, filter dropdowns, text search, preset management), audit (AuditLog — responsive table/card switch via useMobileBreakpoint, AuditEntryCard — mobile card layout, AuditTrailFilters — collapsible filter panel with active-count badge on mobile), utility (BonusBadge, PathDeleteButton, PartDeleteButton, CertDetailView, TemplateEditor, ViewFilters — filter bar with tag dropdown + group-by-tag toggle, etc.)
  composables/           → 25+ composables: useAuth (session/token/user), useAuthFetch (authenticated $fetch instance), useJobForm, useLifecycle, useLibrary, useBomVersions, useAudit (with filters), usePartsView, useStepView, useOperatorWorkQueue (extended with groupBy param), useWorkQueueFilters (wraps useOperatorWorkQueue with groupBy/filter/preset/URL-sync), useAdvanceBatch (extracted advanceBatch() with client-side validation), useSettings (extended with pageToggles), useMobileBreakpoint (matchMedia-based mobile viewport detection), useJobPriority (drag-and-drop priority editing), useNavigationStack (stack-based back navigation via sessionStorage), useTags (singleton tag list CRUD), useJobTags (per-instance job tag assignment), useViewFilters (client-side filtering with tag + groupByTag support) + existing ones
  middleware/
    pageGuard.global.ts  → Global route middleware: blocks navigation to disabled pages, redirects to /
    stackTracker.global.ts → Global route middleware: auto-maintains navigation stack (push/pop/replace) on every client-side route change
  utils/
    pageToggles.ts       → Re-exports DEFAULT_PAGE_TOGGLES, ROUTE_TOGGLE_MAP, ALWAYS_ENABLED_ROUTES, isPageEnabled() for client-side auto-import
    navigationLabels.ts  → Label registry: resolveLabel(path) → human-readable label, routePattern(path) → same-page-type detection
    navigationFallbacks.ts → resolveFallbackRoute(path) → deterministic parent route when nav stack is empty
    workQueueFilters.ts  → applyFilters() + extractAvailableValues() — pure client-side filtering for work queue groups
    jobTagGrouping.ts    → groupJobsByTag() — groups filtered jobs by tag into collapsible sections; JobTagGroup interface
    apiError.ts          → extractApiError(err, fallback) — unwraps Nitro `err.data.message` / `err.message` with a default
    auditFormatting.ts   → actionConfigFor() + formatRelativeTime() + truncateId() + hasTransition() + buildDetailsSummary() — pure helpers for audit log UI
  assets/css/
    main.css             → Tailwind imports + custom violet #8750FF scale + green scale
server/
  api/                   → 60+ API routes (see Routes → Services Map below)
  middleware/
    01.rateLimit.ts      → Tiered rate limiting (login/auth/unauth tiers)
    02.auth.ts           → JWT auth: verifies token on /api/ routes, exempt list, cookie fallback for SSR
  services/              → 14 service modules (business logic layer, including authService, tagService)
  repositories/
    interfaces/          → 16 repository interfaces + barrel export
    sqlite/              → 16 SQLite implementations + migration system (13 migrations)
    factory.ts           → createRepositories(config) — returns RepositorySet
    types.ts             → Re-exports RepositorySet type
  utils/
    errors.ts            → ValidationError, NotFoundError, ForbiddenError, AuthenticationError
    httpError.ts         → STATUS_MESSAGES, ERROR_STATUS_MAP, httpError(), defineApiHandler() — centralized HTTP error handler replacing per-route try/catch blocks
    authUser.ts          → getAuthUserId(event) — extracts authenticated user ID from JWT context (auto-imported by Nitro)
    idGenerator.ts       → generateId(prefix), createSequentialSnGenerator()
    serialization.ts     → serialize(), deserialize(), prettyPrint() for all domain types
    validation.ts        → assertPositive, assertNonEmpty, assertNonEmptyArray, assertOneOf, parseBody(), parseQuery() (Zod schema validation for body and query params)
    openapi.ts           → zodToJsonSchema(), zodRequestBody(), jsonResponse() — Zod-to-OpenAPI JSON Schema conversion helpers (auto-imported by Nitro)
    db.ts                → getRepositories() singleton — lazy-inits from runtimeConfig
    workQueueGrouping.ts → groupEntriesByDimension() — pure server-side grouping by user/location/step dimension
    workQueueHelpers.ts  → findFirstActiveStep(), shouldIncludeStep() — first-step visibility logic for work queue entry assembly
    services.ts          → getServices() singleton — wires all 12 services together
    pageToggles.ts       → DEFAULT_PAGE_TOGGLES, ROUTE_TOGGLE_MAP, ALWAYS_ENABLED_ROUTES, mergePageToggles(), isPageEnabled() — auto-imported by Nitro
  schemas/               → Zod request body schemas by domain (pathSchemas.ts, operatorSchemas.ts, etc.)
  types/
    domain.ts            → 26+ domain types (Job, Path, ProcessStep, SerialNumber, SnStepStatus, SnStepOverride, BomVersion, ProcessLibraryEntry, LocationLibraryEntry, etc.)
    api.ts               → 25+ API input types (ScrapSerialInput, ForceCompleteInput, AdvanceToStepInput, EditBomInput, etc.)
    computed.ts          → 9+ view types (JobProgress, AdvancementResult, SnStepStatusView, etc.)
public/
  favicon.ico
data/                    → SQLite DB file (shop_erp.db) — gitignored
tests/
  unit/
    utils/               → 4 test files (errors, idGenerator, serialization, validation, services)
    services/            → 10 test files (one per service)
    composables/         → 4 test files (useBarcode, useViewFilters, useJobForm, workQueueSearch)
    components/          → 4 test files (SerialCreationPanel, serialNoteAdd, JobEditNavigation, JobViewToolbar)
    routes/              → 6 test files (batchDistributions, notesByPath, batchStepStatuses, batchAdvanceTo, batchPathOperations, tagRouteAuth)
    repositories/sqlite/ → 1 test file (migrations)
  properties/            → property-based tests (fast-check properties; see tests/properties for full list)
  integration/           → 16 files: helpers + 14 end-to-end lifecycle tests + jobViewUtilities integration tests
  e2e/                   → Playwright business-critical flows (auth, job/path/part CRUD, advance/skip, deletion, admin guards). See TESTING.md for standards.
```

## Run Commands

| Action | Command | Notes |
|--------|---------|-------|
| Dev server | `npm run dev` | Nuxt dev with HMR |
| Build | `npm run build` | Production build to `.output/` |
| Preview | `npm run preview` | Preview production build locally |
| Test | `npm run test` | `vitest run` (unit + integration + properties) |
| Test watch | `npm run test:watch` | `vitest` in watch mode |
| E2E test | `npm run test:e2e` | Playwright business-critical flows (see TESTING.md) |
| E2E UI | `npm run test:e2e:ui` | Playwright interactive UI mode |
| Lint | `npm run lint` | ESLint with Nuxt config |
| Typecheck | `npm run typecheck` | `nuxt typecheck` |
| Docker build | `docker build -t shop-erp .` | Requires `npm run build` first |
| Docker run | `docker-compose up -d` | Runs on port 3000 |
| Deploy | `./deploy.sh` | Build + docker save + rsync to server |
| Seed | `npm run seed` | Idempotent SAMPLE- data creation |
| Seed reset | `npm run seed:reset` | Delete SAMPLE- data + re-seed |
| Screenshots | `npm run screenshots` | Puppeteer captures 12 pages × 3 viewports → `docs/screenshots/<viewport>/` |

## Key Entry Points

| What | File |
|------|------|
| App root | `app/app.vue` |
| App config (UI colors) | `app/app.config.ts` |
| Nuxt config | `nuxt.config.ts` |
| CSS / theme | `app/assets/css/main.css` |
| Homepage | `app/pages/index.vue` |
| Service singleton | `server/utils/services.ts` → `getServices()` |
| Repository singleton | `server/utils/db.ts` → `getRepositories()` |
| Auth plugin | `app/plugins/auth.ts` → provides `$authFetch` via `nuxtApp.provide` |
| Users plugin | `app/plugins/users.ts` → fetches user list once on app startup (global init) |
| Auth composable | `app/composables/useAuth.ts` → session state, token, user |
| Auth fetch | `app/composables/useAuthFetch.ts` → `useAuthFetch()` returns authenticated `$fetch` |
| Auth middleware | `server/middleware/02.auth.ts` → JWT verification on `/api/` routes |
| Auth service | `server/services/authService.ts` → PIN hash, JWT sign/verify, key pairs |
| Rate limiter | `server/middleware/01.rateLimit.ts` → tiered rate limits |
| Content config | `content.config.ts` |
| Vitest config | `vitest.config.ts` |
| ESLint config | `eslint.config.mjs` |
| Docker | `Dockerfile` + `docker-compose.yml` |
| Deploy script | `deploy.sh` |

## Architecture

```
Components → Composables → API Routes → Services → Repositories → SQLite
   UI only    API client     HTTP glue   Business    Data access    Storage
             (useAuthFetch)               logic
```

Dependencies flow left-to-right only. All business logic lives in services. See `.ai/architecture.md` for details.

## Backend: Routes → Services Map (Implemented)

| Route prefix | Service | Domain |
|-------------|---------|--------|
| `/api/jobs/**` | `jobService` | Production orders (CRUD + progress + delete + priority) |
| `/api/paths/**` | `pathService` | Route instances with process steps |
| `/api/serials/**` | `serialService`, `lifecycleService` | Serial number tracking + advancement + lifecycle (scrap, force-complete, advance-to, overrides, waivers) |
| `/api/parts/**` | `partService`, `lifecycleService` | Part CRUD + advancement + admin hard-delete (cascade: cert attachments, step overrides, step statuses) |
| `/api/certs/**` | `certService` | Certificate management + attachment + detail view |
| `/api/templates/**` | `templateService` | Reusable route templates + apply + edit |
| `/api/audit/**` | `auditService` | Immutable audit trail |
| `/api/jira/**` | `jiraService` | Jira read/push integration (tickets, link, push, comment) |
| `/api/bom/**` | `bomService` | Bill of materials roll-ups + edit + version history |
| `/api/settings/**` | `settingsService` | Jira config + field mappings + page toggles |
| `/api/notes/**` | `noteService` | Process step notes/defects |
| `/api/users/**` | `userService` | Kiosk-mode user profiles with username, displayName, isAdmin |
| `/api/auth/**` | `authService` | PIN login, PIN setup, token refresh, PIN reset (JWT auth) |
| `/api/operator/**` | (aggregates job/path/serial) | Workstation view data |
| `/api/steps/:id/assign` | `pathService` | Step assignment (PATCH) |
| `/api/steps/:id/config` | `pathService` | Step config: optional + dependencyType (PATCH) |
| `/api/paths/:id/advancement-mode` | `pathService` | Path advancement mode (PATCH) |
| `/api/library/**` | `libraryService` | Process + location library CRUD |
| `/api/tags/**` | `tagService` | Tag CRUD (admin-gated create/update/delete) |
| `/api/jobs/:id/tags` | `jobService`, `tagService` | Get/set tags for a job |
| `POST /api/paths/batch-distributions` | `pathService` | Bulk fetch step distributions + completed counts for multiple paths |
| `POST /api/parts/batch-step-statuses` | `lifecycleService` | Bulk fetch step statuses for multiple parts |
| `POST /api/parts/advance-to` | `lifecycleService` | Batch advance multiple parts to a target step (with skip/complete) |
| `GET /api/notes/path/:pathId` | `noteService`, `pathService` | Fetch all notes for all steps in a path |
| `POST /api/jobs/:id/paths/batch` | `pathService`, `jobService` | Batch create/update/delete paths for a job in one call |

## Frontend: Pages (Implemented — tasks 5–10)

| Page | File | Purpose |
|------|------|---------|
| Dashboard | `app/pages/index.vue` | Summary cards, job progress chart, bottleneck alerts |
| Jobs list | `app/pages/jobs/index.vue` | Expandable table: jobs → paths → steps |
| Job detail | `app/pages/jobs/[id].vue` | Tabbed: Job Routing (paths, steps, config) + Serial Numbers tab |
| Job create | `app/pages/jobs/new.vue` | Dedicated job creation form via `JobCreationForm` component |
| Job edit | `app/pages/jobs/edit/[id].vue` | Edit existing job (paths, steps) via `JobCreationForm` component |
| Operator | `app/pages/operator.vue` | ~~Removed~~ — replaced by Parts View + Work Queue |
| Assignees | `app/pages/assignees.vue` | ~~Removed~~ — subsumed by Work Queue |
| Parts View | `app/pages/parts/index.vue` | All active parts grouped by job/step, click navigates to Step View |
| Step View | `app/pages/parts/step/[stepId].vue` | Dedicated step page: advancement panel or serial creation, bookmarkable URL |
| Work Queue | `app/pages/queue.vue` | Work grouped by user/location/step (configurable), URL-synced filters, saved presets |
| Templates | `app/pages/templates.vue` | Route template CRUD with library dropdowns + editing |
| BOM | `app/pages/bom.vue` | Bill of materials roll-ups + edit + version history |
| Jira | `app/pages/jira.vue` | Jira ticket dashboard (conditional) |
| Audit | `app/pages/audit.vue` | Audit trail viewer with filters (action type, user, serial, job, date range) |
| Settings | `app/pages/settings.vue` | Users, Jira connection, field mappings, process/location libraries, page visibility toggles |
| API Docs | `/_scalar` (Nitro built-in) | Auto-generated OpenAPI 3.1 Scalar UI (no custom page) |
| Serial browser | `app/pages/serials/index.vue` | Searchable/filterable serial number list |
| Part detail | `app/pages/serials/[id].vue` | Tabbed part view: routing (SectionCard sections: routing, certificates, notes, advance process; lifecycle features, deferred steps, overrides, certs) + sibling serials |

## Domain Model

Core entities and relationships:

- **Job** → has many **Paths** (route instances)
- **Path** → has ordered **ProcessSteps**, has many **SerialNumbers**
- **ProcessStep** → belongs to Path, has optional `assignedTo`, `optional` flag, `dependencyType` (physical/preferred/completion_gate)
- **SerialNumber** → belongs to Job + Path, tracks current step index (-1 = completed), has `status` (in_progress/completed/scrapped), scrap fields, force-complete fields, has **CertAttachments**
- **Path** → has `advancementMode` (strict/flexible/per_step)
- **Certificate** → attached to serials at specific steps (many-to-many via cert_attachments, idempotent UNIQUE)
- **TemplateRoute** → deep-cloned when applied to create a Path (template independence preserved)
- **BOM** → has **BomEntries** (part types), each linked to contributing Jobs
- **AuditEntry** → append-only log of all cert/serial/note/lifecycle operations (14 action types)
- **SnStepStatus** → per-serial per-step status tracking (pending/in_progress/completed/skipped/deferred/waived)
- **SnStepOverride** → per-serial step overrides (fast-track, reversible)
- **BomVersion** → immutable BOM edit snapshots
- **ProcessLibraryEntry** / **LocationLibraryEntry** → reusable process name and location libraries
- **ShopUser** → kiosk-mode identity with `username` (unique), `displayName`, `isAdmin`, `pinHash` (nullable — null means PIN not yet set); PIN-based auth with ES256 JWT tokens; admin flag gates UI features (job creation, job/path deletion, PIN reset); all mutation endpoints derive userId from JWT `event.context.auth.user.sub` via `getAuthUserId()` — no client-side userId override
- **StepNote** → defect/note on serial(s) at a process step
- **Tag** → user-defined label with name (max 30 chars, case-insensitive unique) and hex color; managed under Settings → Tags (admin-only CRUD)
- **JobTag** → many-to-many join between Jobs and Tags via `job_tags` table; cascade deletes on both sides
- **AppSettings** → singleton: Jira connection + field mappings + page toggles (5 default PI project mappings, 9 page visibility toggles)

## Sub-Maps (`.ai/` folder)

| File | Covers |
|------|--------|
| `.ai/architecture.md` | Layer boundaries, separation of concerns, dependency injection |
| `.ai/data-model.md` | SQLite schema, domain types, serialization, migration strategy |
| `.ai/jira-integration.md` | PI project custom fields, REST API patterns, push/pull flow |
| `.ai/testing.md` | Property-based tests, integration tests, seed data strategy |

## Known Quirks

- In Nuxt 4, `~` resolves to `app/` not project root. Server code must use relative imports. App code imports shared types from `~/types/` (which maps to `app/types/`). See `.kiro/steering/coding-standards.md` for full rules.
- `app/types/` is the shared types layer: `domain.ts`, `computed.ts`, `api.ts`, `jira.ts` re-export server types for app-layer consumption. App code MUST import from `~/types/` not `~/server/`.
- `server/utils/` exports are auto-imported by Nitro — no explicit imports needed in API routes for `ValidationError`, `NotFoundError`, `getServices()`, `getRepositories()`, `defineApiHandler()`, `zodRequestBody()`, etc.
- `app/composables/` and `app/utils/` exports are auto-imported by Nuxt — no explicit imports needed in Vue components.
- Test files use vitest's `~` alias which points to project root (different from Nuxt runtime).
- Primary color is `violet` with custom `#8750FF` CSS scale in `:root` variables.
- The CSS has a custom green color scale from the Nuxt starter template — not used by the app.
- `Dockerfile` copies pre-built `.output/` — you must `npm run build` before `docker build`.
- Operator identity is the authenticated user from `useAuth()`. The user list is fetched once globally by `app/plugins/users.ts` on app startup — individual pages/components should NOT call `fetchUsers()` for initialization, only for post-mutation refresh.
- Prefer SSR data fetching over client-only rendering to avoid UI flashes. If SSR-rendered elements appear before hydration, e2e tests must `waitForLoadState('networkidle')` after `goto()` before interacting — never skip hydration by making plugins client-only.
- Global data plugins (`settings.ts`, `users.ts`) should `await` the fetch so SSR includes the data in the hydration payload. On the client, guard with `if (!data.value.length)` to skip the duplicate request when `useState` already transferred the SSR data. Components that consume plugin-fetched data should still include an `onMounted` safety net (`if (!data.value.length) fetch()`) in case the plugin failed silently.
- `deploy.sh` has placeholder `SERVER="user@your-server.local"` — needs real values.
- Jira integration is optional and off by default. Two independent toggles: global enable + push enable.
- Serial numbers use sequential format `SN-00001` with a DB-persisted counter (counters table).
- Audit trail is append-only — no update or delete at the repository level.
- All seed data uses `SAMPLE-` prefix for easy identification and cleanup.
- The spec has two "Requirement 15" entries (User Management and Operator View) — a numbering error.
- `vitest.config.ts` aliases `~` to project root (`.`) for server-side imports.
- `runtimeConfig` in `nuxt.config.ts` has `dbType`, `dbPath`, and 4 Jira env vars.
- `USelect` items must never have `value: ''` or `value: null`. Reka UI's `SelectItem` throws if value is an empty string (reserved for clearing selection). Use a sentinel like `_placeholder` with `disabled: true` for placeholder items.
- `defineRouteMeta` is a Nitro build-time macro — auto-imported, no runtime overhead. Every API route uses it to provide OpenAPI metadata (tags, description, request body, responses). Routes with Zod schemas use `zodRequestBody(schema)` to auto-convert to JSON Schema.
- OpenAPI spec is served at `/_openapi.json`, Scalar UI at `/_scalar`. Both are available in dev and production (`openAPI.production: 'prerender'` in nuxt.config).
- `@nuxt/content` is still in dependencies but no longer actively used (the `content/` directory is empty). Can be removed if no future content needs arise.
- `UModal` accessibility: never use the `#header` slot to customize the title — it replaces the entire header including Reka UI's `DialogTitle`, causing aria warnings. Instead, use the `#title` slot to customize title content while keeping the `DialogTitle` wrapper intact. Set the `description` prop for `aria-describedby` (use `ui.description: 'sr-only'` to hide it visually). See `PartDeleteButton.vue` for the pattern.
