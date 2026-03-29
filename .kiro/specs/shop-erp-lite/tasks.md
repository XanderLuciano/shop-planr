# Implementation Plan: SHOP_ERP

## Overview

Implement SHOP_ERP as a Nuxt 4 full-stack application with SQLite persistence, repository pattern, service layer business logic, and Nuxt UI 4.3.0 frontend. Tasks follow priority order: foundation → core services → API routes → UI foundation → core UI → advanced UI → barcode/QR → certificates UI → settings → Jira read → Jira push → property tests → integration tests → final checkpoint.

## Tasks

- [x] 1. Foundation: Dependencies, database setup, migrations, repository interfaces, factory, SQLite implementations
  - [x] 1.1 Install dependencies and configure project
    - Install `better-sqlite3`, `@types/better-sqlite3`, `nanoid`, `fast-check` (dev)
    - Update `nuxt.config.ts` with `runtimeConfig` for `dbType`, `dbPath`, Jira env vars
    - Update `app/app.config.ts` to set primary color to `violet` and neutral to `neutral`
    - Add custom violet CSS scale anchored on `#8750FF` to `app/assets/css/main.css`
    - Create `data/` directory, add `data/` to `.gitignore`
    - _Requirements: 12.1, 12.3_

  - [x] 1.2 Create shared utility modules
    - Create `server/utils/errors.ts` with `ValidationError` and `NotFoundError` classes
    - Create `server/utils/idGenerator.ts` with `generateId(prefix)` using nanoid and sequential SN generator
    - Create `server/utils/serialization.ts` with `serialize()`, `deserialize()`, `prettyPrint()` for all domain types
    - Create `server/utils/validation.ts` with shared validation helpers (e.g., `assertPositive`, `assertNonEmpty`)
    - _Requirements: 12.5, 12.6_

  - [x] 1.3 Define all domain types and interfaces
    - Create `server/types/domain.ts` with all core domain types: `Job`, `Path`, `ProcessStep`, `SerialNumber`, `Certificate`, `CertAttachment`, `TemplateRoute`, `TemplateStep`, `BOM`, `BomEntry`, `AuditEntry`, `AuditAction`, `ShopUser`, `StepNote`, `AppSettings`, `JiraConnectionSettings`, `JiraFieldMapping`, `FilterState`
    - Create `server/types/api.ts` with all API input/output types: `CreateJobInput`, `UpdateJobInput`, `CreatePathInput`, `UpdatePathInput`, `BatchCreateSerialsInput`, `AdvanceSerialInput`, `AttachCertInput`, `CreateCertInput`, `BatchAttachCertInput`, `CreateTemplateInput`, `ApplyTemplateInput`, `CreateBomInput`, `LinkJiraInput`, `PushToJiraInput`, `PushNoteToJiraInput`
    - Create `server/types/computed.ts` with view types: `JobProgress`, `StepDistribution`, `BomSummary`, `BomEntrySummary`, `OperatorStepView`, `OperatorPartInfo`
    - _Requirements: 12.1, 12.5_

  - [x] 1.4 Create repository interfaces
    - Create `server/repositories/interfaces/jobRepository.ts` — `JobRepository` interface (create, getById, list, update, delete)
    - Create `server/repositories/interfaces/pathRepository.ts` — `PathRepository` interface (create, getById, listByJobId, update, delete)
    - Create `server/repositories/interfaces/serialRepository.ts` — `SerialRepository` interface (create, createBatch, getById, getByIdentifier, listByPathId, listByJobId, listByStepIndex, update, countByJobId, countCompletedByJobId)
    - Create `server/repositories/interfaces/certRepository.ts` — `CertRepository` interface (create, getById, list, attachToSerial, getAttachmentsForSerial, batchAttach)
    - Create `server/repositories/interfaces/templateRepository.ts` — `TemplateRepository` interface (create, getById, list, update, delete)
    - Create `server/repositories/interfaces/auditRepository.ts` — `AuditRepository` interface (create, listBySerialId, listByJobId, list with pagination)
    - Create `server/repositories/interfaces/bomRepository.ts` — `BomRepository` interface (create, getById, list, update, delete)
    - Create `server/repositories/interfaces/settingsRepository.ts` — `SettingsRepository` interface (get, upsert)
    - Create `server/repositories/interfaces/noteRepository.ts` — `NoteRepository` interface (create, listBySerialId, listByStepId, listByJobId)
    - Create `server/repositories/interfaces/userRepository.ts` — `UserRepository` interface (create, getById, list, listActive, update)
    - Create `server/repositories/interfaces/index.ts` barrel export
    - _Requirements: 12.2_

  - [x] 1.5 Create SQLite migration system and initial schema
    - Create `server/repositories/sqlite/migrations/001_initial_schema.sql` with all tables, indexes, and constraints from the design document
    - Create `server/repositories/sqlite/index.ts` with `createSQLiteRepositories()`, DB init, WAL mode, foreign keys, and the file-based migration runner (`runMigrations`, `loadMigrationFiles`)
    - Create `server/repositories/sqlite/migrations/002_add_counters_table.sql` for SN counter persistence
    - _Requirements: 12.1, 12.4_

  - [x] 1.6 Implement all SQLite repository classes
    - Create `server/repositories/sqlite/jobRepository.ts` — `SQLiteJobRepository` implements `JobRepository`
    - Create `server/repositories/sqlite/pathRepository.ts` — `SQLitePathRepository` implements `PathRepository` (includes process_steps management)
    - Create `server/repositories/sqlite/serialRepository.ts` — `SQLiteSerialRepository` implements `SerialRepository` (batch create, step index queries)
    - Create `server/repositories/sqlite/certRepository.ts` — `SQLiteCertRepository` implements `CertRepository` (cert_attachments join table, idempotent UNIQUE constraint)
    - Create `server/repositories/sqlite/templateRepository.ts` — `SQLiteTemplateRepository` implements `TemplateRepository` (template_steps management)
    - Create `server/repositories/sqlite/auditRepository.ts` — `SQLiteAuditRepository` implements `AuditRepository` (append-only, no update/delete)
    - Create `server/repositories/sqlite/bomRepository.ts` — `SQLiteBomRepository` implements `BomRepository` (bom_entries + bom_contributing_jobs)
    - Create `server/repositories/sqlite/settingsRepository.ts` — `SQLiteSettingsRepository` implements `SettingsRepository` (singleton row, JSON fields)
    - Create `server/repositories/sqlite/noteRepository.ts` — `SQLiteNoteRepository` implements `NoteRepository` (serial_ids as JSON array)
    - Create `server/repositories/sqlite/userRepository.ts` — `SQLiteUserRepository` implements `UserRepository`
    - _Requirements: 12.1, 12.2_

  - [x] 1.7 Create repository factory
    - Create `server/repositories/factory.ts` with `createRepositories(config)` returning `RepositorySet` — initially only `sqlite` type
    - Create `server/repositories/types.ts` with `RepositorySet` type definition
    - Create a server plugin or utility (`server/utils/db.ts`) that initializes the repository set from `runtimeConfig` and exports a singleton `getRepositories()` accessor for use in API routes
    - _Requirements: 12.2, 12.3_

