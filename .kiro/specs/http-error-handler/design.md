# Design Document: HTTP Error Handler

## Overview

Shop Planr's API layer has ~70 route files that each contain an identical try/catch block mapping `ValidationError` → 400 and `NotFoundError` → 404. None of these catch blocks set `statusMessage`, so Nuxt/Nitro defaults every error response to "Server Error" regardless of the actual status code (GitHub Issue #28). Additionally, two variants of the catch block exist: most routes re-throw unknown errors (`throw error`), while a handful wrap them in `createError({ statusCode: 500, message: 'Internal server error' })`.

This design introduces three things:

1. A `STATUS_MESSAGES` map — HTTP status code → RFC 9110 reason phrase lookup.
2. An `ERROR_STATUS_MAP` — data-driven error class → status code mapping for extensibility.
3. A `defineApiHandler(fn)` wrapper — replaces `defineEventHandler` + try/catch in every route, centralizing all error classification in one place.

The wrapper lives in `server/utils/httpError.ts`, which Nitro auto-imports. Migration is mechanical: each route replaces `defineEventHandler(async (event) => { try { ... } catch { ... } })` with `defineApiHandler(async (event) => { ... })`, removing the catch block entirely.

## Architecture

```
API Route File                          server/utils/httpError.ts
┌──────────────────────┐               ┌──────────────────────────────────┐
│ defineApiHandler(    │               │ STATUS_MESSAGES: Map<number,str> │
│   async (event) => { │  ──wraps──▶  │ ERROR_STATUS_MAP: Array<{        │
│     // happy path    │               │   errorClass, statusCode }>      │
│   }                  │               │ httpError(error): H3Error        │
│ )                    │               │ defineApiHandler(fn): handler    │
└──────────────────────┘               └──────────────────────────────────┘
                                                    │
                                                    ▼
                                        createError({ statusCode,
                                          statusMessage, message })
```

The architecture stays within the existing layer model: API routes remain thin HTTP glue, and the error handler is a utility in `server/utils/` (auto-imported by Nitro, no explicit imports needed).

### Design Decisions

1. **Single file (`server/utils/httpError.ts`)** — All three exports (`STATUS_MESSAGES`, `ERROR_STATUS_MAP`, `defineApiHandler`) live in one file. The map, the mapping, and the wrapper are tightly coupled and small enough to colocate. Splitting them would add import complexity for no benefit.

2. **Array-based `ERROR_STATUS_MAP` over Map/object** — An array of `{ errorClass, statusCode }` entries preserves insertion order and allows `instanceof` checks (which need the actual class constructor, not a string key). Adding a new error type means pushing one entry.

3. **`defineApiHandler` naming** — Follows Nitro's `defineEventHandler` convention. The name signals "this is a drop-in replacement that adds error handling."

4. **H3Error passthrough** — If the caught error is already an H3Error (from `createError()`), it's re-thrown unchanged. This preserves any upstream error details set by middleware or manual `createError()` calls in route logic.

5. **Unknown errors → 500 with generic message** — Unknown errors get `statusCode: 500`, `statusMessage: "Internal Server Error"`, `message: "Internal server error"`. The original error message is NOT exposed to the client (security: prevents leaking stack traces or internal details).

## Components and Interfaces

### `STATUS_MESSAGES` — Status Code → Reason Phrase Map

```typescript
export const STATUS_MESSAGES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
}
```

A plain object mapping HTTP status codes to their RFC 9110 reason phrases. Exported so tests and other utilities can reference it. Additional codes can be added as needed (e.g., 429, 503).

### `ERROR_STATUS_MAP` — Error Class → Status Code Mapping

```typescript
interface ErrorStatusEntry {
  errorClass: new (...args: any[]) => Error
  statusCode: number
}

export const ERROR_STATUS_MAP: ErrorStatusEntry[] = [
  { errorClass: ValidationError, statusCode: 400 },
  { errorClass: NotFoundError, statusCode: 404 },
]
```

A data-driven array that maps error constructors to HTTP status codes. The `httpError()` function iterates this array using `instanceof` to find the first match. To add a new error type (e.g., `ConflictError` → 409), add one entry — no if/else chains to modify.

### `httpError(error: unknown)` — Error Classification Function

