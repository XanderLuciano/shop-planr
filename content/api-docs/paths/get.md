---
title: "Get Path"
description: "Retrieve a single path with step distribution data"
method: "GET"
endpoint: "/api/paths/:id"
service: "pathService"
category: "Paths"
responseType: "Path"
errorCodes: [400, 404]
navigation:
  order: 1
---

# Get Path

::endpoint-card{method="GET" path="/api/paths/:id"}

Retrieves a single path by ID, including its process steps and step distribution data showing serial counts at each step.

## Response

Returns the `Path` object enriched with `distribution`:

```json
{
  "id": "path_xyz",
  "jobId": "job_abc123",
  "name": "Main Route",
  "goalQuantity": 50,
  "advancementMode": "strict",
  "steps": [
    {
      "id": "step_001",
      "name": "Cutting",
      "order": 0,
      "location": "Bay A",
      "optional": false,
      "dependencyType": "physical"
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z",
  "distribution": [
    {
      "stepId": "step_001",
      "stepName": "Cutting",
      "stepOrder": 0,
      "location": "Bay A",
      "serialCount": 12,
      "completedCount": 8,
      "isBottleneck": true
    }
  ]
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error |
| `404` | Path not found |

::
