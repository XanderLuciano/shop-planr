---
title: "Update Job"
description: "Update an existing production job"
method: "PUT"
endpoint: "/api/jobs/:id"
service: "jobService"
category: "Jobs"
requestBody: "UpdateJobInput"
responseType: "Job"
errorCodes: [400, 404]
navigation:
  order: 4
---

# Update Job

::endpoint-card{method="PUT" path="/api/jobs/:id"}

Updates an existing production job. Only the provided fields are modified; omitted fields remain unchanged.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | No | Updated job name |
| `goalQuantity` | `number` | No | Updated target quantity |

## Example Request

```json
{
  "name": "JOB-2024-001-REV2",
  "goalQuantity": 75
}
```

## Response

Returns the updated `Job` object:

```json
{
  "id": "job_abc123",
  "name": "JOB-2024-001-REV2",
  "goalQuantity": 75,
  "jiraTicketKey": "PI-42",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-16T08:00:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error (e.g. `goalQuantity <= 0`) |
| `404` | Job not found |

::
