# GitHub Copilot Code Review Instructions

## Scope

Skip PR body vs. code alignment checks — the description is intentionally high-level. Focus exclusively on the actual diff.

## What to Review

### Code Quality & Project Conventions

- **Layer boundaries**: Components/pages are UI-only; composables are thin API clients; API routes parse input and delegate; services hold all business logic; repositories do CRUD only. Flag any cross-layer leakage (e.g., business logic in a composable, a repository enforcing domain rules, an API route calling `repos.*` directly).
- **API route pattern**: All routes must use `defineApiHandler`, never `defineEventHandler` with manual try/catch. Flag any route using `createError()` for 400/404 — use `ValidationError` / `NotFoundError` instead.
- **Request body validation**: Routes with a request body must call `parseBody(event, schema)` with a Zod schema from `server/schemas/`. Flag any unvalidated `readBody()` call in a modified route.
- **Authenticated fetch**: Composables calling `/api/` must use `const $api = useAuthFetch()`, not bare `$fetch`. Exception: `useAuth()` (circular dependency).
- **Date formatting**: App and server code must use `formatDate()`, `formatDateTime()`, or `formatShortDate()` from `app/utils/dateFormatting.ts`. Flag any inline `toLocaleString()` / `toLocaleDateString()` / `toLocaleTimeString()` call outside that file.
- **Select sentinels**: Dropdown/filter sentinel strings must come from the named constants in `app/utils/selectSentinel.ts` (`SELECT_NONE`, `SELECT_UNASSIGNED`, `SELECT_ALL`). Flag raw `'__none__'`-style literals scattered elsewhere.
- **Import paths**: Server code must use relative imports only (no `~`). App code uses `~/` (which resolves to `app/`), never `~/app/`. Flag `~/app/` paths in app code or `~` in server code.
- **Migrations**: Flag any edit to an existing migration file — new behaviour always requires a new migration.
- **Style**: 1tbs brace style, trailing commas on multiline structures, `const` over `let`, no semicolons, 2-space indent, single quotes.

### Bugs, Logic Errors & Edge Cases

- Incorrect error semantics: 404 means the resource doesn't exist, not that a collection is empty. Empty lists are valid 200 responses.
- Off-by-one errors in step sequencing or serial advancement.
- Missing null/undefined guards on data that may not exist (e.g., optional relations, optional query params).
- Race conditions in concurrent reactive state (especially multi-entity composables).
- Auth checks that can be bypassed (admin-gated operations that skip the `isAdmin` guard).

### Inefficiencies

- N+1 query patterns: a loop that calls a repository or `$api` per item — flag and suggest a bulk endpoint or a single batched query.
- Unnecessary re-renders: reactive refs or computed values that are recreated on every render when they could be memoised or derived once.
- Redundant work: duplicate API calls for the same data, re-processing already-aggregated data, re-sorting/filtering already-sorted/filtered results.

### Anti-Patterns & Unsustainable Code

- Positional step tracking (index-based) instead of step-ID-based tracking.
- Hard-deletes on entities with FK references or historical records — prefer soft-delete (`removed_at`).
- Read-time aggregation for hot counters — prefer write-time counter columns with a reconciliation path.
- Magic strings for sentinel values instead of the constants in `selectSentinel.ts`.
- Binding USelect to a ref typed with `undefined` or `null` — use `SELECT_NONE` (`'__none__'`) as the unselected sentinel.

### Comments & Documentation

- Stale comments that describe old behaviour or reference removed code.
- Misleading variable or function names that contradict what the code actually does.
- Missing comments on non-obvious logic (complex SQL, multi-step transactions, tricky reactive flows).

### Type Safety

- `any` or `as any` outside `tests/**` — fix the type instead of casting.
- Unnecessary `as SomeType` assertions in app/server code outside validated trust boundaries (e.g., parsed external JSON, library interop).
- Missing return-type annotations on exported service/repository methods where inference is ambiguous.

### New Tech Debt

- Flag tech debt **introduced by this PR** (e.g., a new `readBody()` call without Zod validation, a new bare `$fetch` call in a composable).
- Do **not** flag pre-existing debt in files that are only incidentally visible in the diff but not modified.
