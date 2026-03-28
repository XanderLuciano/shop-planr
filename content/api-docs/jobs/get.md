---
title: "Get Job"
description: "Retrieve a single job with its paths and progress"
method: "GET"
endpoint: "/api/jobs/:id"
service: "jobService"
category: "Jobs"
responseType: "Job"
errorCodes: [400, 404]
navigation:
  order: 2
---

# Get Job

::endpoint-card{method="GET" path="/api/jobs/:id"}

Retrieves a single production job by ID, including its associated paths and computed progress statistics.

## Response

Returns the `Job` object enriched with `paths` and `progress`:

```json
{
  "id": "job_abc123",
  "name": "JOB-2024-001",
  "goalQuantity": 50,
  "jiraTicketKey": "PI-42",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z",
  "paths": [
    {
      "id": "path_xyz",
      "jobId": "job_abc123",
      "name": "Main Route",
      "goalQuantity": 50,
      "advancementMode": "strict",
      "steps": [],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "progress": {
    "jobId": "job_abc123",
    "jobName": "JOB-2024-001",
    "goalQuantity": 50,
    "totalSerials": 25,
    "completedSerials": 10,
    "inProgressSerials": 14,
    "scrappedSerials": 1,
    "producedQuantity": 25,
    "orderedQuantity": 50,
    "progressPercent": 20.4
  }
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error |
| `404` | Job not found |

::
