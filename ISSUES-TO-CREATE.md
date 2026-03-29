# Issues to Create for Shop Planr

Copy-paste these into GitHub Issues at https://github.com/XanderLuciano/shop-planr/issues/new

---

## Issue 1: Incorrect HTTP status messages in error responses

**Labels:** bug, medium

### Description

All error responses return `statusMessage: "Server Error"` regardless of the actual HTTP status code.

### Examples

```json
{"statusCode": 404, "statusMessage": "Server Error", "message": "Job not found"}
{"statusCode": 400, "statusMessage": "Server Error", "message": "name is required"}
```

### Expected

`statusMessage` should match HTTP semantics:

- 404 → "Not Found"
- 400 → "Bad Request"

### Reproduction

```bash
curl https://planr.oisl.dev/api/jobs/nonexistent
```

---

## Issue 2: No input length validation on string fields

**Labels:** bug, medium

### Description

No maximum length validation on string inputs. API accepts arbitrarily long values.

### Reproduction

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"name": "'$(python3 -c "print('A'*10000)")'", "goalQuantity": 1, "paths": []}' \
  https://planr.oisl.dev/api/jobs
```

### Impact

- Database bloat
- Potential DoS via large payloads

### Suggested Fix

Add max length validation (e.g., 255 chars for names, 1000 for descriptions).

---

## Issue 3: Empty department allowed for users

**Labels:** bug, medium

### Description

Users can be created with an empty string department.

### Reproduction

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"name": "Test", "department": ""}' \
  https://planr.oisl.dev/api/users
```

### Question

Is this intentional? If not, add validation to require non-empty department.

---

## Issue 4: No rate limiting on API endpoints

**Labels:** enhancement, medium, security

### Description

No rate limiting on any endpoint.

### Impact

Vulnerable to:

- Brute force attacks
- DoS via rapid requests
- Automated scraping

### Suggested Fix

Add rate limiting middleware (e.g., 100 requests/minute per IP).

---

## Issue 5: Missing GET /api/paths endpoint

**Labels:** enhancement, medium

### Description

No top-level endpoint to list all paths across jobs.

### Current Behavior

Paths are only accessible nested under `/api/jobs/{id}` response.

### Reproduction

```bash
curl https://planr.oisl.dev/api/paths  # Returns 404
```

### Suggested Fix

Add `GET /api/paths` endpoint with optional `?jobId=` filter.

---

## Issue 6: Remove deprecated repository aliases

**Labels:** tech-debt, low

### Description

Deprecated aliases still present in `server/repositories/sqlite/index.ts`:

- `serials` (now `parts`)
- `snStepStatuses` (now `partStepStatuses`)
- `snStepOverrides` (now `partStepOverrides`)

These have `@deprecated` JSDoc tags but should be removed for cleaner code.

---

## Issue 7: Job detail page lacks SSR content

**Labels:** enhancement, low

### Description

Job detail pages (`/jobs/{id}`) show only "Loading job..." during SSR. Content renders client-side only.

### Impact

- SEO issues (if public)
- Slower perceived load time
- Link previews show "Loading..."

### Suggested Fix

Use `useFetch` or `useAsyncData` with `server: true` to pre-render job data.

---

## Issue 8: Legacy column name `serial_id` in audit table

**Labels:** tech-debt, low

### Description

The audit table has a column named `serial_id` despite the rename from "serials" to "parts" in migration 006.

**File:** `migrations/001_initial_schema.sql`

### Suggested Fix

Add migration to rename `serial_id` → `part_id` for consistency.

---

_Generated from audit on 2026-03-28_
