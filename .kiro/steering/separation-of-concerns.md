---
inclusion: auto
description: "Layer boundaries and separation of concerns: components, composables, API routes, services, repositories, and migration rules."
---

# Separation of Concerns — SHOP_ERP

When writing or reviewing code for SHOP_ERP, enforce these layer boundaries strictly.

## Layer Rules

- **Components / Pages** (`app/components/`, `app/pages/`): UI rendering only. Call composable methods. Never import from `server/`, never contain business logic, never call `$fetch` directly.
- **Composables** (`app/composables/`): Thin API clients. Call `$fetch` to API routes, manage reactive UI state (loading, error, data refs). Never validate domain rules, never compute derived domain state, never orchestrate multi-entity operations.
- **API Routes** (`server/api/`): Parse request input, call a service method, return the result. Never contain business logic, never call repositories directly, never orchestrate cross-entity operations.
- **Services** (`server/services/`): ALL business logic lives here. Validation, domain invariants, computed state, cross-entity orchestration, audit trail recording. Services receive repository instances via dependency injection. Services never import Vue/Nuxt client code and never know about HTTP.
- **Repositories** (`server/repositories/`): CRUD and queries only. No business logic, no domain rules, no calling other repositories.

## Red Flags to Watch For

- A composable computing `(completed / goalQuantity) * 100` → move to service
- An API route checking `if (goalQuantity <= 0)` → move to service
- A component calling `$fetch` directly instead of using a composable → use composable
- A repository enforcing "serial must advance sequentially" → move to service
- An API route calling `repos.jobs.create()` directly → call service instead

## Migration Rules

- Never modify a migration file after it has been applied. Always create a new migration.
- Migration files live in `server/repositories/sqlite/migrations/` with format `{NNN}_{description}.sql`.
- Each migration runs in a transaction. If it fails, the database stays at the previous version.


## Data Integrity Preferences

- **Soft-deletes over hard-deletes**: Prefer `removed_at` timestamp columns over physical row deletion for any entity that may be referenced by historical records (routing history, audit trail, certificates, notes). This preserves FK integrity and ensures the audit trail remains complete. Currently `process_steps` uses this pattern; all entities will eventually migrate to soft-delete.
- **Write-time counters over read-time aggregation**: For frequently-read derived counts (e.g., "how many parts completed this step"), maintain a counter column that is atomically incremented during the write operation, rather than computing the count from a query on every read. Provide a reconciliation operation to re-sync if drift occurs.
- **Step-ID-based tracking**: Parts track their position by step ID (`current_step_id`), not by positional index. This ensures reordering steps never virtually relocates parts. The step ID is the stable anchor; the step's `order` field is mutable.
- **Append-only routing history**: A part's journey through process steps is recorded as an append-only log in `part_step_statuses` with incrementing `sequence_number`. Multiple visits to the same step (recycling) produce distinct entries. Never update or delete historical routing entries.