- [x] 2. Core services: Job, Path, ProcessStep, SerialNumber, Certificate, Template, Audit, Note, User services
  - [x] 2.1 Implement AuditService and UserService
    - Create `server/services/auditService.ts` with `createAuditService(repos)` — `recordCertAttachment`, `recordSerialCreation`, `recordSerialAdvancement`, `recordSerialCompletion`, `recordNoteCreation`, `getSerialAuditTrail`, `getJobAuditTrail`, `listAuditEntries`
    - Create `server/services/userService.ts` with `createUserService(repos)` — `createUser`, `getUser`, `listUsers`, `listActiveUsers`, `updateUser`, `deactivateUser`
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 15.1_

  - [x] 2.2 Implement JobService
    - Create `server/services/jobService.ts` with `createJobService(repos)` — `createJob` (validates goalQuantity > 0, name non-empty), `getJob`, `listJobs`, `updateJob` (recalculates progress on goalQuantity change), `computeJobProgress` (completed / goal \* 100, can exceed 100), `getJobPartCount` (sum of SNs across all paths)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 7.1, 7.5, 7.7_

  - [x] 2.3 Implement PathService
    - Create `server/services/pathService.ts` with `createPathService(repos)` — `createPath` (validates at least one step, creates ordered ProcessSteps with optional location), `getPath`, `listPathsByJob`, `updatePath` (add/remove/reorder steps), `getStepDistribution` (SN counts per step with bottleneck detection)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.6_

  - [x] 2.4 Implement SerialService
    - Create `server/services/serialService.ts` with `createSerialService(repos)` — `batchCreateSerials` (validates path has steps, generates sequential SN IDs, optional cert attachment, records audit), `advanceSerial` (enforces sequential N→N+1, marks completed at final step, updates counts, records audit), `getSerial`, `lookupSerial` (by identifier for QR/barcode), `listSerialsByPath`, `listSerialsByJob`, `listSerialsByStepIndex`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 13.1, 13.2, 13.3_

  - [x] 2.5 Implement CertService
    - Create `server/services/certService.ts` with `createCertService(repos)` — `createCert` (validates type is material|process), `getCert`, `listCerts`, `attachCertToSerial` (validates cert exists, records audit with user/timestamp/step), `batchAttachCert` (idempotent via UNIQUE constraint, records audit for each new attachment), `getCertsForSerial` (returns in attachment order)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 13.1_

  - [x] 2.6 Implement TemplateService
    - Create `server/services/templateService.ts` with `createTemplateService(repos)` — `createTemplate`, `getTemplate`, `listTemplates`, `deleteTemplate`, `applyTemplate` (deep-clones steps to new Path, validates template exists, allows customization after apply, original template unchanged)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 2.7 Implement NoteService and SettingsService
    - Create `server/services/noteService.ts` with `createNoteService(repos)` — `createNote` (stores step, serialIds, text, user, timestamp, records audit), `getNotesForSerial`, `getNotesForStep`, `getNotesForJob`
    - Create `server/services/settingsService.ts` with `createSettingsService(repos, runtimeConfig)` — `getSettings` (merges DB settings with env var fallbacks), `updateSettings` (persists to DB), `getJiraConnection`, `getFieldMappings`, ships default JIRA_CUSTOM_FIELDS mapping
    - _Requirements: 17.1, 17.2, 17.4, 17.5, 17.6, 14.1, 14.2, 14.3, 14.6, 14.7_

  - [x] 2.8 Implement BomService
    - Create `server/services/bomService.ts` with `createBomService(repos)` — `createBom`, `getBom`, `listBoms`, `updateBom`, `getBomSummary` (aggregates completed/in-progress/outstanding from contributing jobs), handles zero-contributing-jobs case
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 2.9 Create service factory / initialization
    - Create `server/utils/services.ts` that initializes all services with the repository set from `getRepositories()` and exports a `getServices()` singleton accessor for use in API routes
    - Wire all services together so API routes can call `getServices().jobService.createJob(...)` etc.
    - _Requirements: 12.2, 12.3_

