---
title: "Get Work Queue"
description: "Retrieve the work queue overview for all operators"
method: "GET"
endpoint: "/api/operator/work-queue"
service: "jobService"
category: "Operator"
errorCodes: [400]
navigation:
  order: 2
---

# Get Work Queue

::endpoint-card{method="GET" path="/api/operator/work-queue"}

Retrieves the work queue overview showing all active steps across jobs, grouped by assignment. Provides a high-level view of what work is pending and in progress.

## Response

Returns the work queue data:

```json
{
  "queue": [
    {
      "stepId": "step_001",
      "stepName": "Assembly",
      "jobName": "JOB-2024-001",
      "assignedTo": "user_abc",
      "pendingCount": 5,
      "location": "Bay 3"
    },
    {
      "stepId": "step_002",
      "stepName": "Inspection",
      "jobName": "JOB-2024-001",
      "assignedTo": null,
      "pendingCount": 3,
      "location": "QC Lab"
    }
  ]
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error |

::
