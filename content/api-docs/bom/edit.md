---
title: "Edit BOM (Versioned)"
description: "Create a versioned edit of a BOM with change tracking and audit trail"
method: "POST"
endpoint: "/api/bom/:id/edit"
service: "bomService"
category: "BOM"
requestBody: "EditBomInput"
responseType: "BOM"
errorCodes: [400, 404, 500]
navigation:
  order: 5
---

# Edit BOM (Versioned)

::endpoint-card{method="POST" path="/api/bom/:id/edit"}

Creates a versioned edit of a bill of materials. Unlike the simple [Update BOM](/api-docs/bom/update) endpoint, this operation records a `BomVersion` snapshot of the BOM's previous entries before applying the new ones. Each version captures the old entries, a change description, the user who made the change, and an auto-incrementing version number.

This is the recommended way to modify BOM entries in production. The operation also generates a `bom_edited` entry in the [Audit API](/api-docs/audit).

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The unique identifier of the BOM to edit |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `entries` | `array` | Yes | The new array of job entries. Must contain at least one entry. |
| `entries[].jobId` | `string` | Yes | The job ID this entry references. |
| `entries[].requiredQuantity` | `number` | No | Quantity needed per build. Defaults to 1. |
| `name` | `string` | No | Updated BOM name. Must be non-empty if provided. |
| `changeDescription` | `string` | Yes | Description of what changed and why. Must be non-empty. |
| `userId` | `string` | Yes | The ID of the user making the edit. |

## Response

### 200 OK

Returns the updated BOM with the new entries.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | The BOM's unique identifier |
| `name` | `string` | The BOM name |
| `entries` | `BomEntry[]` | The new entries |
| `entries[].id` | `string \| undefined` | Entry ID |
| `entries[].bomId` | `string \| undefined` | Parent BOM ID |
| `entries[].jobId` | `string` | Referenced job ID |
| `entries[].requiredQuantity` | `number` | Required quantity per build |
| `createdAt` | `string` | Original creation timestamp |
| `updatedAt` | `string` | ISO 8601 timestamp of this edit |

### 400 Bad Request

| Condition | Message |
|-----------|---------|
| `entries` is missing or empty | `"entries must have at least one item"` |
| `changeDescription` is missing or empty | `"changeDescription is required"` |

### 404 Not Found

| Condition | Message |
|-----------|---------|
| BOM does not exist | `"BOM not found: bom_abc123"` |

## Examples

### Request

```bash
curl -X POST http://localhost:3000/api/bom/bom_abc123/edit \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [
      { "jobId": "job_001", "requiredQuantity": 4 },
      { "jobId": "job_003", "requiredQuantity": 16 }
    ],
    "changeDescription": "Increased bolt quantity per engineering review",
    "userId": "user_xyz"
  }'
```

## Notes

- The version snapshot records the previous state, not the new state.
- Version numbers auto-increment starting from 1.
- Each job can only appear once per BOM.
- `requiredQuantity` defaults to 1 if omitted.
- The entire entries array is replaced — omitted entries are removed.

## Related Endpoints

- [List BOM Versions](/api-docs/bom/versions) — View version history
- [Get BOM](/api-docs/bom/get) — Retrieve current BOM state
- [Update BOM](/api-docs/bom/update) — Simple update without version tracking

::