- [x] 3. API routes: All server/api/ endpoints delegating to services
  - [x] 3.1 Implement Job API routes
    - Create `server/api/jobs/index.get.ts` — list all jobs
    - Create `server/api/jobs/index.post.ts` — create job (parse body, call jobService.createJob)
    - Create `server/api/jobs/[id].get.ts` — get job detail with paths and progress
    - Create `server/api/jobs/[id].put.ts` — update job (name, goalQuantity)
    - All routes follow thin handler pattern: parse input → call service → return result, with error handling via ValidationError/NotFoundError
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

  - [x] 3.2 Implement Path API routes
    - Create `server/api/paths/index.post.ts` — create path on job
    - Create `server/api/paths/[id].get.ts` — get path detail with steps and SN distribution
    - Create `server/api/paths/[id].put.ts` — update path (steps, goalQuantity)
    - _Requirements: 2.1, 2.2, 2.3, 2.6_

  - [x] 3.3 Implement Serial Number API routes
    - Create `server/api/serials/index.post.ts` — batch create serials (jobId, pathId, quantity, optional certId)
    - Create `server/api/serials/[id].get.ts` — lookup serial (returns job, path, step, certs)
    - Create `server/api/serials/[id]/advance.post.ts` — advance serial to next step
    - Create `server/api/serials/[id]/attach-cert.post.ts` — attach cert to serial at current step
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.5, 4.6, 5.2_

  - [x] 3.4 Implement Certificate API routes
    - Create `server/api/certs/index.get.ts` — list all certificates
    - Create `server/api/certs/index.post.ts` — create certificate
    - Create `server/api/certs/[id].get.ts` — get certificate detail
    - Create `server/api/certs/batch-attach.post.ts` — batch attach cert to multiple serials
    - _Requirements: 5.1, 5.3, 5.5, 5.6_

  - [x] 3.5 Implement Template API routes
    - Create `server/api/templates/index.get.ts` — list templates
    - Create `server/api/templates/index.post.ts` — create template
    - Create `server/api/templates/[id].get.ts` — get template
    - Create `server/api/templates/[id].delete.ts` — delete template
    - Create `server/api/templates/[id]/apply.post.ts` — apply template to job (creates path)
    - _Requirements: 8.1, 8.2, 8.5_

  - [x] 3.6 Implement Audit, Note, User, BOM, Settings, and Operator API routes
    - Create `server/api/audit/index.get.ts` — query audit trail (with pagination)
    - Create `server/api/audit/serial/[id].get.ts` — audit trail for a serial
    - Create `server/api/notes/index.post.ts` — create step note
    - Create `server/api/notes/serial/[id].get.ts` — notes for a serial
    - Create `server/api/notes/step/[id].get.ts` — notes for a process step
    - Create `server/api/users/index.get.ts` — list active users
    - Create `server/api/users/index.post.ts` — create user
    - Create `server/api/users/[id].put.ts` — update user
    - Create `server/api/bom/index.get.ts` — list BOMs
    - Create `server/api/bom/index.post.ts` — create BOM
    - Create `server/api/bom/[id].get.ts` — get BOM with roll-up summary
    - Create `server/api/bom/[id].put.ts` — update BOM
    - Create `server/api/settings/index.get.ts` — get current settings
    - Create `server/api/settings/index.put.ts` — update settings
    - Create `server/api/operator/[stepName].get.ts` — operator view for a step (current, coming soon, backlog)
    - _Requirements: 13.5, 17.4, 17.5, 15.1, 15.2, 11.1, 11.2, 11.3, 14.1, 14.2, 14.7, 15(Operator).1, 15(Operator).6_

