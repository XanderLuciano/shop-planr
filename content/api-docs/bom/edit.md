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

Creates a versioned edit of a bill of materials. Unlike the simple [Update BOM](/api-docs/bom/update) endpoint, this operation records a `BomVersion` snapshot of the BOM's **previous** entries before applying the new ones. Each version captures the old entries, a change description, the user who made the change, and an auto-incrementing version number.

This is the recommended way to modify BOM entries in production, as it provides a complete audit trail of what changed, when, and why. The operation also generates a `bom_edited` entry in the [Audit API](/api-docs/audit).

The workflow is:
1. The current BOM entries are snapshotted into a new `BomVersion` record.
2. The BOM's entries are replaced with the new entries from the request.
3. A `bom_edited` audit entry is created with the user ID, change description, and version number.
4. The updated BOM is returned.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The unique identifier of the BOM to edit (e.g. `"bom_abc123"`) |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `entries` | `array` | Yes | The new array of part entries that will replace the current entries. Must contain at least one entry. |
| `entries[].partType` | `string` | Yes | Part type name or identifier. |
| `entries[].requiredQuantityPerBuild` | `number` | Yes | Quantity needed per build. |
| `entries[].contributingJobIds` | `string[]` | Yes | Job IDs that supply this part. |
| `changeDescription` | `string` | Yes | A human-readable description of what changed and why (e.g. `"Increased bolt quantity from 12 to 16 per engineering review"`). Must be non-empty. |
| `userId` | `string` | Yes | The ID of the user making the edit. Recorded in the version snapshot and the audit trail. |

## Response

### 200 OK

Returned when the edit is successfully applied. The response contains the **updated** BOM with the new entries. The version snapshot of the previous state can be retrieved via [List BOM Versions](/api-docs/bom/versions).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | The BOM's unique identifier (unchanged) |
| `name` | `string` | The BOM name (unchanged — this endpoint does not modify the name) |
| `entries` | `BomEntry[]` | The **new** entries as provided in the request |
| `entries[].id` | `string \| undefined` | Entry ID, if assigned |
| `entries[].bomId` | `string \| undefined` | Parent BOM ID reference |
| `entries[].partType` | `string` | Part type name |
| `entries[].requiredQuantityPerBuild` | `number` | Required quantity per build |
| `entries[].contributingJobIds` | `string[]` | Contributing job IDs |
| `createdAt` | `string` | Original creation timestamp (unchanged) |
| `updatedAt` | `string` | ISO 8601 timestamp of this edit |

### 400 Bad Request

Returned when the request body fails validation.

| Condition | Message |
|-----------|---------|
| `entries` is missing or empty array | `"entries must have at least one item"` |
| `changeDescription` is missing or empty | `"changeDescription is required"` |

### 404 Not Found

Returned when no BOM exists with the given ID.

| Condition | Message |
|-----------|---------|
| BOM does not exist | `"BOM not found: bom_abc123"` |

### 500 Internal Server Error

Returned if an unhandled error occurs during the edit operation.

| Condition | Message |
|-----------|---------|
| Database write failure | `"Internal Server Error"` |

## Examples

### Request — Increase bolt quantity

```bash
curl -X POST http://localhost:3000/api/bom/bom_abc123/edit \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [
      {
        "partType": "Steel Plate",
        "requiredQuantityPerBuild": 4,
        "contributingJobIds": ["job_001", "job_002"]
      },
      {
        "partType": "Bolt M8",
        "requiredQuantityPerBuild": 16,
        "contributingJobIds": ["job_003"]
      }
    ],
    "changeDescription": "Increased bolt quantity from 12 to 16 per engineering review ECN-2024-015",
    "userId": "user_xyz"
  }'
```

### Response — Updated BOM

```json
{
  "id": "bom_abc123",
  "name": "Widget Assembly BOM",
  "entries": [
    {
      "id": "entry_010",
      "bomId": "bom_abc123",
      "partType": "Steel Plate",
      "requiredQuantityPerBuild": 4,
      "contributingJobIds": ["job_001", "job_002"]
    },
    {
      "id": "entry_011",
      "bomId": "bom_abc123",
      "partType": "Bolt M8",
      "requiredQuantityPerBuild": 16,
      "contributingJobIds": ["job_003"]
    }
  ],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-20T14:00:00.000Z"
}
```

### Request — Add a new part type

```bash
curl -X POST http://localhost:3000/api/bom/bom_abc123/edit \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [
      {
        "partType": "Steel Plate",
        "requiredQuantityPerBuild": 4,
        "contributingJobIds": ["job_001", "job_002"]
      },
      {
        "partType": "Bolt M8",
        "requiredQuantityPerBuild": 16,
        "contributingJobIds": ["job_003"]
      },
      {
        "partType": "Washer M8",
        "requiredQuantityPerBuild": 16,
        "contributingJobIds": ["job_003"]
      }
    ],
    "changeDescription": "Added M8 washers per assembly drawing rev C",
    "userId": "user_abc"
  }'
```

### Response — BOM with new entry

```json
{
  "id": "bom_abc123",
  "name": "Widget Assembly BOM",
  "entries": [
    {
      "id": "entry_012",
      "bomId": "bom_abc123",
      "partType": "Steel Plate",
      "requiredQuantityPerBuild": 4,
      "contributingJobIds": ["job_001", "job_002"]
    },
    {
      "id": "entry_013",
      "bomId": "bom_abc123",
      "partType": "Bolt M8",
      "requiredQuantityPerBuild": 16,
      "contributingJobIds": ["job_003"]
    },
    {
      "id": "entry_014",
      "bomId": "bom_abc123",
      "partType": "Washer M8",
      "requiredQuantityPerBuild": 16,
      "contributingJobIds": ["job_003"]
    }
  ],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-21T09:00:00.000Z"
}
```

## Notes

- The version snapshot records the **previous** state of the BOM entries, not the new state. This allows you to reconstruct the full history by walking through versions in order.
- Version numbers are auto-incrementing starting from 1. The first versioned edit creates version 1, the second creates version 2, and so on.
- This endpoint does **not** modify the BOM's `name`. To rename a BOM, use the [Update BOM](/api-docs/bom/update) endpoint.
- The `userId` field is not validated against the users table — any non-empty string is accepted. This supports kiosk-mode workflows.
- Each versioned edit generates a `bom_edited` audit entry with metadata containing the `bomId`, `changeDescription`, and `versionNumber`.
- The entire entries array is replaced. You must include all entries in the request, not just the ones that changed. Omitted entries will be removed from the BOM.
- The `changeDescription` should be meaningful and descriptive — it serves as the commit message for this BOM change and will be displayed in the version history UI.

## Related Endpoints

- [List BOM Versions](/api-docs/bom/versions) — View the version history created by this endpoint
- [Get BOM](/api-docs/bom/get) — Retrieve the current state of the BOM
- [Update BOM](/api-docs/bom/update) — Simple update without version tracking
- [List Audit Entries](/api-docs/audit/list) — Query `bom_edited` events

::
