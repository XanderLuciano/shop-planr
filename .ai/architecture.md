# Architecture — SHOP_ERP

> Layer boundaries, separation of concerns, and dependency injection patterns.

## Layer Stack

```
Components/Pages → Composables → API Routes → Services → Repositories → SQLite
     UI only       API client     HTTP glue   Business    Data access    Storage
                  (useAuthFetch)               logic
```

## Layer Rules

| Layer | Allowed | Forbidden |
|-------|---------|-----------|
| Components/Pages (`app/components/`, `app/pages/`) | Render UI, bind composable state, emit events | Import from `server/`, contain business logic, call `$fetch`/`$api` directly |
| Composables (`app/composables/`) | Use `useAuthFetch()` for API calls, manage reactive state (loading, error, data refs) | Validate domain rules, compute derived domain state, orchestrate multi-entity ops |
| API Routes (`server/api/`) | Parse input, call service method, return result | Contain business logic, call repos directly, compute domain state |
| Services (`server/services/`) | All business rules, domain invariants, audit recording | Import Vue/Nuxt client code, know about HTTP |
| Repositories (`server/repositories/`) | CRUD + queries, row-to-object mapping | Business logic, domain rules, calling other repos |

## Dependency Injection

Services receive repository instances via factory functions:

```typescript
// Service creation pattern
export function createJobService(repos: { jobs: JobRepository, paths: PathRepository, serials: SerialRepository }) {
  return {
    async createJob(input: CreateJobInput): Promise<Job> { ... },
    // ...
  }
}
```

## Repository Factory

Single point for swapping database backends:

```typescript
// server/repositories/factory.ts
export function createRepositories(config: { type: 'sqlite', dbPath: string }): RepositorySet {
  switch (config.type) {
    case 'sqlite': return createSQLiteRepositories(config.dbPath)
    // Future: case 'postgres': ...
  }
}
```

## Singleton Accessors

- `server/utils/db.ts` → `getRepositories()` — initialized from `runtimeConfig`
- `server/utils/services.ts` → `getServices()` — wires all services with repos

API routes call `getServices().jobService.createJob(...)`.

## API Route Pattern

All routes use `defineApiHandler` (from `server/utils/httpError.ts`, auto-imported by Nitro) which provides centralized error handling with correct RFC 9110 status messages:

```typescript
export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  return getServices().someService.someMethod(body)
})
```

`defineApiHandler` wraps the handler in a try/catch that maps errors automatically:
- `ValidationError` → 400 "Bad Request"
- `NotFoundError` → 404 "Not Found"
- H3Errors (from `createError()`) → re-thrown unchanged
- Unknown errors → 500 "Internal Server Error" (original message not leaked)

Do NOT use `defineEventHandler` with manual try/catch blocks. Do NOT use inline `createError()` for 400/404 — throw `ValidationError` or `NotFoundError` instead so the status message mapping is applied.

## Red Flags

- Composable computing `(completed / goalQuantity) * 100` → move to service
- API route checking `if (goalQuantity <= 0)` → move to service
- Component calling `$fetch` or `$api` directly → use composable
- Composable using bare `$fetch` instead of `useAuthFetch()` → fix
- Repository enforcing "serial must advance sequentially" → move to service
- API route calling `repos.jobs.create()` directly → call service instead
- API route using `readBody()` without Zod schema → add `parseBody(event, schema)`
- Schema file declaring `z.string().min(1)` for an ID or `z.number().int().positive()` for a quantity → import from `server/schemas/_primitives.ts` instead

## Key Files (Planned)

