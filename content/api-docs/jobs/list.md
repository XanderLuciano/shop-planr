---
title: "List Jobs"
description: "Retrieve all production jobs"
method: "GET"
endpoint: "/api/jobs"
service: "jobService"
category: "Jobs"
responseType: "Job[]"
errorCodes: [400]
navigation:
  order: 1
---

# List Jobs

::endpoint-card{method="GET" path="/api/jobs"}

Retrieves all production jobs. Returns an array of `Job` objects ordered by creation date.

## Response

Returns an array of `Job` objects:

```json
[
  {
    "id": "job_abc123",
    "name": "JOB-2024-001",
    "goalQuantity": 50,
    "jiraTicketKey": "PI-42",
    "jiraTicketSummary": "Build 50 widgets",
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