- [x] 4. Checkpoint — Foundation and backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. UI foundation: App layout, dark mode, violet theme, dense styling, dashboard shell
  - [x] 5.1 Implement app layout with sidebar navigation
    - Create `app/layouts/default.vue` using Nuxt UI dashboard layout pattern with left sidebar navigation
    - Sidebar links: Dashboard, Jobs, Operator, Assignees, Templates, BOM, Jira (conditionally shown), Audit, Settings — using `@iconify-json/lucide` icons
    - Implement collapsible sidebar for desktop
    - Apply data-dense styling: `text-sm`/`text-xs` defaults, reduced padding (`py-1`/`py-2`), compact form inputs
    - Update `app/app.vue` to use the default layout
    - _Requirements: 7.1, 16.1_

  - [x] 5.2 Implement BarcodeInput global component
    - Create `app/components/BarcodeInput.vue` — text input for barcode/QR scanner with camera QR button
    - Implement global `/` hotkey that focuses the barcode input from anywhere in the app
    - Auto-detect whether scanned value is a Serial Number or Certificate identifier and emit typed event
    - Place in app layout header so it's accessible on all pages
    - _Requirements: 6.5, 6.6, 6.7, 6.8_

  - [x] 5.3 Implement UserSelector component
    - Create `app/components/UserSelector.vue` — click-to-select from list of active users
    - Create `app/composables/useUsers.ts` — fetches users, manages selected user in browser session (localStorage)
    - Display selected user in app layout header; prompt to select if no user chosen before auditable actions
    - _Requirements: 15.2, 15.3, 15.4, 15.5, 15.6_

  - [x] 5.4 Implement dashboard homepage
    - Update `app/pages/index.vue` as dashboard with summary cards: Active Jobs, Total Parts In Progress, Parts Completed Today, Bottleneck Alerts
    - Create `app/components/DashboardSummaryCard.vue` — metric card with title, value, icon, link
    - Create `app/components/DashboardJobChart.vue` — horizontal bar chart showing progress per active job
    - Create `app/composables/useJobs.ts` — `fetchJobs`, `createJob`, `updateJob`, `getJob` with reactive state
    - Each card links to its respective detailed view
    - _Requirements: 7.1, 7.2_