| File | Role |
|------|------|
| `server/utils/db.ts` | Repository singleton init |
| `server/utils/services.ts` | Service singleton init |
| `server/utils/errors.ts` | `ValidationError`, `NotFoundError`, `ForbiddenError`, `AuthenticationError` |
| `server/utils/httpError.ts` | `defineApiHandler`, `httpError`, `STATUS_MESSAGES`, `ERROR_STATUS_MAP` |
| `server/utils/idGenerator.ts` | `generateId(prefix)` + sequential SN counter |
| `server/utils/validation.ts` | `parseBody()` — Zod schema validation for request bodies |
| `server/schemas/_primitives.ts` | Shared Zod building blocks (`requiredId`, `positiveInt`, domain enums, batch ID arrays, `pinSchema`) — imported by all domain schema files |
| `server/repositories/factory.ts` | Returns `RepositorySet` based on config |
| `server/repositories/sqlite/index.ts` | DB init, WAL mode, migration runner |
| `server/services/authService.ts` | PIN hashing, JWT sign/verify (ES256), key pair management, token refresh |
| `server/middleware/02.auth.ts` | JWT auth middleware — protects `/api/` routes, exempt list |
| `server/middleware/01.rateLimit.ts` | Tiered rate limiting (login/auth/unauth) |
| `app/plugins/auth.ts` | Provides `$authFetch` via `nuxtApp.provide` using `$fetch.create()` |
| `app/composables/useAuth.ts` | Session management: token cookie, decoded JWT user, login/logout/refresh |
| `app/composables/useAuthFetch.ts` | `useAuthFetch()` — returns per-app authenticated `$fetch` instance |

## Authentication Architecture

### Flow

1. User selects username → enters 4-digit PIN (or sets PIN on first login)
2. `POST /api/auth/login` → `authService.login()` → bcrypt compare → ES256 JWT signed
3. JWT stored in `shop-planr-auth-token` cookie via `useCookie()` (SSR-safe)
4. `app/plugins/auth.ts` creates `$authFetch` instance that auto-injects `Authorization: Bearer <token>` on `/api/` requests
5. `server/middleware/02.auth.ts` verifies JWT on all non-exempt `/api/` routes, sets `event.context.auth.user`
6. Token auto-refreshes at 80% of lifetime via `scheduleRefresh()` in `useAuth()`

### JWT Payload

All user properties are embedded in the JWT — no DB lookup needed on the client:

```ts
interface JwtPayload {
  sub: string        // userId
  username: string
  displayName: string
  isAdmin: boolean
  department?: string
  active: boolean
  createdAt: string
  iat: number
  exp: number
}
```

Access via `useAuth().authenticatedUser` (decoded from cookie, no network call).

### Key Pair Storage

ES256 key pair stored in `crypto_keys` table. Generated on first boot, cached in memory. `authService.ensureKeyPair()` called during service init.


## Architectural Decisions

### Part Position Tracking: Step-ID Based

Parts track their current position via `current_step_id` (FK to `process_steps`), not a positional integer index. This means reordering steps in a path never virtually relocates parts — the part stays anchored to the same physical step regardless of ordering changes. Completed parts have `current_step_id = NULL`.

### Routing History: Append-Only with Sequence Numbers

Each part's journey through process steps is recorded in `part_step_statuses` as an append-only log. Each visit to a step gets a new row with an incrementing `sequence_number`. Multiple visits to the same step (recycling) produce distinct entries. The "current" status for a step is always the row with the highest sequence number. Never update or delete historical routing entries.

### Write-Time Counters

Frequently-read derived counts (e.g., `process_steps.completed_count`) are maintained as write-time counters, atomically incremented during the operation that changes the count. This avoids expensive aggregation queries on every read. A reconciliation operation exists to re-sync counters from source data if drift occurs.

### Soft-Delete Preference

Entities referenced by historical records use soft-delete (`removed_at` timestamp) rather than physical deletion. This preserves FK integrity and audit trail completeness. Currently applies to `process_steps`; other entities will migrate to this pattern over time.

### Reconcile Steps by ID

The `reconcileSteps` function matches incoming step edits to existing steps by step ID (not by array position). This preserves step identity, assignments, routing history references, and all FK relationships during path edits. New steps (no ID) get generated IDs; removed steps (ID not in input) are soft-deleted.
