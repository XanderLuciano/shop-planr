---
inclusion: auto
description: "Coding standards for Shop Planr: import resolution, architecture layers, API route patterns, and quality rules."
---

# Coding Standards

## Quality Rules

1. Fix root causes, not symptoms. Understand WHY before changing code.
2. Never use `any`, strip types, or weaken type safety as a shortcut. Make types available properly.
3. Verify fixes end-to-end: tests pass AND dev server runs clean.
4. USelect (Reka UI SelectRoot) must NEVER be bound to a ref typed with `undefined` or `null`. Use the sentinel string `'__none__'` for the unselected state, and include it as a disabled item in the items array so the value types align. Setting `v-model` to `undefined` causes runtime errors in Reka UI.

## Select & Filter Sentinels

All sentinel values for select/filter dropdowns live in `app/utils/selectSentinel.ts` (auto-imported by Nuxt). Never use raw magic strings — import the named constant.

| Constant | Value | Purpose |
|---|---|---|
| `SELECT_NONE` | `'__none__'` | Disabled placeholder for "no selection yet" |
| `SELECT_UNASSIGNED` | `'__unassigned__'` | Selectable option meaning "remove assignment" |
| `SELECT_ALL` | `'__all__'` | Selectable option meaning "show everything / no filter" |

Helpers: `selectedOrUndefined()`, `selectedOrNull()`, `selectedAllOrUndefined()`.

When adding a new sentinel, add it to `selectSentinel.ts` with a typed constant, a type alias, and a helper function. Never scatter `'__foo__'` literals across components.

## Import Resolution (Nuxt 4)

`~` resolves to `app/` at runtime, but to project root in vitest. This causes runtime errors if misused.

**Server code (`server/`):** NEVER use `~`. Use relative paths only. `server/utils/` exports are auto-imported by Nitro (no import needed for `ValidationError`, `NotFoundError`, `getServices`, `getRepositories`, `defineApiHandler`, `readBody`, `getRouterParam`, etc).

**App code (`app/`):** NEVER write `~/app/` (doubles to `app/app/`). Use `~/` which already points to `app/`. Composables, components, and utils are auto-imported. For types not auto-imported, inline the definition.

**Tests (`tests/`):** `~` points to project root via vitest config. `~/server/...` and `~/app/...` both work.

## Architecture

```
Components → Composables → API Routes → Services → Repositories → SQLite
   UI only    $fetch calls   thin handlers  business logic  data access    storage
```

Dependencies flow left-to-right only. No skipping layers.

## API Route Pattern

All API routes MUST use `defineApiHandler` (from `server/utils/httpError.ts`, auto-imported) instead of `defineEventHandler`. This wrapper provides centralized error handling with correct RFC 9110 status messages. Do NOT use `defineEventHandler` or manual try/catch blocks in routes.

```ts
// CORRECT — use defineApiHandler, no try/catch needed
export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  return getServices().jobService.createJob(body)
})
```

```ts
// WRONG — do NOT use defineEventHandler with manual catch blocks
export default defineEventHandler(async (event) => {
  try { ... } catch (error) { ... }
})
```

For input validation errors in route handlers, throw `ValidationError` (auto-imported). For missing resources, throw `NotFoundError` (auto-imported). Do NOT use inline `createError()` for 400/404 errors — it bypasses the centralized status message mapping and produces incorrect `statusMessage` values.

```ts
// CORRECT
if (!id) throw new ValidationError('ID is required')

// WRONG — missing statusMessage, produces "Server Error"
if (!id) throw createError({ statusCode: 400, message: 'ID is required' })
```

## API Error Handling — Empty vs. Not Found

NEVER throw `NotFoundError` (404) when a resource exists but has zero child items. A 404 means the resource itself doesn't exist in the database — not that it's empty.

**Anti-pattern (DO NOT):**
```ts
const serials = await serialService.listByStep(stepId)
if (serials.length === 0) throw new NotFoundError('No active parts') // WRONG
```

**Correct pattern:**
```ts
const step = await pathService.getStepById(stepId)
if (!step) throw new NotFoundError('ProcessStep not found') // resource truly missing

const serials = await serialService.listByStep(stepId)
return { items: serials, count: serials.length } // empty is valid, return 200
```

This applies to all list/collection endpoints. An empty list is a valid response — the parent resource exists, it just has no children right now. Reserve 404 for when the parent resource itself is not found.

**Bug reference:** GitHub #2 — step endpoints returned 404 when serial count was 0, making first steps inaccessible after advancing all serials.

## Quality Gates

Before considering any task complete, run these checks and ensure they all pass:

1. **Lint** — `npx eslint --quiet .` must report zero errors. Use `--quiet` to suppress warnings.
2. **Typecheck** — `npx nuxi typecheck` must pass with no `error TS` output.
3. **Tests** — `npx vitest run` must pass. Property test timeouts are known flakes — if the only failures are `Test timed out in 5000ms` on property tests, that's acceptable.

If any check fails due to your changes, fix it before moving on. Do not leave broken lint, types, or tests for the next person.

## Lint Style Notes

- Trailing commas are required on multiline constructs (`always-multiline`). The Nuxt preset enforces this via `@stylistic/comma-dangle`.
- No semicolons — the codebase follows the Nuxt/Vue convention (ASI).
- `catch (e)` — do NOT annotate catch variables with `: any`. The tsconfig sets `useUnknownInCatchVariables: false`, so `e` is implicitly `any`. Just write `catch (e)`.
- `no-explicit-any` is enforced in source code (`app/`, `server/`). In test files it's turned off. Do NOT use `any` in source code — find or create proper types instead.
- Unused variables must be prefixed with `_` or removed. Prefer removing dead code over prefixing — only use `_` for intentionally ignored params (e.g., `(_event, row) => ...`).
- NEVER use `eslint-disable` comments to bypass lint rules. Fix the underlying issue instead.
