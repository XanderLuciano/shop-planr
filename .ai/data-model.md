# Data Model — SHOP_ERP

> SQLite schema, domain types, serialization, and migration strategy.

## Database

- **Engine**: SQLite via `better-sqlite3` (synchronous, embedded)
- **File**: `data/shop_erp.db`
- **Pragmas**: `journal_mode = WAL`, `foreign_keys = ON`

## Core Tables

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `jobs` | Production orders | id, name, goal_quantity, jira_ticket_key, jira_* fields |
| `paths` | Route instances per job | id, job_id (FK), name, goal_quantity, advancement_mode |
| `process_steps` | Ordered steps in a path | id, path_id (FK), name, step_order, location, assigned_to, optional, dependency_type, removed_at, completed_count |
| `parts` | Individual tracked parts | id, job_id, path_id, current_step_id (FK, NULL=completed), status, scrap fields, force-complete fields |
| `part_step_statuses` | Routing history per part | id, part_id (FK), step_id (FK), sequence_number, status, entered_at, completed_at |
| `part_step_overrides` | Step overrides per part | id, part_id (FK), step_id (FK), active, reason, created_by |
| `certs` | Quality certificates | id, type (material/process), name, metadata (JSON) |
| `cert_attachments` | Part↔cert join | part_id, cert_id, step_id, attached_by |
| `templates` | Reusable route definitions | id, name |
| `template_steps` | Steps in a template | template_id, name, step_order, location |
| `boms` | Bill of materials | id, name |
| `bom_entries` | Part types in a BOM | bom_id, part_type, required_quantity_per_build |
| `bom_contributing_jobs` | Jobs feeding a BOM entry | bom_entry_id, job_id |
| `users` | Kiosk-mode user profiles | id, username (UNIQUE), display_name, is_admin, department, active |
| `audit_entries` | Append-only action log | id, action, user_id, timestamp, part_id, etc. |
| `settings` | Singleton app config | id='app_settings', jira_connection (JSON), jira_field_mappings (JSON), page_toggles (JSON) |
| `step_notes` | Defect/note records | id, step_id, part_ids (JSON), text, created_by |
| `_migrations` | Migration tracking | version, name, applied_at, checksum |
| `counters` | Part ID sequential counter | name='part', value |

## Key Constraints

- `cert_attachments` has `UNIQUE(part_id, cert_id, step_id)` for idempotent attachment
- `process_steps` has `UNIQUE(path_id, step_order)` for ordering integrity
- `part_step_statuses` has composite index on `(part_id, step_id, sequence_number)` — no UNIQUE constraint (allows multiple visits)
- `audit_entries` is append-only — service layer enforces no UPDATE/DELETE
- `parts.current_step_id = NULL` means completed
- `process_steps.removed_at IS NOT NULL` means soft-deleted (excluded from active routing)

## Domain Types (`server/types/domain.ts`)

Core interfaces: `Job`, `Path`, `ProcessStep`, `Part`, `Certificate`, `CertAttachment`, `TemplateRoute`, `TemplateStep`, `BOM`, `BomEntry`, `AuditEntry`, `ShopUser`, `StepNote`, `AppSettings`, `JiraConnectionSettings`, `JiraFieldMapping`, `PageToggles`, `FilterState`, `PartStepStatus`, `PartStepOverride`, `StepInput`

API input types (`server/types/api.ts`): `CreateJobInput`, `UpdateJobInput`, `CreatePathInput`, `UpdatePathInput`, `BatchCreatePartsInput`, `AdvancePartInput`, `AdvanceToStepInput`, `AttachCertInput`, `CreateCertInput`, `BatchAttachCertInput`, `CreateTemplateInput`, `ApplyTemplateInput`, `CreateBomInput`, `LinkJiraInput`, `PushToJiraInput`, `ScrapPartInput`, `ForceCompleteInput`

Computed view types (`server/types/computed.ts`): `JobProgress`, `StepDistribution`, `BomSummary`, `BomEntrySummary`, `OperatorStepView`, `OperatorPartInfo`, `EnrichedPart`, `WorkQueueJob`, `WorkQueueResponse`, `FullRouteResponse`, `FullRouteEntry`

## ID Generation

- Most entities: `{prefix}_{nanoid(12)}` — e.g. `job_V1StGXR8_Z5j`
- Serial numbers: Sequential `SN-00001` format, counter persisted in DB `counters` table

## JSON Fields

These columns store `JSON.stringify()` output as TEXT:
- `certs.metadata` — `Record<string, string>`
- `jobs.jira_labels` — `string[]`
- `settings.jira_connection` — `JiraConnectionSettings`
- `settings.jira_field_mappings` — `JiraFieldMapping[]`
- `settings.page_toggles` — `PageToggles` (9 boolean keys: jobs, serials, parts, queue, templates, bom, certs, jira, audit)
- `step_notes.part_ids` — `string[]`
- `audit_entries.metadata` — `Record<string, string>`

## Migration Strategy

- Files: `server/repositories/sqlite/migrations/{NNN}_{description}.sql`
- Runner: auto-runs on startup, tracks in `_migrations` table with checksums
- Forward-only in production — never modify applied migrations
- Each migration runs in a transaction
- Dev reset: delete `data/shop_erp.db` and restart
