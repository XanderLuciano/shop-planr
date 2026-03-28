---
title: "Get All Queue Items"
description: "Retrieve all items in the operator queue"
method: "GET"
endpoint: "/api/operator/queue/_all"
service: "jobService"
category: "Operator"
errorCodes: [400]
navigation:
  order: 3
---

# Get All Queue Items

::endpoint-card{method="GET" path="/api/operator/queue/_all"}

Retrieves all items in the operator queue across all users and unassigned work. Returns a comprehensive list of pending work items.

## Response

Returns all queue items:

```json
[
  {
    "stepId": "step_001",
    "stepName": "Assembly",
    "jobId": "job_abc123",
    "jobName": "JOB-2024-001",
    "pathId": "path_xyz",
    "assignedTo": "user_abc",
    "pendingCount": 5,
    "location": "Bay 3"
  }
]
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error |

::
