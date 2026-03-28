---
title: "Update BOM"
description: "Update an existing bill of materials"
method: "PUT"
endpoint: "/api/bom/:id"
service: "bomService"
category: "BOM"
requestBody: "Partial<CreateBomInput>"
responseType: "BOM"
errorCodes: [400, 404]
navigation:
  order: 4
---

# Update BOM

::endpoint-card{method="PUT" path="/api/bom/:id"}

Updates an existing bill of materials. Supports partial updates — only the provided fields are modified.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | No | Updated BOM name |
| `entries` | `array` | No | Updated array of part entries |
| `entries[].partType` | `string` | Yes (if entries provided) | Part type name |
| `entries[].requiredQuantityPerBuild` | `number` | Yes (if entries provided) | Quantity needed per build |
| `entries[].contributingJobIds` | `string[]` | Yes (if entries provided) | Job IDs that supply this part |

## Example Request

```json
{
  "name": "Widget Assembly BOM v2",
  "entries": [
    {
      "partType": "Steel Plate",
      "requiredQuantityPerBuild": 6,
      "contributingJobIds": ["job_001", "job_002", "job_004"]
    }
  ]
}
```

## Response

Returns the updated `BOM` object:

```json
{
  "id": "bom_abc123",
  "name": "Widget Assembly BOM v2",
  "entries": [
    {
      "id": "entry_001",
      "bomId": "bom_abc123",
      "partType": "Steel Plate",
      "requiredQuantityPerBuild": 6,
      "contributingJobIds": ["job_001", "job_002", "job_004"]
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-20T14:00:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error or empty `entries` array |
| `404` | BOM not found |

::