```typescript
export function httpError(error: unknown): never
```

Core classification logic:
1. If `error` is an H3Error (checked via h3's `isError()`), re-throw it unchanged.
2. If `error` is an `instanceof` a class in `ERROR_STATUS_MAP`, create and throw an H3Error with the mapped `statusCode`, the corresponding `statusMessage` from `STATUS_MESSAGES`, and the original error's `message`.
3. Otherwise, create and throw an H3Error with `statusCode: 500`, `statusMessage: "Internal Server Error"`, `message: "Internal server error"`.

### `defineApiHandler(fn)` — Route Wrapper

```typescript
export function defineApiHandler<T>(
  handler: (event: H3Event) => T | Promise<T>
): ReturnType<typeof defineEventHandler>
```

Wraps the handler in a `defineEventHandler` with a try/catch that delegates to `httpError()`. The happy-path return value passes through unchanged. This is the only export routes need to use.

**Usage (before → after):**

```typescript
// BEFORE: 10 lines of boilerplate per route
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    return getServices().jobService.createJob(body)
  } catch (error) {
    if (error instanceof ValidationError)
      throw createError({ statusCode: 400, message: error.message })
    if (error instanceof NotFoundError)
      throw createError({ statusCode: 404, message: error.message })
    throw error
  }
})

// AFTER: 4 lines, no catch block
export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  return getServices().jobService.createJob(body)
})
```


## Data Models

No new database tables or domain types are introduced. This feature operates entirely at the HTTP/utility layer.

### New Types

```typescript
/** Entry in the error class → status code mapping array */
interface ErrorStatusEntry {
  errorClass: new (...args: any[]) => Error
  statusCode: number
}
```

### Modified Files

| File | Change |
|------|--------|
| `server/utils/httpError.ts` | **New.** `STATUS_MESSAGES`, `ERROR_STATUS_MAP`, `httpError()`, `defineApiHandler()` |
| `server/utils/errors.ts` | **Unchanged.** `ValidationError` and `NotFoundError` stay as-is. |
| `server/api/**/*.ts` (~70 files) | **Migrated.** Replace `defineEventHandler` + try/catch with `defineApiHandler`. |

### Extensibility Example

Adding a new error type requires two changes in two files:

```typescript
// 1. server/utils/errors.ts — define the class
export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

// 2. server/utils/httpError.ts — add one entry
export const ERROR_STATUS_MAP: ErrorStatusEntry[] = [
  { errorClass: ValidationError, statusCode: 400 },
  { errorClass: NotFoundError, statusCode: 404 },
  { errorClass: ConflictError, statusCode: 409 },  // ← new
]
```

No route files need to change.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Mapped error classification preserves status and message

*For any* error class registered in `ERROR_STATUS_MAP` and *for any* non-empty message string, calling `httpError()` with an instance of that error class should produce an H3Error with:
- `statusCode` equal to the mapped status code
- `statusMessage` equal to `STATUS_MESSAGES[statusCode]`
- `message` equal to the original error's message

This consolidates the per-class checks (ValidationError → 400, NotFoundError → 404) into a single property that scales with the mapping. Adding a new entry to `ERROR_STATUS_MAP` automatically gets covered.

**Validates: Requirements 1.2, 2.1, 2.2, 5.1, 5.2, 5.4**

### Property 2: Unknown errors produce 500 with generic message

*For any* `Error` instance whose constructor is not registered in `ERROR_STATUS_MAP` and is not an H3Error, calling `httpError()` should produce an H3Error with:
- `statusCode` equal to 500
- `statusMessage` equal to "Internal Server Error"
- `message` equal to "Internal server error"

The original error's message must NOT leak through to the response.

**Validates: Requirements 2.3, 4.4, 5.3**

### Property 3: H3Error passthrough

*For any* H3Error with an arbitrary `statusCode` and `message`, calling `httpError()` should re-throw the exact same error object (reference equality), preserving all fields unchanged.

**Validates: Requirements 2.4**

### Property 4: Happy-path passthrough

*For any* handler function that returns a value without throwing, `defineApiHandler(handler)` should return that exact value unchanged when invoked.

**Validates: Requirements 3.3**

## Error Handling

### Error Flow

```
Route handler throws
        │
        ▼
  defineApiHandler catch
        │
        ▼
    httpError(error)
        │
        ├── Is H3Error? → re-throw unchanged
        │
        ├── Is in ERROR_STATUS_MAP? → createError({
        │       statusCode: mapped code,
        │       statusMessage: STATUS_MESSAGES[code],
        │       message: error.message
        │   })
        │
        └── Unknown → createError({
                statusCode: 500,
                statusMessage: 'Internal Server Error',
                message: 'Internal server error'
            })
```

### Edge Cases

1. **Status code not in `STATUS_MESSAGES`**: If `ERROR_STATUS_MAP` contains a status code not present in `STATUS_MESSAGES`, the `statusMessage` falls back to `"Unknown Error"`. This prevents undefined values in responses.

2. **Non-Error throws**: If a route throws a non-Error value (string, number, etc.), it falls through to the unknown error branch and produces a 500. This is intentional — only typed Error subclasses get specific status codes.

3. **Async vs sync handlers**: `defineApiHandler` wraps the handler call in a try/catch that handles both sync throws and rejected promises (via `await`).

4. **Existing `createError()` calls in route logic**: Some routes may intentionally call `createError()` for specific cases (e.g., custom 403). These produce H3Errors that pass through unchanged via the H3Error check.

## Testing Strategy

### Property-Based Tests (fast-check)

All property tests live in `tests/properties/httpErrorHandler.property.test.ts` and use `fast-check` with minimum 100 iterations per property.

Each test is tagged with a comment referencing the design property:

```typescript
// Feature: http-error-handler, Property 1: Mapped error classification preserves status and message
```

**Property 1 — Mapped error classification:**
- Generator: `fc.oneof(...ERROR_STATUS_MAP.map(entry => fc.record({ errorClass: fc.constant(entry.errorClass), statusCode: fc.constant(entry.statusCode), message: fc.string({ minLength: 1 }) })))`
- Assertion: Catch the thrown H3Error and verify `statusCode`, `statusMessage`, and `message` match expectations.

**Property 2 — Unknown errors produce 500:**
- Generator: `fc.string({ minLength: 1 })` for random error messages, wrapped in `new Error(msg)`.
- Assertion: Catch the thrown H3Error and verify `statusCode === 500`, `statusMessage === 'Internal Server Error'`, `message === 'Internal server error'`.

**Property 3 — H3Error passthrough:**
- Generator: `fc.record({ statusCode: fc.integer({ min: 400, max: 599 }), message: fc.string({ minLength: 1 }) })` to create random H3Errors via `createError()`.
- Assertion: Catch the thrown error and verify reference equality (`error === originalError`).

**Property 4 — Happy-path passthrough:**
- Generator: `fc.anything()` for arbitrary return values (strings, numbers, objects, arrays, null).
- Assertion: The value returned by the wrapped handler equals the generated value.

### Unit Tests

Unit tests live in `tests/unit/utils/httpError.test.ts` and cover:

1. **Static map completeness** — `STATUS_MESSAGES` contains all required codes (400, 401, 403, 404, 409, 422, 500) with correct RFC 9110 phrases. (Validates Req 1.4)
2. **Unmapped status code fallback** — An error mapped to a code not in `STATUS_MESSAGES` gets `statusMessage: "Unknown Error"`. (Validates Req 1.3)
3. **`ERROR_STATUS_MAP` is an array** — Structural check that the mapping is data-driven. (Validates Req 6.2)
4. **Specific ValidationError example** — `new ValidationError("Name is required")` → 400, "Bad Request", "Name is required".
5. **Specific NotFoundError example** — `new NotFoundError("Job", "J-123")` → 404, "Not Found", "Job not found: J-123".

### Migration Verification

Existing integration tests in `tests/integration/` exercise the full route → service → repository stack. After migration, all existing tests must pass unchanged — this validates that migrated routes preserve their behavior (Req 4.3). No new integration tests are needed for the error handler itself.

### Test Configuration

- Library: `fast-check` (already in devDependencies)
- Runner: Vitest 3.2
- Minimum iterations: 100 per property test (`{ numRuns: 100 }`)
- Each correctness property is implemented by a single `fc.assert(fc.property(...))` call
- Each property test has a comment tag: `Feature: http-error-handler, Property {N}: {title}`
