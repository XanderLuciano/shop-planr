---
title: "Create BOM"
description: "Create a new bill of materials with part entries"
method: "POST"
endpoint: "/api/bom"
service: "bomService"
category: "BOM"
requestBody: "CreateBomInput"
responseType: "BOM"
errorCodes: [400]
navigation:
  order: 3
---

# Create BOM

::endpoint-card{method="POST" path="/api/bom"}

Creates a new bill of materials. A BOM defines the parts and quantities required per build, along with the contributing jobs that supply each part.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | BOM name / identifier |
| `entries` | `array` | Yes | Array of part entries |
| `entries[].partType` | `string` | Yes | Part type name |
| `entries[].requiredQuantityPerBuild` | `number` | Yes | Quantity needed per build |
| `entries[].contributingJobIds` | `string[]` | Yes | Job IDs that supply this part |

## Example Request

```json
{
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
    }
  ]
}
```

## Response

Returns the created `BOM` object:

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
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Missing `name` or `entries`, or empty `entries` array |

::
