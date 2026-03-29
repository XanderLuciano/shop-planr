---
title: 'Update BOM'
description: 'Update an existing bill of materials without version tracking'
method: 'PUT'
endpoint: '/api/bom/:id'
service: 'bomService'
category: 'BOM'
requestBody: 'Partial<CreateBomInput>'
responseType: 'BOM'
errorCodes: [400, 404, 500]
navigation:
  order: 4
---

# Update BOM

::endpoint-card{method="PUT" path="/api/bom/:id"}

Updates an existing bill of materials. This endpoint supports partial updates — you can update just the `name`, just the `entries`, or both in a single request. Only the fields you include in the request body are modified; omitted fields retain their current values.

This is a **simple update** that does not create a version snapshot. If you need change tracking with user attribution and a change description, use the [Edit BOM](/api-docs/bom/edit) endpoint instead. The simple update is appropriate for corrections, typo fixes, or non-significant changes that don't warrant a version record.

When updating `entries`, the entire entries array is replaced. There is no mechanism to add, remove, or modify individual entries — you must provide the complete new entry list.

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                                      |
| --------- | -------- | -------- | ---------------------------------------------------------------- |
| `id`      | `string` | Yes      | The unique identifier of the BOM to update (e.g. `"bom_abc123"`) |

### Request Body

| Field                                | Type       | Required                  | Description                                                                                  |
| ------------------------------------ | ---------- | ------------------------- | -------------------------------------------------------------------------------------------- |
| `name`                               | `string`   | No                        | Updated BOM name. Must be non-empty if provided. Leading and trailing whitespace is trimmed. |
| `entries`                            | `array`    | No                        | Updated array of part entries. Replaces the entire existing entries array.                   |
| `entries[].partType`                 | `string`   | Yes (if entries provided) | Part type name or identifier.                                                                |
| `entries[].requiredQuantityPerBuild` | `number`   | Yes (if entries provided) | Quantity needed per build.                                                                   |
| `entries[].contributingJobIds`       | `string[]` | Yes (if entries provided) | Job IDs that supply this part.                                                               |

## Response

### 200 OK

Returned when the BOM is successfully updated. The response contains the complete updated `BOM` object.

| Field                                | Type                  | Description                             |
| ------------------------------------ | --------------------- | --------------------------------------- |
| `id`                                 | `string`              | The BOM's unique identifier (unchanged) |
| `name`                               | `string`              | The BOM name (updated or unchanged)     |
| `entries`                            | `BomEntry[]`          | The entries (updated or unchanged)      |
| `entries[].id`                       | `string \| undefined` | Entry ID, if assigned                   |
| `entries[].bomId`                    | `string \| undefined` | Parent BOM ID reference                 |
| `entries[].partType`                 | `string`              | Part type name                          |
| `entries[].requiredQuantityPerBuild` | `number`              | Required quantity per build             |
| `entries[].contributingJobIds`       | `string[]`            | Contributing job IDs                    |
| `createdAt`                          | `string`              | Original creation timestamp (unchanged) |
| `updatedAt`                          | `string`              | ISO 8601 timestamp of this update       |

### 400 Bad Request

Returned when the request body fails validation.

| Condition                    | Message              |
| ---------------------------- | -------------------- |
| `name` is provided but empty | `"name is required"` |

### 404 Not Found

Returned when no BOM exists with the given ID.

| Condition          | Message                       |
| ------------------ | ----------------------------- |
| BOM does not exist | `"BOM not found: bom_abc123"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while persisting the update.

| Condition              | Message                   |
| ---------------------- | ------------------------- |
| Database write failure | `"Internal Server Error"` |

## Examples

### Request — Update name only

```bash
curl -X PUT http://localhost:3000/api/bom/bom_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Widget Assembly BOM v2"
  }'
```

### Response — Name updated

```json
{
  "id": "bom_abc123",
  "name": "Widget Assembly BOM v2",
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
    }
  ],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-20T14:00:00.000Z"
}
```

### Request — Replace entries

```bash
curl -X PUT http://localhost:3000/api/bom/bom_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [
      {
        "partType": "Steel Plate",
        "requiredQuantityPerBuild": 6,
        "contributingJobIds": ["job_001", "job_002", "job_004"]
      },
      {
        "partType": "Bolt M10",
        "requiredQuantityPerBuild": 16,
        "contributingJobIds": ["job_003"]
      }
    ]
  }'
```

### Response — Entries replaced

```json
{
  "id": "bom_abc123",
  "name": "Widget Assembly BOM v2",
  "entries": [
    {
      "id": "entry_005",
      "bomId": "bom_abc123",
      "partType": "Steel Plate",
      "requiredQuantityPerBuild": 6,
      "contributingJobIds": ["job_001", "job_002", "job_004"]
    },
    {
      "id": "entry_006",
      "bomId": "bom_abc123",
      "partType": "Bolt M10",
      "requiredQuantityPerBuild": 16,
      "contributingJobIds": ["job_003"]
    }
  ],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-20T15:30:00.000Z"
}
```

## Notes

- This endpoint does **not** create a version snapshot. The previous state of the BOM is lost. For tracked changes, use [Edit BOM](/api-docs/bom/edit) instead.
- When `entries` is provided, the **entire** entries array is replaced. Old entries are discarded and new ones take their place. There is no merge or diff.
- The `updatedAt` timestamp is set to the current time on every successful update, even if the actual data did not change.
- The `createdAt` timestamp is never modified.
- The `contributingJobIds` array is not validated against existing jobs. You can reference job IDs that don't exist yet.
- An empty request body `{}` is technically valid — it will update only the `updatedAt` timestamp without changing any other fields.

## Related Endpoints

- [Get BOM](/api-docs/bom/get) — Retrieve the current state of a BOM with summary
- [Edit BOM](/api-docs/bom/edit) — Make a versioned edit with change tracking
- [Create BOM](/api-docs/bom/create) — Create a new BOM
- [List BOM Versions](/api-docs/bom/versions) — View version history (from versioned edits)

::
