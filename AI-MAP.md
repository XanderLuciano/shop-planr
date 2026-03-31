# AI-MAP — Shop Planr Quick Reference

> Master index for AI agents. Consult this FIRST before searching the codebase.
> For deeper dives, see sub-maps in `.ai/` folder.

## Project Overview

Shop Planr (package name: `shop-erp`) is a job routing and ERP application for machine shops. It tracks production orders (Jobs) through multi-path routing of parts across sequential Process Steps, with serial number management, certificate traceability, progress visualization, and optional Jira integration. Built as a full-stack Nuxt 4 app with SQLite persistence.

**Status**: All features implemented. Job lifecycle management added (scrap, force-complete, flexible advancement, step overrides, waivers, BOM versioning, process/location libraries). Dedicated job creation/edit pages. Serial detail page Routing tab reorganized into SectionCard sections. First-step serial creation panel (SerialCreationPanel) for operator work queue. Operator view redesigned: monolithic operator.vue split into Parts View (/parts), Step View (/parts/step/[stepId]), and Operator Work Queue (/queue). Inline note creation on serial detail page. Step overflow UX: StepTracker uses flex-wrap instead of horizontal scroll, compact step cards, condensed serial counts. Nav page toggles: Settings → Page Visibility tab to hide/show sidebar pages, with route middleware guard and reactive sidebar filtering. Step 1 disabled-after-advance bugfix: zero-serial steps return 200 with partCount:0 instead of 404; first steps always visible in Parts View; prev/next step navigation; deduplicated step headers. Page toggle refresh bugfix: `app/plugins/settings.ts` plugin fetches settings once on app init so sidebar filtering and route middleware have correct toggle state on every page load (no flash, no stale fallback). Nav jobs-to-steps back arrow bugfix: Step View back arrow is context-aware via `from` query parameter, returning to Job detail when navigated from there. Job-step dashboard redirect bugfix: `ALWAYS_ENABLED_ROUTES` constant in `pageToggles.ts` ensures `/parts/step/*` routes are always accessible regardless of the `parts` toggle state. API Documentation CMS: integrated Nuxt Content v3 docs site at `/api-docs` with 67+ endpoint docs across 14 service domains, sidebar navigation, full-text search, EndpointCard MDC component, and responsive docs layout. FK-safe path update: `reconcileSteps()` pure function + `hasStepDependents()` guard replaces delete-and-recreate strategy in `pathService.updatePath()` and `SQLitePathRepository.update()`, preserving step IDs and FK references during path edits (GitHub Issue #9). Path "Done" total fix: `getPathCompletedCount()` returns path-level completed count separately; `getStepDistribution()` no longer copies completed count onto every step entry; API returns `completedCount` as top-level field; frontend uses it directly instead of buggy `.reduce()` sum (GitHub Issue #24). Job view utilities: JobViewToolbar component with expand/collapse all jobs and paths buttons; JobExpandableRow upgraded to multi-path expansion (Set-based) with signal-driven bulk expand/collapse and throttled concurrent fetching (GitHub Issue #4). Job delete: `deleteJob` + `canDeleteJob` on jobService with safety checks (paths, parts, BOM refs), `DELETE /api/jobs/:id` API route, `countContributingJobRefs` on BomRepository, delete button + confirmation modal on job detail page, 5 property tests (GitHub Issue #46). 873 tests passing across 149 files. Full frontend with lifecycle dialogs, configuration panels, and audit filters.

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Nuxt 4.2.2 (Vue 3, Nitro server) |
| UI Library | Nuxt UI 4.3.0 (Tailwind CSS v4, Reka UI) |
| Content CMS | Nuxt Content 3.x (Markdown/MDC, SQLite, MiniSearch) |
| Language | TypeScript 5.9 |
| Icons | `@iconify-json/lucide` |
| Database | SQLite via `better-sqlite3` |
| ID Generation | `nanoid` |
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
  components/            → 50+ components: SectionCard (reusable card wrapper), lifecycle dialogs (ScrapDialog, ForceCompleteDialog, AdvanceToStepDropdown), config panels (StepConfigPanel, AdvancementModeSelector, LibraryManager), job form (JobCreationForm), serial creation (SerialCreationPanel — first-step batch creation + advancement), page visibility (PageVisibilitySettings — toggle switches for nav pages), docs (EndpointCard MDC, DocsSidebar, DocsSearch), job view (JobViewToolbar — expand/collapse all jobs/paths buttons, JobExpandableRow — multi-path expansion with bulk signals, JobMobileCard — card-based job display for mobile viewports), utility (BonusBadge, PathDeleteButton, CertDetailView, TemplateEditor, etc.)
  composables/           → 23+ composables: useJobForm, useLifecycle, useLibrary, useBomVersions, useAudit (with filters), usePartsView, useStepView, useOperatorWorkQueue, useSettings (extended with pageToggles), useDocsNavigation, useDocsSearch, useMobileBreakpoint (matchMedia-based mobile viewport detection) + existing ones
  middleware/
    pageGuard.global.ts  → Global route middleware: blocks navigation to disabled pages, redirects to /
  utils/
    pageToggles.ts       → Re-exports DEFAULT_PAGE_TOGGLES, ROUTE_TOGGLE_MAP, ALWAYS_ENABLED_ROUTES, isPageEnabled() for client-side auto-import
    resolveBackNavigation.ts → Pure helper: computes back-arrow destination/label from `from` query param (auto-imported)
    docsMethodColor.ts   → getMethodColor() — maps HTTP methods to Tailwind color classes for EndpointCard badges
  assets/css/
    main.css             → Tailwind imports + custom violet #8750FF scale + green scale
server/
  api/                   → 52+ API routes (see Routes → Services Map below)
  services/              → 12 service modules (business logic layer)
  repositories/
    interfaces/          → 14 repository interfaces + barrel export
    sqlite/              → 14 SQLite implementations + migration system (5 migrations)
    factory.ts           → createRepositories(config) — returns RepositorySet
    types.ts             → Re-exports RepositorySet type
  utils/
    errors.ts            → ValidationError, NotFoundError
    idGenerator.ts       → generateId(prefix), createSequentialSnGenerator()
    serialization.ts     → serialize(), deserialize(), prettyPrint() for all domain types
    validation.ts        → assertPositive, assertNonEmpty, assertNonEmptyArray, assertOneOf, etc.
    db.ts                → getRepositories() singleton — lazy-inits from runtimeConfig
    services.ts          → getServices() singleton — wires all 12 services together
    pageToggles.ts       → DEFAULT_PAGE_TOGGLES, ROUTE_TOGGLE_MAP, ALWAYS_ENABLED_ROUTES, mergePageToggles(), isPageEnabled() — auto-imported by Nitro
  types/
    domain.ts            → 26+ domain types (Job, Path, ProcessStep, SerialNumber, SnStepStatus, SnStepOverride, BomVersion, ProcessLibraryEntry, LocationLibraryEntry, etc.)
    api.ts               → 25+ API input types (ScrapSerialInput, ForceCompleteInput, AdvanceToStepInput, EditBomInput, etc.)
    computed.ts          → 9+ view types (JobProgress, AdvancementResult, SnStepStatusView, etc.)
public/
  favicon.ico
data/                    → SQLite DB file (shop_erp.db) — gitignored
content/
  api-docs/              → Nuxt Content v3 markdown docs: 14 service domains, 67+ endpoint files
    index.md             → API overview and getting-started guide
    jobs/                → Jobs API: index.md + list.md, get.md, create.md, update.md
    paths/               → Paths API: index.md + get.md, create.md, update.md, delete.md, advancement-mode.md
    serials/             → Serials API: index.md + 14 endpoint files (advance, scrap, overrides, etc.)
    certs/               → Certificates API: index.md + list.md, get.md, create.md, batch-attach.md, attachments.md
    templates/           → Templates API: index.md + list.md, get.md, create.md, update.md, delete.md, apply.md
    bom/                 → BOM API: index.md + list.md, get.md, create.md, update.md, edit.md, versions.md
    audit/               → Audit API: index.md + list.md, serial.md
    jira/                → Jira API: index.md + tickets.md, ticket-detail.md, link.md, push.md, comment.md
    settings/            → Settings API: index.md + get.md, update.md
    users/               → Users API: index.md + list.md, create.md, update.md
    notes/               → Notes API: index.md + create.md, by-serial.md, by-step.md
    operator/            → Operator API: index.md + step-view.md, work-queue.md, queue-all.md, queue-user.md, by-step-name.md
    steps/               → Steps API: index.md + assign.md, config.md
    library/             → Library API: index.md + processes.md, process-delete.md, locations.md, location-delete.md
tests/
  unit/
    utils/               → 4 test files (errors, idGenerator, serialization, validation, services)
    services/            → 10 test files (one per service)
    composables/         → 4 test files (useBarcode, useViewFilters, useJobForm, workQueueSearch)
    components/          → 6 test files (SerialCreationPanel, serialNoteAdd, EndpointCard, DocsSidebar, JobEditNavigation, JobViewToolbar)
    repositories/sqlite/ → 1 test file (migrations)
  properties/            → property-based tests (fast-check properties; see tests/properties for full list)
  integration/           → 16 files: helpers + 14 end-to-end lifecycle tests + jobViewUtilities integration tests
```

## Run Commands

| Action | Command | Notes |
|--------|---------|-------|
| Dev server | `npm run dev` | Nuxt dev with HMR |
| Build | `npm run build` | Production build to `.output/` |
| Preview | `npm run preview` | Preview production build locally |
| Test | `npm run test` | `vitest run` — 857 tests, 148 files |
| Test watch | `npm run test:watch` | `vitest` in watch mode |
| Lint | `npm run lint` | ESLint with Nuxt config |
| Typecheck | `npm run typecheck` | `nuxt typecheck` |
| Docker build | `docker build -t shop-erp .` | Requires `npm run build` first |
| Docker run | `docker-compose up -d` | Runs on port 3000 |
| Deploy | `./deploy.sh` | Build + docker save + rsync to server |
| Seed | `npm run seed` | Idempotent SAMPLE- data creation |
| Seed reset | `npm run seed:reset` | Delete SAMPLE- data + re-seed |
| Screenshots | `npm run screenshots` | Puppeteer captures 9 pages → `docs/screenshots/` |

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
| Content config | `content.config.ts` |
| Vitest config | `vitest.config.ts` |
| ESLint config | `eslint.config.mjs` |
| Docker | `Dockerfile` + `docker-compose.yml` |
| Deploy script | `deploy.sh` |

## Architecture

```
Components → Composables → API Routes → Services → Repositories → SQLite
   UI only    API client     HTTP glue   Business    Data access    Storage
                                          logic
```

Dependencies flow left-to-right only. All business logic lives in services. See `.ai/architecture.md` for details.

## Backend: Routes → Services Map (Implemented)

| Route prefix | Service | Domain |
|-------------|---------|--------|
| `/api/jobs/**` | `jobService` | Production orders (CRUD + progress + delete) |
| `/api/paths/**` | `pathService` | Route instances with process steps |
| `/api/serials/**` | `serialService`, `lifecycleService` | Serial number tracking + advancement + lifecycle (scrap, force-complete, advance-to, overrides, waivers) |
| `/api/certs/**` | `certService` | Certificate management + attachment + detail view |
| `/api/templates/**` | `templateService` | Reusable route templates + apply + edit |
| `/api/audit/**` | `auditService` | Immutable audit trail |
| `/api/jira/**` | `jiraService` | Jira read/push integration (tickets, link, push, comment) |
| `/api/bom/**` | `bomService` | Bill of materials roll-ups + edit + version history |
| `/api/settings/**` | `settingsService` | Jira config + field mappings + page toggles |
| `/api/notes/**` | `noteService` | Process step notes/defects |
| `/api/users/**` | `userService` | Simple kiosk-mode user profiles |
| `/api/operator/**` | (aggregates job/path/serial) | Workstation view data |
| `/api/steps/:id/assign` | `pathService` | Step assignment (PATCH) |
| `/api/steps/:id/config` | `pathService` | Step config: optional + dependencyType (PATCH) |
| `/api/paths/:id/advancement-mode` | `pathService` | Path advancement mode (PATCH) |
| `/api/library/**` | `libraryService` | Process + location library CRUD |

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
| Work Queue | `app/pages/queue.vue` | Work grouped by operator/assignee, URL-synced operator filter |
| Templates | `app/pages/templates.vue` | Route template CRUD with library dropdowns + editing |
| BOM | `app/pages/bom.vue` | Bill of materials roll-ups + edit + version history |
| Jira | `app/pages/jira.vue` | Jira ticket dashboard (conditional) |
| Audit | `app/pages/audit.vue` | Audit trail viewer with filters (action type, user, serial, job, date range) |
| Settings | `app/pages/settings.vue` | Users, Jira connection, field mappings, process/location libraries, page visibility toggles |
| API Docs CMS | `app/pages/api-docs/[...slug].vue` | Nuxt Content v3 docs site (67+ endpoint docs) |
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
- **ShopUser** → simple kiosk-mode identity (no passwords)
- **StepNote** → defect/note on serial(s) at a process step
- **AppSettings** → singleton: Jira connection + field mappings + page toggles (5 default PI project mappings, 9 page visibility toggles)

## Sub-Maps (`.ai/` folder)

| File | Covers |
|------|--------|
| `.ai/architecture.md` | Layer boundaries, separation of concerns, dependency injection |
| `.ai/data-model.md` | SQLite schema, domain types, serialization, migration strategy |
| `.ai/jira-integration.md` | PI project custom fields, REST API patterns, push/pull flow |
| `.ai/testing.md` | Property-based tests, integration tests, seed data strategy |

## Known Quirks

- In Nuxt 4, `~` resolves to `app/` not project root. Server code must use relative imports. See `.kiro/steering/coding-standards.md` for full rules.
- `server/utils/` exports are auto-imported by Nitro — no explicit imports needed in API routes for `ValidationError`, `NotFoundError`, `getServices()`, `getRepositories()`, etc.
- `app/composables/` and `app/utils/` exports are auto-imported by Nuxt — no explicit imports needed in Vue components.
- Test files use vitest's `~` alias which points to project root (different from Nuxt runtime).
- Primary color is `violet` with custom `#8750FF` CSS scale in `:root` variables.
- The CSS has a custom green color scale from the Nuxt starter template — not used by the app.
- `Dockerfile` copies pre-built `.output/` — you must `npm run build` before `docker build`.
- `deploy.sh` has placeholder `SERVER="user@your-server.local"` — needs real values.
- Jira integration is optional and off by default. Two independent toggles: global enable + push enable.
- Serial numbers use sequential format `SN-00001` with a DB-persisted counter (counters table).
- Audit trail is append-only — no update or delete at the repository level.
- All seed data uses `SAMPLE-` prefix for easy identification and cleanup.
- The spec has two "Requirement 15" entries (User Management and Operator View) — a numbering error.
- `vitest.config.ts` aliases `~` to project root (`.`) for server-side imports.
- `runtimeConfig` in `nuxt.config.ts` has `dbType`, `dbPath`, and 4 Jira env vars.
- `USelect` items must never have `value: ''` or `value: null`. Reka UI's `SelectItem` throws if value is an empty string (reserved for clearing selection). Use a sentinel like `_placeholder` with `disabled: true` for placeholder items.
- Nuxt Content v3 requires `content.config.ts` at project root to define collections. The `docs` collection uses `source: 'api-docs/**'` with custom schema fields. Without this file, content queries return empty results.
- Endpoint docs use `endpoint` (not `path`) as the frontmatter field for the API path (e.g. `endpoint: "/api/jobs"`). Nuxt Content reserves `path` for URL routing — using `path` in frontmatter overrides the page's URL.
