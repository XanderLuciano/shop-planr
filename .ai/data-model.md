# Data Model — SHOP_ERP

> SQLite schema, domain types, serialization, and migration strategy.

## Database

- **Engine**: SQLite via `better-sqlite3` (synchronous, embedded)
- **File**: `data/shop_erp.db`
- **Pragmas**: `journal_mode = WAL`, `foreign_keys = ON`

## Core Tables

| Table                   | Purpose                    | Key columns                                                                                |
| ----------------------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| `jobs`                  | Production orders          | id, name, goal*quantity, jira_ticket_key, jira*\* fields                                   |
| `paths`                 | Route instances per job    | id, job_id (FK), name, goal_quantity                                                       |
| `process_steps`         | Ordered steps in a path    | id, path_id (FK), name, step_order, location                                               |
| `serials`               | Individual tracked parts   | id, job_id, path_id, current_step_index (-1=done)                                          |
| `certs`                 | Quality certificates       | id, type (material/process), name, metadata (JSON)                                         |
| `cert_attachments`      | Serial↔cert join           | serial_id, cert_id, step_id, attached_by                                                   |
| `templates`             | Reusable route definitions | id, name                                                                                   |
| `template_steps`        | Steps in a template        | template_id, name, step_order, location                                                    |
| `boms`                  | Bill of materials          | id, name                                                                                   |
| `bom_entries`           | Part types in a BOM        | bom_id, part_type, required_quantity_per_build                                             |
| `bom_contributing_jobs` | Jobs feeding a BOM entry   | bom_entry_id, job_id                                                                       |
| `users`                 | Kiosk-mode user profiles   | id, name, department, active                                                               |
| `audit_entries`         | Append-only action log     | id, action, user_id, timestamp, serial_id, etc.                                            |
| `settings`              | Singleton app config       | id='app_settings', jira_connection (JSON), jira_field_mappings (JSON), page_toggles (JSON) |
| `step_notes`            | Defect/note records        | id, step_id, serial_ids (JSON), text, created_by                                           |
| `_migrations`           | Migration tracking         | version, name, applied_at, checksum                                                        |
| `counters`              | SN sequential counter      | (planned in migration 002)                                                                 |

## Key Constraints

- `cert_attachments` has `UNIQUE(serial_id, cert_id, step_id)` for idempotent attachment
- `process_steps` has `UNIQUE(path_id, step_order)` for ordering integrity
- `audit_entries` is append-only — service layer enforces no UPDATE/DELETE
- `serials.current_step_index = -1` means completed

## Domain Types (planned: `server/types/domain.ts`)

Core interfaces: `Job`, `Path`, `ProcessStep`, `SerialNumber`, `Certificate`, `CertAttachment`, `TemplateRoute`, `TemplateStep`, `BOM`, `BomEntry`, `AuditEntry`, `ShopUser`, `StepNote`, `AppSettings`, `JiraConnectionSettings`, `JiraFieldMapping`, `PageToggles`, `FilterState`

API input types (planned: `server/types/api.ts`): `CreateJobInput`, `UpdateJobInput`, `CreatePathInput`, `BatchCreateSerialsInput`, `AdvanceSerialInput`, `AttachCertInput`, `CreateCertInput`, `BatchAttachCertInput`, `CreateTemplateInput`, `ApplyTemplateInput`, `CreateBomInput`, `LinkJiraInput`, `PushToJiraInput`

Computed view types (planned: `server/types/computed.ts`): `JobProgress`, `StepDistribution`, `BomSummary`, `BomEntrySummary`, `OperatorStepView`, `OperatorPartInfo`

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
- `step_notes.serial_ids` — `string[]`
- `audit_entries.metadata` — `Record<string, string>`

## Migration Strategy

- Files: `server/repositories/sqlite/migrations/{NNN}_{description}.sql`
- Runner: auto-runs on startup, tracks in `_migrations` table with checksums
- Forward-only in production — never modify applied migrations
- Each migration runs in a transaction
- Dev reset: delete `data/shop_erp.db` and restart
