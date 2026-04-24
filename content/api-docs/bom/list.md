---
title: "List BOMs"
description: "Retrieve all bills of materials"
method: "GET"
endpoint: "/api/bom"
service: "bomService"
category: "BOM"
responseType: "BOM[]"
errorCodes: [500]
navigation:
  order: 1
---

# List BOMs

::endpoint-card{method="GET" path="/api/bom"}

Retrieves all bills of materials in the system. Returns a flat array of BOM objects, each containing its full set of entries. This endpoint does not include the computed production summary — use [Get BOM](/api-docs/bom/get) for individual BOMs with summary data.

Use this endpoint to populate BOM selection lists, display a BOM management dashboard, or export all BOM definitions.

## Request

No request body or query parameters.

## Response

### 200 OK

Returns an array of `BOM` objects. If no BOMs exist, returns an empty array `[]`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the BOM (prefixed with `bom_`) |
| `name` | `string` | Human-readable BOM name |
| `entries` | `BomEntry[]` | Array of job entries |
| `entries[].id` | `string \| undefined` | Entry ID, if assigned by the repository |
| `entries[].bomId` | `string \| undefined` | Parent BOM ID reference |
| `entries[].jobId` | `string` | Referenced job ID |
| `entries[].requiredQuantity` | `number` | Quantity needed per build |
| `createdAt` | `string` | ISO 8601 timestamp of when the BOM was created |
| `updatedAt` | `string` | ISO 8601 timestamp of the last modification |

### 500 Internal Server Error

Returned if an unhandled error occurs while querying the database.

| Condition | Message |
|-----------|---------|
| Database read failure | `"Internal Server Error"` |

## Examples

### Request

```bash
curl http://localhost:3000/api/bom
```

### Response — Multiple BOMs

```json
[
  {
    "id": "bom_abc123",
    "name": "Widget Assembly BOM",
    "entries": [
      {
        "id": "entry_001",
        "bomId": "bom_abc123",
        "jobId": "job_001",
        "requiredQuantity": 4
      },
      {
        "id": "entry_002",
        "bomId": "bom_abc123",
        "jobId": "job_003",
        "requiredQuantity": 12
      }
    ],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  {
    "id": "bom_def456",
    "name": "Enclosure BOM",
    "entries": [
      {
        "id": "entry_003",
        "bomId": "bom_def456",
        "jobId": "job_004",
        "requiredQuantity": 2
      }
    ],
    "createdAt": "2024-01-16T08:00:00.000Z",
    "updatedAt": "2024-01-18T11:00:00.000Z"
  }
]
```

### Response — No BOMs

```json
[]
```

## Notes

- The list endpoint does **not** include the computed `summary` field. To get production progress data for a specific BOM, use the [Get BOM](/api-docs/bom/get) endpoint.
- This endpoint is not paginated. For deployments with a very large number of BOMs, the response may be large.
- Entries are returned as stored — the `id` and `bomId` fields on entries may or may not be present depending on the repository implementation.

## Related Endpoints

- [Get BOM](/api-docs/bom/get) — Retrieve a single BOM with production summary
- [Create BOM](/api-docs/bom/create) — Create a new BOM
- [Edit BOM](/api-docs/bom/edit) — Make a versioned edit to a BOM

::
