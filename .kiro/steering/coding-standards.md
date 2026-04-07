---
inclusion: auto
description: "Coding standards for Shop Planr: import resolution, architecture layers, API route patterns, and quality rules."
---

# Coding Standards

## Quality Rules

1. Fix root causes, not symptoms. Understand WHY before changing code.
2. Never use `any`, strip types, or weaken type safety as a shortcut. Make types available properly.
3. Verify fixes end-to-end: run `npm run lint`, `npx nuxt typecheck`, and `npm run test` before considering work done. All three must pass.
4. USelect (Reka UI SelectRoot) must NEVER be bound to a ref typed with `undefined` or `null`. Use the sentinel string `'__none__'` for the unselected state, and include it as a disabled item in the items array so the value types align. Setting `v-model` to `undefined` causes runtime errors in Reka UI.

## Writing Code That Passes Lint

`@nuxt/eslint` stylistic preset + custom rules. Quick reference:

- Trailing comma on last item in multiline arrays, objects, params, and template attributes
- No unused variables/imports — prefix intentionally unused params with `_` (e.g., `_event`)
- `const` over `let` when not reassigned
- No `any` in app/server code (`any` is OK in `tests/**` for mocking)
- Single-word Vue component names are fine (rule disabled)
- `1tbs` brace style — opening brace on same line, `} else {` not `}\nelse {`
- Single quotes, 2-space indent, no semicolons, space before function parens

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

## Request Body Validation (Zod Schemas)

API routes that accept request bodies should validate them with Zod schemas using `parseBody()` (auto-imported from `server/utils/validation.ts`). This ensures invalid input returns a 400 instead of a 500.

Schemas live in `server/schemas/` and are colocated by domain (e.g., `pathSchemas.ts`, `jobSchemas.ts`). Each route imports its schema and calls `parseBody(event, schema)` instead of raw `readBody(event)`.

```ts
// CORRECT — validated input, wrong types → 400
import { createPathSchema } from '../../schemas/pathSchemas'

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, createPathSchema)
  return getServices().pathService.createPath(body)
})
```

```ts
// WRONG — unvalidated input, wrong types → 500
export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  return getServices().pathService.createPath(body)
})
```

When adding a new route with a request body, define a Zod schema in the appropriate `server/schemas/*.ts` file and use `parseBody`. Existing routes are being migrated incrementally — when touching an existing route, convert it to use `parseBody` if it doesn't already.

## API Error Handling — Empty vs. Not Found

A 404 means the resource itself doesn't exist — not that it has zero children. Empty lists are valid 200 responses.

```ts
// WRONG — empty list is not a 404
if (serials.length === 0) throw new NotFoundError('No active parts')

// CORRECT — 404 only when the parent resource is missing
if (!step) throw new NotFoundError('ProcessStep not found')
return { items: serials, count: serials.length } // empty is fine
```
