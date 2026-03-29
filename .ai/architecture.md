# Architecture — SHOP_ERP

> Layer boundaries, separation of concerns, and dependency injection patterns.

## Layer Stack

```
Components/Pages → Composables → API Routes → Services → Repositories → SQLite
     UI only       API client     HTTP glue   Business    Data access    Storage
                                               logic
```

## Layer Rules

| Layer                                              | Allowed                                                          | Forbidden                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Components/Pages (`app/components/`, `app/pages/`) | Render UI, bind composable state, emit events                    | Import from `server/`, contain business logic, call `$fetch` directly             |
| Composables (`app/composables/`)                   | Call `$fetch`, manage reactive state (loading, error, data refs) | Validate domain rules, compute derived domain state, orchestrate multi-entity ops |
| API Routes (`server/api/`)                         | Parse input, call service method, return result                  | Contain business logic, call repos directly, compute domain state                 |
| Services (`server/services/`)                      | All business rules, domain invariants, audit recording           | Import Vue/Nuxt client code, know about HTTP                                      |
| Repositories (`server/repositories/`)              | CRUD + queries, row-to-object mapping                            | Business logic, domain rules, calling other repos                                 |

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
export function createRepositories(config: { type: 'sqlite'; dbPath: string }): RepositorySet {
  switch (config.type) {
    case 'sqlite':
      return createSQLiteRepositories(config.dbPath)
    // Future: case 'postgres': ...
  }
}
```

## Singleton Accessors

- `server/utils/db.ts` → `getRepositories()` — initialized from `runtimeConfig`
- `server/utils/services.ts` → `getServices()` — wires all services with repos

API routes call `getServices().jobService.createJob(...)`.

## API Route Pattern

All routes follow thin-handler pattern with consistent error handling:

```typescript
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const result = await getServices().someService.someMethod(body)
    return result
  } catch (error) {
    if (error instanceof ValidationError)
      throw createError({ statusCode: 400, message: error.message })
    if (error instanceof NotFoundError)
      throw createError({ statusCode: 404, message: error.message })
    throw createError({ statusCode: 500, message: 'Internal server error' })
  }
})
```

## Red Flags

- Composable computing `(completed / goalQuantity) * 100` → move to service
- API route checking `if (goalQuantity <= 0)` → move to service
- Component calling `$fetch` directly → use composable
- Repository enforcing "serial must advance sequentially" → move to service
- API route calling `repos.jobs.create()` directly → call service instead

## Key Files (Planned)

| File                                  | Role                                         |
| ------------------------------------- | -------------------------------------------- |
| `server/utils/db.ts`                  | Repository singleton init                    |
| `server/utils/services.ts`            | Service singleton init                       |
| `server/utils/errors.ts`              | `ValidationError`, `NotFoundError`           |
| `server/utils/idGenerator.ts`         | `generateId(prefix)` + sequential SN counter |
| `server/repositories/factory.ts`      | Returns `RepositorySet` based on config      |
| `server/repositories/sqlite/index.ts` | DB init, WAL mode, migration runner          |
