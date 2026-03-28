---
title: "List BOM Versions"
description: "Retrieve the version history of a bill of materials"
method: "GET"
endpoint: "/api/bom/:id/versions"
service: "bomService"
category: "BOM"
responseType: "BomVersion[]"
errorCodes: [400, 404]
navigation:
  order: 6
---

# List BOM Versions

::endpoint-card{method="GET" path="/api/bom/:id/versions"}

Retrieves the full version history of a bill of materials. Each version contains a snapshot of the BOM entries at that point in time, along with the change description and the user who made the edit.

## Response

Returns an array of `BomVersion` objects ordered by version number:

```json
[
  {
    "id": "bomver_001",
    "bomId": "bom_abc123",
    "versionNumber": 1,
    "entriesSnapshot": [
      {
        "partType": "Steel Plate",
        "requiredQuantityPerBuild": 4,
        "contributingJobIds": ["job_001"]
      }
    ],
    "changeDescription": "Initial BOM creation",
    "changedBy": "user_xyz",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  {
    "id": "bomver_002",
    "bomId": "bom_abc123",
    "versionNumber": 2,
    "entriesSnapshot": [
      {
        "partType": "Steel Plate",
        "requiredQuantityPerBuild": 6,
        "contributingJobIds": ["job_001", "job_002"]
      }
    ],
    "changeDescription": "Increased steel plate quantity per engineering review",
    "changedBy": "user_abc",
    "createdAt": "2024-01-20T14:00:00Z"
  }
]
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error |
| `404` | BOM not found |

::
