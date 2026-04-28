---
inclusion: auto
description: "Coding standards for Shop Planr: import resolution, architecture layers, API route patterns, and quality rules."
---

# Coding Standards

## Quality Rules

1. Fix root causes, not symptoms. Understand WHY before changing code.
2. Never use `any`, `as any`, or unnecessary type assertions (`as SomeType`) to silence the compiler. If a type doesn't fit, fix the type — don't cast around it. `as` casts are acceptable only at trust boundaries (e.g., parsing external JSON, library interop) where you've validated the shape. `any` is OK in `tests/**` for mocking.
3. Verify fixes end-to-end: run `npm run lint`, `npx nuxt typecheck`, and `npm run test` before considering work done. All three must pass.
4. USelect (Reka UI SelectRoot) must NEVER be bound to a ref typed with `undefined` or `null`. Use the sentinel string `'__none__'` for the unselected state, and include it as a disabled item in the items array so the value types align. Setting `v-model` to `undefined` causes runtime errors in Reka UI.
5. When grouping connected UI elements (e.g., split buttons via `UFieldGroup`), always use the same `variant` and `color` on all elements unless explicitly asked to differ. Mismatched variants cause visual inconsistencies (different backgrounds, hover states, borders) that look broken.

## Writing Code That Passes Lint

`@nuxt/eslint` stylistic preset + custom rules. Quick reference:

- Trailing comma on last item in multiline arrays, objects, params, and template attributes
- No unused variables/imports — prefix intentionally unused params with `_` (e.g., `_event`)
- `const` over `let` when not reassigned
- No `any` or `as any` in app/server code (OK in `tests/**` for mocking)
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
   UI only    API client     HTTP glue   Business    Data access    Storage
              (useAuthFetch)              logic
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

API routes that accept request bodies MUST validate them with Zod schemas using `parseBody()` (auto-imported from `server/utils/validation.ts`). This ensures invalid input returns a 400 instead of a 500.

Schemas live in `server/schemas/` and are colocated by domain (e.g., `pathSchemas.ts`, `jobSchemas.ts`). Each route imports its schema and calls `parseBody(event, schema)` instead of raw `readBody(event)`.

### Shared Primitives (`server/schemas/_primitives.ts`)

Common field patterns are centralized in `_primitives.ts` to avoid duplication across schema files. When writing a new schema, import from `_primitives` instead of re-declaring the same patterns:

| Primitive | Type | Use for |
|---|---|---|
| `requiredId` | `z.string().min(1)` | Any required entity ID field (jobId, pathId, stepId, certId, etc.) |
| `positiveInt` | `z.number().int().positive()` | goalQuantity, requiredQuantity, priority |
| `dependencyTypeEnum` | `z.enum([...])` | Step dependency type (physical/preferred/completion_gate) |
| `advancementModeEnum` | `z.enum([...])` | Path advancement mode (strict/flexible/per_step) |
| `scrapReasonEnum` | `z.enum([...])` | Scrap reason values |
| `certTypeEnum` | `z.enum([...])` | Certificate type (material/process) |
| `batchIds100` | `z.array(requiredId).min(1).max(100)` | Standard batch operations (advance, overrides) |
| `batchIds500` | `z.array(requiredId).min(1).max(500)` | Larger read-only batch fetches (step statuses) |
| `pinSchema` | `z.string().regex(/^\d{4}$/)` | 4-digit PIN |

When adding a new primitive, add it to `_primitives.ts` with a descriptive name and JSDoc comment. Never scatter raw `z.string().min(1)` for ID fields or `z.number().int().positive()` for quantities across schema files — use the shared primitive.

```ts
// CORRECT — use shared primitives
import { requiredId, positiveInt } from './_primitives'

export const mySchema = z.object({
  jobId: requiredId,
  quantity: positiveInt,
})
```

```ts
// WRONG — re-declares patterns that already exist in _primitives
export const mySchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
  quantity: z.number().int().positive('quantity must be positive'),
})
```

### Route Pattern

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

When adding a new route with a request body, define a Zod schema in the appropriate `server/schemas/*.ts` file and use `parseBody`. Existing routes without Zod validation are tech debt — when touching an existing route for any reason, convert it to use `parseBody` if it doesn't already. Do not leave unvalidated `readBody()` calls in files you modify.

## API Error Handling — Empty vs. Not Found

A 404 means the resource itself doesn't exist — not that it has zero children. Empty lists are valid 200 responses.

```ts
// WRONG — empty list is not a 404
if (serials.length === 0) throw new NotFoundError('No active parts')

// CORRECT — 404 only when the parent resource is missing
if (!step) throw new NotFoundError('ProcessStep not found')
return { items: serials, count: serials.length } // empty is fine
```

## Authenticated Fetch (`useAuthFetch`)

All composables that call `/api/` routes MUST use `useAuthFetch()` instead of bare `$fetch`. It returns a per-app `$fetch.create()` instance that auto-injects the `Authorization` header.

```ts
// CORRECT
const $api = useAuthFetch()
const jobs = await $api<Job[]>('/api/jobs')

// WRONG — bare $fetch skips auth header
const jobs = await $fetch<Job[]>('/api/jobs')
```

Exception: `useAuth()` uses bare `$fetch` (circular dependency with the auth plugin). Its endpoints are auth-exempt or pass the header manually.

Never mutate `globalThis.$fetch`. Access the authenticated user anywhere via `useAuth().authenticatedUser` (decoded from JWT cookie, no network call).
