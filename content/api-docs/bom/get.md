---
title: "Get BOM"
description: "Retrieve a single bill of materials by ID"
method: "GET"
endpoint: "/api/bom/:id"
service: "bomService"
category: "BOM"
responseType: "BOM"
errorCodes: [400, 404]
navigation:
  order: 2
---

# Get BOM

::endpoint-card{method="GET" path="/api/bom/:id"}

Retrieves a single bill of materials by its ID, including all part entries.

## Response

Returns the `BOM` object:

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
| `400` | Validation error |
| `404` | BOM not found |

::
