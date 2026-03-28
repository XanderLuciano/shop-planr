---
title: "List Serials"
description: "Retrieve all serial numbers with enriched data"
method: "GET"
endpoint: "/api/serials"
service: "serialService"
category: "Serials"
responseType: "EnrichedSerial[]"
errorCodes: [400]
navigation:
  order: 1
---

# List Serials

::endpoint-card{method="GET" path="/api/serials"}

Retrieves all serial numbers with enriched data including job name, path name, current step name, and assignment info.

## Response

Returns an array of `EnrichedSerial` objects:

```json
[
  {
    "id": "sn_00001",
    "jobId": "job_abc123",
    "jobName": "JOB-2024-001",
    "pathId": "path_xyz",
    "pathName": "Main Route",
    "currentStepIndex": 1,
    "currentStepName": "Welding",
    "assignedTo": "user_01",
    "status": "in-progress",
    "createdAt": "2024-01-15T11:00:00Z"
  }
]
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error |

::
