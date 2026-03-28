---
title: "List BOMs"
description: "Retrieve all bills of materials"
method: "GET"
endpoint: "/api/bom"
service: "bomService"
category: "BOM"
responseType: "BOM[]"
errorCodes: [400]
navigation:
  order: 1
---

# List BOMs

::endpoint-card{method="GET" path="/api/bom"}

Retrieves all bills of materials. Each BOM defines the parts and quantities required for a production build.

## Response

Returns an array of `BOM` objects:

```json
[
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
      }
    ],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
]
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error |

::
