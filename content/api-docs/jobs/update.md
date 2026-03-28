---
title: "Update Job"
description: "Update an existing production job's name or goal quantity"
method: "PUT"
endpoint: "/api/jobs/:id"
service: "jobService"
category: "Jobs"
requestBody: "UpdateJobInput"
responseType: "Job"
errorCodes: [400, 404, 500]
navigation:
  order: 4
---

# Update Job

::endpoint-card{method="PUT" path="/api/jobs/:id"}

Updates an existing production job. This endpoint supports partial updates — only the fields included in the request body are modified; omitted fields retain their current values. This is useful for renaming a job mid-production or adjusting the goal quantity without affecting any other job properties.

Only `name` and `goalQuantity` can be updated. Jira metadata fields (`jiraTicketKey`, `jiraTicketSummary`, `jiraPartNumber`, `jiraPriority`, `jiraEpicLink`, `jiraLabels`) are immutable after creation and are ignored if included in the request body. To change Jira metadata, you must delete and recreate the job.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The unique identifier of the job to update (e.g. `"job_abc123"`) |

### Request Body

All fields are optional. Include only the fields you want to change. An empty body `{}` is technically valid but results in no changes.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | No | The new name for the job. Must be a non-empty string if provided. Useful for correcting typos or updating the work order number. |
| `goalQuantity` | `number` | No | The new target quantity for the job. Must be a positive integer greater than zero if provided. Changing this value affects the computed progress percentage returned by [Get Job](/api-docs/jobs/get). |

## Response

### 200 OK

Returned when the job is successfully updated. The response contains the complete `Job` object with all fields reflecting the current state after the update. The `updatedAt` timestamp is refreshed to the current time.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the job (unchanged) |
| `name` | `string` | The job name — updated if provided in the request, otherwise unchanged |
| `goalQuantity` | `number` | The goal quantity — updated if provided, otherwise unchanged |
| `jiraTicketKey` | `string \| undefined` | Jira issue key (immutable, unchanged) |
| `jiraTicketSummary` | `string \| undefined` | Jira ticket summary (immutable, unchanged) |
| `jiraPartNumber` | `string \| undefined` | Part number from Jira (immutable, unchanged) |
| `jiraPriority` | `string \| undefined` | Priority from Jira (immutable, unchanged) |
| `jiraEpicLink` | `string \| undefined` | Epic link from Jira (immutable, unchanged) |
| `jiraLabels` | `string[] \| undefined` | Labels from Jira (immutable, unchanged) |
| `createdAt` | `string` | ISO 8601 timestamp of original creation (unchanged) |
| `updatedAt` | `string` | ISO 8601 timestamp — refreshed to the current time on successful update |

### 400 Bad Request

Returned when the request body contains invalid values. Validation is only applied to fields that are present in the request.

| Condition | Message |
|-----------|---------|
| `name` is provided but empty | `"name cannot be empty"` |
| `goalQuantity` is provided but zero or negative | `"goalQuantity must be greater than 0"` |
| `goalQuantity` is provided but not a number | `"goalQuantity must be a number"` |

### 404 Not Found

Returned when no job exists with the given ID. The job is looked up before any validation or update logic runs.

| Condition | Message |
|-----------|---------|
| Job does not exist | `"Job not found: {id}"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while persisting the update to the database.

| Condition | Message |
|-----------|---------|
| Database write failure | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request — Update both fields

```bash
curl -X PUT http://localhost:3000/api/jobs/job_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "JOB-2024-001-REV2",
    "goalQuantity": 75
  }'
```

### Response — Update both fields

```json
{
  "id": "job_abc123",
  "name": "JOB-2024-001-REV2",
  "goalQuantity": 75,
  "jiraTicketKey": "PI-42",
  "jiraTicketSummary": "Build 50 aluminum housings",
  "jiraPartNumber": "ALU-HOUSING-7075",
  "jiraPriority": "High",
  "jiraEpicLink": "PI-10",
  "jiraLabels": ["Q1-2024", "rush"],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-20T16:45:00.000Z"
}
```

### Request — Update only goal quantity

```bash
curl -X PUT http://localhost:3000/api/jobs/job_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "goalQuantity": 100
  }'
```

### Response — Update only goal quantity

```json
{
  "id": "job_abc123",
  "name": "JOB-2024-001-REV2",
  "goalQuantity": 100,
  "jiraTicketKey": "PI-42",
  "jiraTicketSummary": "Build 50 aluminum housings",
  "jiraPartNumber": "ALU-HOUSING-7075",
  "jiraPriority": "High",
  "jiraEpicLink": "PI-10",
  "jiraLabels": ["Q1-2024", "rush"],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-21T09:30:00.000Z"
}
```

## Notes

- This is a **partial update** endpoint. You do not need to send the full job object — only the fields you want to change. Fields not included in the request body are left untouched.
- Jira metadata fields are **ignored** in update requests. Even if you include `jiraTicketKey` or other Jira fields in the body, they will not be modified. These fields are set once at creation time.
- Changing `goalQuantity` does **not** retroactively affect existing paths or serial numbers. If you reduce the goal below the number of already-completed serials, the progress percentage will exceed 100%.
- The `updatedAt` timestamp is refreshed on every successful update, even if the provided values are identical to the current values.
- There is no optimistic concurrency control (e.g., ETags). If two clients update the same job simultaneously, the last write wins.

## Related Endpoints

- [Get Job](/api-docs/jobs/get) — Retrieve the current state of a job with paths and progress
- [List Jobs](/api-docs/jobs/list) — Retrieve all production jobs
- [Create Job](/api-docs/jobs/create) — Create a new production job
- [Create Path](/api-docs/paths/create) — Define a manufacturing route for a job

::