- [x] 6. Core UI pages: Jobs list, job detail, template management, user selector
  - [x] 6.1 Implement ProgressBar component
    - Create `app/components/ProgressBar.vue` — dual-color bar with blue (#3B82F6) for in-progress and green (#22C55E) for completed, supports >100%
    - Props: `completed: number`, `goal: number`
    - _Requirements: 7.1, 7.2, 7.6_

  - [x] 6.2 Implement Jobs list page with expandable table
    - Create `app/pages/jobs/index.vue` with `UTable` expandable rows
    - Collapsed row: job name, part number, goal qty, progress bar, status, priority, assignee
    - Create `app/components/JobExpandableRow.vue` — expanded level 1 shows Paths (name, goal qty, step count, path progress); expanded level 2 shows Process Steps (step name, parts at step, parts completed, bottleneck indicator)
    - Create `app/components/BottleneckBadge.vue` — visual indicator for step with most waiting SNs
    - _Requirements: 7.4, 7.7, 7.8, 7.9, 2.4, 2.5, 16.1_

  - [x] 6.3 Implement Job detail page
    - Create `app/pages/jobs/[id].vue` — full job detail with paths, steps, serial numbers
    - Create `app/components/JobForm.vue` — create/edit form with name, goal quantity, optional Jira link
    - Create `app/components/PathEditor.vue` — add/edit paths with ordered process steps (name, location), goal quantity
    - Create `app/components/StepTracker.vue` — visual step-by-step tracker showing SN counts per step with advance button
    - Create `app/components/SerialBatchForm.vue` — batch create SNs at OP1 with quantity input and optional cert attachment
    - Create `app/composables/usePaths.ts` — path CRUD operations
    - Create `app/composables/useSerials.ts` — serial CRUD, advance, lookup
    - _Requirements: 1.1, 1.3, 2.1, 2.4, 3.1, 3.5, 4.1, 4.3, 4.5, 7.3, 7.8, 7.9_

  - [x] 6.4 Implement Template management page
    - Create `app/pages/templates.vue` — list templates, create new, delete existing
    - Create `app/composables/useTemplates.ts` — template CRUD and apply operations
    - Template list shows name, step count, step names preview
    - Create template form: name + ordered list of step definitions (name, optional location)
    - Apply template button on job detail page that creates a new path from template
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [x] 7. Advanced UI: Operator view, assignee view, filters, progress tracking, BOM views
  - [x] 7.1 Implement Operator / Workstation view
    - Create `app/pages/operator.vue` — select a process step, see all SNs at that step across all jobs/paths
    - Create `app/components/OperatorView.vue` — current parts (SN, job, path, time at step, next step + location), "Coming Soon" (one step upstream), "Backlog" (two+ steps upstream), vendor parts count
    - Create `app/composables/useOperatorView.ts` — fetches operator view data for selected step
    - _Requirements: 15(Operator).1, 15(Operator).2, 15(Operator).3, 15(Operator).4, 15(Operator).5, 15(Operator).6, 15(Operator).7_

  - [x] 7.2 Implement Assignee view
    - Create `app/pages/assignees.vue` — groups work by assignee, shows each assignee's jobs, quantity to produce, next step destination
    - Create `app/components/AssigneeView.vue` — assignee card with job list and step info
    - _Requirements: 16.2_

  - [x] 7.3 Implement view filters
    - Create `app/components/ViewFilters.vue` — filter bar with job name, ticket key, step, assignee, priority, label, status (active/completed)
    - Create `app/composables/useViewFilters.ts` — manages filter state, persists last-used view mode and filters to localStorage, supports combining multiple filters
    - Apply filters to Jobs list, Operator view, and Assignee view
    - _Requirements: 16.3, 16.4, 16.5, 16.6_

  - [x] 7.4 Implement BOM views
    - Create `app/pages/bom.vue` — list BOMs, create new, view roll-up summaries
    - Create `app/components/BomEditor.vue` — define part types with required quantities, associate contributing jobs
    - Create `app/composables/useBom.ts` — BOM CRUD and summary fetching
    - BOM summary shows: total parts needed, completed, in-progress for each part type
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 7.5 Implement Audit trail viewer
    - Create `app/pages/audit.vue` — chronological audit trail display with filtering
    - Create `app/components/AuditLog.vue` — displays audit entries with action, user, timestamp, serial, cert, step details
    - Create `app/composables/useAudit.ts` — fetches audit entries with pagination
    - _Requirements: 13.4, 13.5_

  - [x] 7.6 Implement Step Notes and Defect Reporting
    - Create `app/components/StepNoteForm.vue` — create note on serial(s) at a step, free-text content, optional Jira push offer
    - Create `app/components/StepNoteList.vue` — chronological list of notes for a step or serial
    - Create `app/composables/useNotes.ts` — note CRUD operations
    - Display notes in Operator view per step and in serial detail view
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

- [x] 8. Barcode/QR: Scanner input component, hotkey, camera QR, auto-detect SN vs cert
  - [x] 8.1 Implement QR camera scanner
    - Create `app/components/QRScanner.vue` — camera-based QR code reader using browser MediaDevices API
    - Integrate with BarcodeInput component: clicking the camera button opens QR scanner overlay
    - On successful scan, dispatch value through the same auto-detect pipeline as manual/scanner input
    - _Requirements: 6.1, 6.2, 6.7_

  - [x] 8.2 Implement barcode/QR lookup and routing logic
    - Enhance `app/composables/useBarcode.ts` — auto-detect scanned value as SN or cert identifier, route to appropriate lookup
    - SN scan: display serial status (job, path, step, certs) in a modal or navigate to serial detail
    - Cert scan: retrieve cert from database, present option to attach to selected serial
    - Not found: display "not found" error with scanned value
    - Cert attachment via scan records same audit trail as manual attachment
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.8_

- [x] 9. Certificate management UI: Cert database, attach to serials, batch attach, QR attach
  - [x] 9.1 Implement Certificate management pages
    - Create `app/components/CertForm.vue` — create certificate with type (material/process), name, metadata key-value pairs
    - Create `app/composables/useCerts.ts` — cert CRUD, attach, batch attach operations
    - Add cert list view accessible from job detail and standalone cert database page
    - Implement batch attach UI: select multiple serials + a cert → batch apply
    - Integrate cert attachment into serial advancement flow (optional cert at each step)
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6_

- [x] 10. Settings page: User management, Jira connection config, field mapping editor
  - [x] 10.1 Implement Settings page
    - Create `app/pages/settings.vue` — tabbed settings page with User Management, Jira Connection, and Field Mapping sections
    - Create `app/components/UserForm.vue` — create/edit user profile (name, department, active toggle)
    - Create `app/components/JiraConnectionForm.vue` — Jira base URL, project key, username, API token, test connection button, global enable toggle, push enable toggle
    - Create `app/components/JiraFieldMappingEditor.vue` — table of Jira custom field ID → SHOP_ERP field mappings, add/edit/remove rows, ships with default PI project mappings
    - Create `app/composables/useSettings.ts` — settings CRUD operations
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 15.1_

- [x] 11. Checkpoint — Core UI complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Jira read integration: Pull tickets, create jobs from tickets
  - [x] 12.1 Implement JiraService
    - Create `server/services/jiraService.ts` with `createJiraService(repos, settingsService)` — `fetchOpenTickets` (JQL: project = PI AND resolution is EMPTY, reads field mappings from settings), `fetchTicketDetail`, `normalizeTicket` (maps PITicket → JiraTicket using configurable field mappings), `linkTicketToJob` (creates Job from ticket data), `getPartNumber` (prefers customfield_10908, falls back to summary regex)
    - Handle connection failures: return cached/previous list with error, 10s timeout
    - Handle null/missing mapped fields gracefully (treat as empty)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 14.6_

  - [x] 12.2 Implement Jira API routes
    - Create `server/api/jira/tickets.get.ts` — fetch open PI tickets (only when Jira enabled)
    - Create `server/api/jira/tickets/[key].get.ts` — fetch single ticket detail
    - Create `server/api/jira/link.post.ts` — link ticket to SHOP_ERP job (creates job + optional path from template)
    - _Requirements: 9.2, 9.3, 9.6_

  - [x] 12.3 Implement Jira Dashboard UI
    - Create `app/pages/jira.vue` — Jira dashboard showing open tickets not yet linked to jobs
    - Create `app/composables/useJira.ts` — fetch tickets, link ticket, refresh
    - Ticket list with apply template button, refresh button, error banner on connection failure
    - Conditionally show/hide all Jira UI based on global Jira toggle from settings
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7_

- [x] 13. Jira push integration (stretch): Description table push, comment push, note-to-comment
  - [x] 13.1 Implement Jira push service methods
    - Add to `server/services/jiraService.ts`: `pushDescriptionTable` (appends date-row table per path to Jira ticket description), `pushCommentSummary` (posts comment with current part counts), `pushNoteAsComment` (formats as `{StepName} - {SN(s)}: {note text}`), `pushCompletionDocs` (uploads certs and summary on job completion)
    - Handle write rejections: retain payload locally for retry, display Jira error
    - Only available when both global Jira toggle AND push toggle are enabled
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 13.2 Implement Jira push API routes and UI
    - Create `server/api/jira/push.post.ts` — push status table to Jira description
    - Create `server/api/jira/comment.post.ts` — push note/defect as Jira comment
    - Add push buttons to job detail page (description table push, comment summary push) — only visible when push enabled
    - Add "Push to Jira" option on StepNoteForm when job is Jira-linked and push enabled
    - _Requirements: 10.1, 10.2, 10.4, 10.5_

- [x] 14. Checkpoint — All features implemented
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Property-based tests: All 13 correctness properties
  - [x] 15.1 Write property test for Job Part Count Invariant
    - **Property 1: Job Part Count Invariant**
    - Test that for any Job with any number of Paths, after any sequence of SN creation/advancement/completion, the Job's total part count equals the sum of SN counts across all Paths
    - Create `tests/properties/jobPartCount.property.test.ts`
    - **Validates: Requirements 1.4, 7.5**

  - [x] 15.2 Write property test for Serial Number Uniqueness
    - **Property 2: Serial Number Uniqueness**
    - Test that for any sequence of batch SN creation operations across any number of Jobs and Paths, all SN identifiers are unique
    - Create `tests/properties/serialUniqueness.property.test.ts`
    - **Validates: Requirements 4.1, 4.2**

  - [x] 15.3 Write property test for Sequential Step Advancement
    - **Property 3: Sequential Step Advancement**
    - Test that advancing a SN at step N results in step N+1 or completion at final step, no other transitions permitted
    - Create `tests/properties/stepAdvancement.property.test.ts`
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 15.4 Write property test for Process Step Count Conservation
    - **Property 4: Process Step Count Conservation**
    - Test that sum of SNs at each step plus completed SNs equals total SNs created on that Path
    - Create `tests/properties/countConservation.property.test.ts`
    - **Validates: Requirements 3.4, 2.4, 7.4**

  - [x] 15.5 Write property test for Domain Object Round-Trip Serialization
    - **Property 5: Domain Object Round-Trip Serialization**
    - Test that `deserialize(serialize(obj))` produces equivalent object for all domain types, including `deserialize(prettyPrint(obj))`
    - Create `tests/properties/roundTrip.property.test.ts`
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.5**

  - [x] 15.6 Write property test for Audit Trail Immutability and Completeness
    - **Property 6: Audit Trail Immutability and Completeness**
    - Test that exactly one audit entry is created per cert attachment/SN creation/SN advancement, and total audit count matches operation count
    - Create `tests/properties/auditTrail.property.test.ts`
    - **Validates: Requirements 5.4, 13.1, 13.2, 13.3, 13.4, 13.5**

  - [x] 15.7 Write property test for Progress Bar Accuracy
    - **Property 7: Progress Bar Accuracy**
    - Test that progress percentage equals `(completed / goal) * 100`, can exceed 100, recalculates on goal change
    - Create `tests/properties/progressBar.property.test.ts`
    - **Validates: Requirements 1.3, 1.5, 7.1, 7.6**

  - [x] 15.8 Write property test for Template Route Independence
    - **Property 8: Template Route Independence**
    - Test that modifying a Path's steps after template application leaves the original template unchanged
    - Create `tests/properties/templateIndependence.property.test.ts`
    - **Validates: Requirements 8.2, 8.3, 8.4**

  - [ ]\* 15.9 Write property test for BOM Roll-Up Consistency
    - **Property 9: BOM Roll-Up Consistency**
    - Test that aggregated completed/in-progress counts equal sums from contributing jobs, zero jobs yields zero counts
    - Create `tests/properties/bomRollUp.property.test.ts`
    - **Validates: Requirements 11.2, 11.3, 11.5**

  - [x] 15.10 Write property test for Batch Certificate Application Idempotence
    - **Property 10: Batch Certificate Application Idempotence**
    - Test that applying same cert to same serials twice produces same state as once, audit entries only on first application
    - Create `tests/properties/batchIdempotence.property.test.ts`
    - **Validates: Requirements 5.3, 5.6**

  - [x] 15.11 Write property test for Invalid Input Rejection
    - **Property 11: Invalid Input Rejection**
    - Test that goalQuantity ≤ 0, zero steps, SN on stepless path, and non-existent cert attachment all reject with descriptive errors and unchanged state
    - Create `tests/properties/inputValidation.property.test.ts`
    - **Validates: Requirements 1.6, 2.6, 4.6, 5.5**

  - [x] 15.12 Write property test for Malformed JSON Error Reporting
    - **Property 12: Malformed JSON Error Reporting**
    - Test that malformed JSON (missing fields, wrong types, invalid structure) returns descriptive error identifying the problematic field
    - Create `tests/properties/malformedJson.property.test.ts`
    - **Validates: Requirements 12.4**

  - [ ]\* 15.13 Write property test for Jira Ticket Filtering
    - **Property 13: Jira Ticket Filtering**
    - Test that Jira dashboard displays only tickets whose keys don't match any existing Job's jiraTicketKey
    - Create `tests/properties/jiraFiltering.property.test.ts`
    - **Validates: Requirements 9.1, 9.5**

- [x] 16. Integration tests and seed data: End-to-end scenarios, seed script with SAMPLE- data
  - [x] 16.1 Write integration tests
    - Create `tests/integration/helpers.ts` — `createTestDb()` using isolated temp SQLite databases
    - Create `tests/integration/jobLifecycle.test.ts` — create job → add paths → create SNs → advance → complete
    - Create `tests/integration/templateApplication.test.ts` — apply template → verify path → customize → verify independence
    - Create `tests/integration/certTraceability.test.ts` — attach certs → batch attach → verify audit trail
    - Create `tests/integration/progressTracking.test.ts` — advance parts → verify percentages → test >100%
    - Create `tests/integration/operatorView.test.ts` — seed multi-step jobs → verify current/coming/backlog
    - Create `tests/integration/noteAndDefect.test.ts` — create notes → verify per-step and per-serial queries
    - _Requirements: 1.1–1.6, 2.1–2.6, 3.1–3.4, 4.1–4.6, 5.1–5.6, 7.1–7.9, 8.1–8.5, 11.1–11.5, 13.1–13.5_

  - [x] 16.2 Create dev seed data script
    - Create `server/scripts/seed.ts` — idempotent seed script that creates SAMPLE- prefixed data
    - 3 templates: `SAMPLE-Standard Machining`, `SAMPLE-With Coating`, `SAMPLE-PCBA Assembly`
    - 4 jobs with paths, serial numbers at various stages, certificates, and notes as described in design
    - Add `npm run seed` and `npm run seed:reset` scripts to `package.json`
    - Seed script checks for existing SAMPLE- data before creating (idempotent)
    - Reset script deletes all SAMPLE- prefixed records then re-seeds
    - _Requirements: 12.1_

- [x] 17. Final checkpoint — All tests pass, typecheck clean, lint clean
  - Ensure all tests pass (`npm run test`), typecheck passes (`npm run typecheck`), lint passes (`npm run lint`). Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after backend and UI phases
- Property tests validate universal correctness properties from the design document
- Integration tests use isolated temp SQLite databases — no shared state
- All seed data uses `SAMPLE-` prefix for easy identification and cleanup
- Jira integration is optional and toggled off by default — standalone features work without it
- The separation of concerns (Components → Composables → API Routes → Services → Repositories) must be maintained throughout implementation
