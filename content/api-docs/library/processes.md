---
title: "List & Create Processes"
description: "Retrieve all process library entries or create a new one"
method: "GET"
endpoint: "/api/library/processes"
service: "libraryService"
category: "Library"
responseType: "ProcessLibraryEntry[]"
errorCodes: [400, 500]
navigation:
  order: 1
---

# List & Create Processes

## List Processes

::endpoint-card{method="GET" path="/api/library/processes"}

Retrieves all entries in the process library. Process library entries are reusable process step names that appear as dropdown options when creating paths and templates. The list is not paginated — all entries are returned in a single response.

### Request

No request body or query parameters.

### Response

#### 200 OK

Returns an array of `ProcessLibraryEntry` objects. May be empty if no entries exist.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique entry identifier (e.g. `"plib_a1b2c3"`) |
| `name` | `string` | Process step name |
| `createdAt` | `string` | ISO 8601 creation timestamp |

#### 500 Internal Server Error

| Condition | Message |
|-----------|---------|
| Database read failure | `"Internal Server Error"` |

### Examples

#### Request

```bash
curl http://localhost:3000/api/library/processes
```

#### Response — Multiple entries

```json
[
  {
    "id": "plib_a1b2c3",
    "name": "CNC Machining",
    "createdAt": "2024-01-10T08:00:00.000Z"
  },
  {
    "id": "plib_d4e5f6",
    "name": "Deburring",
    "createdAt": "2024-01-10T08:00:00.000Z"
  },
  {
    "id": "plib_g7h8i9",
    "name": "Anodizing",
    "createdAt": "2024-01-10T08:00:00.000Z"
  },
  {
    "id": "plib_j0k1l2",
    "name": "Final Inspection",
    "createdAt": "2024-01-10T08:00:00.000Z"
  }
]
```

#### Response — Empty library

```json
[]
```

::

## Create Process

::endpoint-card{method="POST" path="/api/library/processes"}

Creates a new entry in the process library. The name must be unique (exact match after trimming). Duplicate names are rejected with a `400` error.

### Request

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | The process step name to add. Must be non-empty. Trimmed of leading/trailing whitespace. Must not duplicate an existing entry. |

### Response

#### 200 OK

Returns the newly created `ProcessLibraryEntry` object.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Server-generated unique identifier (e.g. `"plib_m3n4o5"`) |
| `name` | `string` | The trimmed process name |
| `createdAt` | `string` | ISO 8601 creation timestamp |

#### 400 Bad Request

| Condition | Message |
|-----------|---------|
| `name` is missing or empty | `"name is required"` |
| `name` is only whitespace | `"name is required"` |
| `name` already exists in the library (after trimming) | `"Process name already exists"` |

#### 500 Internal Server Error

| Condition | Message |
|-----------|---------|
| Database write failure | `"Internal Server Error"` |

### Examples

#### Request

```bash
curl -X POST http://localhost:3000/api/library/processes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Powder Coating"
  }'
```

#### Response — Entry created

```json
{
  "id": "plib_m3n4o5",
  "name": "Powder Coating",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

#### Error — Duplicate name

```bash
curl -X POST http://localhost:3000/api/library/processes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CNC Machining"
  }'
# 400: { "message": "Process name already exists" }
```

### Notes

- The duplicate check is an exact string match after trimming. `"CNC Machining"` and `"cnc machining"` are treated as different names.
- The `id` is generated server-side with the `plib_` prefix followed by a unique nanoid.
- Creating a library entry does not automatically apply it to any existing paths or templates. It simply makes the name available in dropdown lists.

::

## Related Endpoints

- [Delete Process](/api-docs/library/process-delete) — Remove a process library entry
- [List & Create Locations](/api-docs/library/locations) — Manage the location library
- [Create Path](/api-docs/paths/create) — Use process names when defining path steps
