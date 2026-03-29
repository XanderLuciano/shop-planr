---
title: 'List & Create Locations'
description: 'Retrieve all location library entries or create a new one'
method: 'GET'
endpoint: '/api/library/locations'
service: 'libraryService'
category: 'Library'
responseType: 'LocationLibraryEntry[]'
errorCodes: [400, 500]
navigation:
  order: 3
---

# List & Create Locations

## List Locations

::endpoint-card{method="GET" path="/api/library/locations"}

Retrieves all entries in the location library. Location library entries are reusable physical location names (bays, labs, booths, vendor sites) that appear as dropdown options when configuring process steps in paths and templates. The list is not paginated — all entries are returned in a single response.

### Request

No request body or query parameters.

### Response

#### 200 OK

Returns an array of `LocationLibraryEntry` objects. May be empty if no entries exist.

| Field       | Type     | Description                                    |
| ----------- | -------- | ---------------------------------------------- |
| `id`        | `string` | Unique entry identifier (e.g. `"lloc_a1b2c3"`) |
| `name`      | `string` | Location name                                  |
| `createdAt` | `string` | ISO 8601 creation timestamp                    |

#### 500 Internal Server Error

| Condition             | Message                   |
| --------------------- | ------------------------- |
| Database read failure | `"Internal Server Error"` |

### Examples

#### Request

```bash
curl http://localhost:3000/api/library/locations
```

#### Response — Multiple entries

```json
[
  {
    "id": "lloc_a1b2c3",
    "name": "Bay 1",
    "createdAt": "2024-01-10T08:00:00.000Z"
  },
  {
    "id": "lloc_d4e5f6",
    "name": "Bay 2",
    "createdAt": "2024-01-10T08:00:00.000Z"
  },
  {
    "id": "lloc_g7h8i9",
    "name": "QC Lab",
    "createdAt": "2024-01-10T08:00:00.000Z"
  },
  {
    "id": "lloc_j0k1l2",
    "name": "Vendor - Plating Co.",
    "createdAt": "2024-01-10T08:00:00.000Z"
  }
]
```

#### Response — Empty library

```json
[]
```

::

## Create Location

::endpoint-card{method="POST" path="/api/library/locations"}

Creates a new entry in the location library. The name must be unique (exact match after trimming). Duplicate names are rejected with a `400` error.

### Request

#### Request Body

| Field  | Type     | Required | Description                                                                                                                |
| ------ | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `name` | `string` | Yes      | The location name to add. Must be non-empty. Trimmed of leading/trailing whitespace. Must not duplicate an existing entry. |

### Response

#### 200 OK

Returns the newly created `LocationLibraryEntry` object.

| Field       | Type     | Description                                               |
| ----------- | -------- | --------------------------------------------------------- |
| `id`        | `string` | Server-generated unique identifier (e.g. `"lloc_m3n4o5"`) |
| `name`      | `string` | The trimmed location name                                 |
| `createdAt` | `string` | ISO 8601 creation timestamp                               |

#### 400 Bad Request

| Condition                                             | Message                          |
| ----------------------------------------------------- | -------------------------------- |
| `name` is missing or empty                            | `"name is required"`             |
| `name` is only whitespace                             | `"name is required"`             |
| `name` already exists in the library (after trimming) | `"Location name already exists"` |

#### 500 Internal Server Error

| Condition              | Message                   |
| ---------------------- | ------------------------- |
| Database write failure | `"Internal Server Error"` |

### Examples

#### Request

```bash
curl -X POST http://localhost:3000/api/library/locations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Paint Booth"
  }'
```

#### Response — Entry created

```json
{
  "id": "lloc_m3n4o5",
  "name": "Paint Booth",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

#### Error — Duplicate name

```bash
curl -X POST http://localhost:3000/api/library/locations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bay 1"
  }'
# 400: { "message": "Location name already exists" }
```

### Notes

- The duplicate check is an exact string match after trimming. `"Bay 1"` and `"bay 1"` are treated as different names.
- The `id` is generated server-side with the `lloc_` prefix followed by a unique nanoid.
- Location names containing the substring "vendor" (case-insensitive) have special significance in the [Parts View](/api-docs/operator/by-step-name) endpoint, where they contribute to the `vendorPartsCount` metric.
- Creating a library entry does not automatically apply it to any existing steps. It simply makes the name available in dropdown lists.

::

## Related Endpoints

- [Delete Location](/api-docs/library/location-delete) — Remove a location library entry
- [List & Create Processes](/api-docs/library/processes) — Manage the process library
- [Create Path](/api-docs/paths/create) — Use location names when defining path steps
