---
title: "Get Step View"
description: "Retrieve the operator view data for a specific step"
method: "GET"
endpoint: "/api/operator/step/:stepId"
service: "jobService"
category: "Operator"
errorCodes: [400, 404]
navigation:
  order: 1
---

# Get Step View

::endpoint-card{method="GET" path="/api/operator/step/:stepId"}

Retrieves the operator view data for a specific process step. Returns aggregated information about the step including assigned serials, completion status, and notes.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `stepId` | `string` | Yes | Process step ID |

## Response

Returns the step view data:

```json
{
  "step": {
    "id": "step_001",
    "name": "Assembly",
    "order": 1,
    "location": "Bay 3",
    "assignedTo": "user_abc",
    "optional": false,
    "dependencyType": "physical"
  },
  "serials": [
    {
      "id": "sn_001",
      "status": "in_progress",
      "currentStepIndex": 0
    }
  ],
  "job": {
    "id": "job_abc123",
    "name": "JOB-2024-001"
  }
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Invalid step ID format |
| `404` | Step not found |

::
