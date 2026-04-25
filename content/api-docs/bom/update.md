---
title: "Update BOM"
description: "Update an existing bill of materials without version tracking"
method: "PUT"
endpoint: "/api/bom/:id"
service: "bomService"
category: "BOM"
requestBody: "Partial<CreateBomInput>"
responseType: "BOM"
errorCodes: [400, 404, 500]
navigation:
  order: 4
---

# Update BOM

::endpoint-card{method="PUT" path="/api/bom/:id"}

Updates an existing bill of materials. This endpoint supports partial updates — you can update just the `name`, just the `entries`, or both in a single request. Only the fields you include in the request body are modified; omitted fields retain their current values.

This is a **simple update** that does not create a version snapshot. If you need change tracking with user attribution and a change description, use the [Edit BOM](/api-docs/bom/edit) endpoint instead.

When updating `entries`, the entire entries array is replaced.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The unique identifier of the BOM to update (e.g. `"bom_abc123"`) |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | No | Updated BOM name. Must be non-empty if provided. Whitespace is trimmed. |
| `entries` | `array` | No | Updated array of job entries. Replaces the entire existing entries array. |
| `entries[].jobId` | `string` | Yes (if entries provided) | The job ID this entry references. |
| `entries[].requiredQuantity` | `number` | No | Quantity needed per build. Defaults to 1. |

## Response

### 200 OK

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | The BOM's unique identifier |
| `name` | `string` | The BOM name |
| `entries` | `BomEntry[]` | The entries |
| `entries[].id` | `string \| undefined` | Entry ID |
| `entries[].bomId` | `string \| undefined` | Parent BOM ID |
| `entries[].jobId` | `string` | Referenced job ID |
| `entries[].requiredQuantity` | `number` | Required quantity per build |
| `createdAt` | `string` | Original creation timestamp |
| `updatedAt` | `string` | ISO 8601 timestamp of this update |

### 400 Bad Request

| Condition | Message |
|-----------|---------|
| `name` is provided but empty | `"name is required"` |

### 404 Not Found

| Condition | Message |
|-----------|---------|
| BOM does not exist | `"BOM not found: bom_abc123"` |

## Examples

### Request — Update name only

```bash
curl -X PUT http://localhost:3000/api/bom/bom_abc123 \
  -H "Content-Type: application/json" \
  -d '{ "name": "Widget Assembly BOM v2" }'
```

### Request — Replace entries

```bash
curl -X PUT http://localhost:3000/api/bom/bom_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [
      { "jobId": "job_001", "requiredQuantity": 6 },
      { "jobId": "job_003", "requiredQuantity": 16 }
    ]
  }'
```

## Notes

- This endpoint does **not** create a version snapshot. For tracked changes, use [Edit BOM](/api-docs/bom/edit) instead.
- When `entries` is provided, the entire entries array is replaced.
- Each job can only appear once per BOM.
- `requiredQuantity` defaults to 1 if omitted.

## Related Endpoints

- [Get BOM](/api-docs/bom/get) — Retrieve the current state of a BOM with summary
- [Edit BOM](/api-docs/bom/edit) — Make a versioned edit with change tracking
- [Create BOM](/api-docs/bom/create) — Create a new BOM
- [List BOM Versions](/api-docs/bom/versions) — View version history

::
