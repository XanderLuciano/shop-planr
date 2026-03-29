---
title: "Create BOM"
description: "Create a new bill of materials with part entries"
method: "POST"
endpoint: "/api/bom"
service: "bomService"
category: "BOM"
requestBody: "CreateBomInput"
responseType: "BOM"
errorCodes: [400, 500]
navigation:
  order: 3
---

# Create BOM

::endpoint-card{method="POST" path="/api/bom"}

Creates a new bill of materials. A BOM defines the parts and quantities required for a production build, along with the contributing jobs that supply each part type. Every BOM requires a name and at least one entry.

After creating a BOM, you can track production progress against it using the [Get BOM](/api-docs/bom/get) endpoint, which returns real-time summary statistics. To make tracked changes to the BOM later, use the [Edit BOM](/api-docs/bom/edit) endpoint which creates version snapshots.

## Request

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | A human-readable name for the BOM (e.g. `"Widget Assembly BOM"`). Must be a non-empty string. Leading and trailing whitespace is trimmed. |
| `entries` | `array` | Yes | An array of part entries. Must contain at least one entry. |
| `entries[].partType` | `string` | Yes | The name or identifier of the part type (e.g. `"Steel Plate"`, `"Bolt M8"`). |
| `entries[].requiredQuantityPerBuild` | `number` | Yes | How many of this part are needed for each unit produced. Should be a positive number. |
| `entries[].contributingJobIds` | `string[]` | Yes | An array of job IDs that supply this part type. Can be empty if no jobs have been assigned yet. |

## Response

### 201 Created

Returned when the BOM is successfully created. The response contains the complete `BOM` object with server-generated fields.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Server-generated unique identifier (prefixed with `bom_`) |
| `name` | `string` | The BOM name as provided (trimmed) |
| `entries` | `BomEntry[]` | The entries as provided, potentially with server-assigned `id` and `bomId` fields |
| `entries[].id` | `string \| undefined` | Server-generated entry ID, if assigned |
| `entries[].bomId` | `string \| undefined` | Parent BOM ID reference, if assigned |
| `entries[].partType` | `string` | Part type as provided |
| `entries[].requiredQuantityPerBuild` | `number` | Required quantity as provided |
| `entries[].contributingJobIds` | `string[]` | Contributing job IDs as provided |
| `createdAt` | `string` | ISO 8601 timestamp of when the BOM was created |
| `updatedAt` | `string` | ISO 8601 timestamp — same as `createdAt` for newly created BOMs |

### 400 Bad Request

Returned when the request body fails validation.

| Condition | Message |
|-----------|---------|
| `name` is missing or empty | `"name is required"` |
| `entries` is missing or empty array | `"entries must have at least one item"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while persisting the BOM.

| Condition | Message |
|-----------|---------|
| Database write failure | `"Internal Server Error"` |

## Examples

### Request — BOM with multiple entries

```bash
curl -X POST http://localhost:3000/api/bom \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Widget Assembly BOM",
    "entries": [
      {
        "partType": "Steel Plate",
        "requiredQuantityPerBuild": 4,
        "contributingJobIds": ["job_001", "job_002"]
      },
      {
        "partType": "Bolt M8",
        "requiredQuantityPerBuild": 12,
        "contributingJobIds": ["job_003"]
      },
      {
        "partType": "Gasket",
        "requiredQuantityPerBuild": 2,
        "contributingJobIds": []
      }
    ]
  }'
```

### Response — BOM created

```json
{
  "id": "bom_abc123",
  "name": "Widget Assembly BOM",
  "entries": [
    {
      "id": "entry_001",
      "bomId": "bom_abc123",
      "partType": "Steel Plate",
      "requiredQuantityPerBuild": 4,
      "contributingJobIds": ["job_001", "job_002"]
    },
    {
      "id": "entry_002",
      "bomId": "bom_abc123",
      "partType": "Bolt M8",
      "requiredQuantityPerBuild": 12,
      "contributingJobIds": ["job_003"]
    },
    {
      "id": "entry_003",
      "bomId": "bom_abc123",
      "partType": "Gasket",
      "requiredQuantityPerBuild": 2,
      "contributingJobIds": []
    }
  ],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### Request — Minimal BOM (single entry)

```bash
curl -X POST http://localhost:3000/api/bom \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Simple Part BOM",
    "entries": [
      {
        "partType": "Aluminum Housing",
        "requiredQuantityPerBuild": 1,
        "contributingJobIds": ["job_004"]
      }
    ]
  }'
```

### Response — Minimal BOM

```json
{
  "id": "bom_def456",
  "name": "Simple Part BOM",
  "entries": [
    {
      "id": "entry_004",
      "bomId": "bom_def456",
      "partType": "Aluminum Housing",
      "requiredQuantityPerBuild": 1,
      "contributingJobIds": ["job_004"]
    }
  ],
  "createdAt": "2024-01-15T11:00:00.000Z",
  "updatedAt": "2024-01-15T11:00:00.000Z"
}
```

## Notes

- The `id` field is generated server-side using the `bom_` prefix and cannot be specified in the request body.
- The `name` field is trimmed of leading and trailing whitespace before storage.
- There is no uniqueness constraint on `name`. Multiple BOMs can share the same name.
- The `contributingJobIds` array is not validated against existing jobs. You can reference job IDs that don't exist yet — this is useful when setting up BOMs before the contributing jobs have been created.
- Creating a BOM does **not** create an initial version record. Version history begins with the first [Edit BOM](/api-docs/bom/edit) call.
- Entries are stored in the order provided. There is no explicit ordering field on entries.

## Related Endpoints

- [List BOMs](/api-docs/bom/list) — Retrieve all BOMs
- [Get BOM](/api-docs/bom/get) — Retrieve this BOM with production summary
- [Edit BOM](/api-docs/bom/edit) — Make a versioned edit with change tracking
- [Update BOM](/api-docs/bom/update) — Simple update without version tracking

::
