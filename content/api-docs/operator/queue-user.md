---
title: "Get User Queue"
description: "Retrieve queue items assigned to a specific user"
method: "GET"
endpoint: "/api/operator/queue/:userId"
service: "jobService"
category: "Operator"
errorCodes: [400, 404]
navigation:
  order: 4
---

# Get User Queue

::endpoint-card{method="GET" path="/api/operator/queue/:userId"}

Retrieves queue items assigned to a specific user. Shows all pending work for the operator, useful for the operator kiosk view.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` | Yes | User ID to filter queue by |

## Response

Returns queue items for the user:

```json
[
  {
    "stepId": "step_001",
    "stepName": "Assembly",
    "jobId": "job_abc123",
    "jobName": "JOB-2024-001",
    "pathId": "path_xyz",
    "pendingCount": 5,
    "location": "Bay 3"
  }
]
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Invalid user ID format |
| `404` | User not found |

::
