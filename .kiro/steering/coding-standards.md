---
inclusion: auto
description: "Coding standards for Shop Planr: import resolution, architecture layers, API route patterns, and quality rules."
---

# Coding Standards

## Quality Rules

1. Fix root causes, not symptoms. Understand WHY before changing code.
2. Never use `any`, strip types, or weaken type safety as a shortcut. Make types available properly.
3. Verify fixes end-to-end: tests pass AND dev server runs clean.

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
