---
title: "Get by Step Name"
description: "Retrieve operator data filtered by step name"
method: "GET"
endpoint: "/api/operator/:stepName"
service: "jobService"
category: "Operator"
errorCodes: [400, 404]
navigation:
  order: 5
---

# Get by Step Name

::endpoint-card{method="GET" path="/api/operator/:stepName"}

Retrieves operator data filtered by step name. Returns all jobs and serials currently at the specified step across all paths.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `stepName` | `string` | Yes | Name of the process step (e.g. `Assembly`, `Inspection`) |

## Response

Returns data for the matching step:

```json
{
  "stepName": "Assembly",
  "items": [
    {
      "jobId": "job_abc123",
      "jobName": "JOB-2024-001",
      "pathId": "path_xyz",
      "stepId": "step_001",
      "serialCount": 5,
      "assignedTo": "user_abc",
      "location": "Bay 3"
    }
  ]
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Invalid step name |
| `404` | No steps found with the given name |

::
