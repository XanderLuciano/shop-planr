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

## Import Resolution (Nuxt 4)

`~` resolves to `app/` at runtime, but to project root in vitest. This causes runtime errors if misused.

**Server code (`server/`):** NEVER use `~`. Use relative paths only. `server/utils/` exports are auto-imported by Nitro (no import needed for `ValidationError`, `NotFoundError`, `getServices`, `getRepositories`, `defineEventHandler`, `readBody`, `getRouterParam`, `createError`, etc).

**App code (`app/`):** NEVER write `~/app/` (doubles to `app/app/`). Use `~/` which already points to `app/`. Composables, components, and utils are auto-imported. For types not auto-imported, inline the definition.

**Tests (`tests/`):** `~` points to project root via vitest config. `~/server/...` and `~/app/...` both work.

## Architecture

```
Components → Composables → API Routes → Services → Repositories → SQLite
   UI only    $fetch calls   thin handlers  business logic  data access    storage
```

Dependencies flow left-to-right only. No skipping layers.

## API Route Pattern

Thin handlers: parse input → call service → return result. Catch `ValidationError` (400) and `NotFoundError` (404). Both are auto-imported.

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
