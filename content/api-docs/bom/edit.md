---
title: "Edit BOM (Versioned)"
description: "Create a new versioned edit of a BOM with change tracking"
method: "POST"
endpoint: "/api/bom/:id/edit"
service: "bomService"
category: "BOM"
requestBody: "EditBomInput"
responseType: "BomVersion"
errorCodes: [400, 404]
navigation:
  order: 5
---

# Edit BOM (Versioned)

::endpoint-card{method="POST" path="/api/bom/:id/edit"}

Creates a new versioned edit of a bill of materials. Unlike a simple update, this operation records a `BomVersion` snapshot with a change description and the user who made the change, enabling full audit history of BOM modifications.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `entries` | `array` | Yes | Updated array of part entries |
| `entries[].partType` | `string` | Yes | Part type name |
| `entries[].requiredQuantityPerBuild` | `number` | Yes | Quantity needed per build |
| `entries[].contributingJobIds` | `string[]` | Yes | Job IDs that supply this part |
| `changeDescription` | `string` | Yes | Description of what changed and why |
| `userId` | `string` | Yes | ID of the user making the edit |

## Example Request

```json
{
  "entries": [
    {
      "partType": "Steel Plate",
      "requiredQuantityPerBuild": 6,
      "contributingJobIds": ["job_001", "job_002"]
    },
    {
      "partType": "Bolt M8",
      "requiredQuantityPerBuild": 16,
      "contributingJobIds": ["job_003"]
    }
  ],
  "changeDescription": "Increased bolt quantity from 12 to 16 per engineering review",
  "userId": "user_xyz"
}
```

## Response

Returns the created `BomVersion` object:

```json
{
  "id": "bomver_001",
  "bomId": "bom_abc123",
  "versionNumber": 2,
  "entriesSnapshot": [
    {
      "partType": "Steel Plate",
      "requiredQuantityPerBuild": 6,
      "contributingJobIds": ["job_001", "job_002"]
    },
    {
      "partType": "Bolt M8",
      "requiredQuantityPerBuild": 16,
      "contributingJobIds": ["job_003"]
    }
  ],
  "changeDescription": "Increased bolt quantity from 12 to 16 per engineering review",
  "changedBy": "user_xyz",
  "createdAt": "2024-01-20T14:00:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Missing `entries`, `changeDescription`, or `userId` |
| `404` | BOM not found |

::
