---
title: 'Create Job'
description: 'Create a new production job with optional Jira ticket linking'
method: 'POST'
endpoint: '/api/jobs'
service: 'jobService'
category: 'Jobs'
requestBody: 'CreateJobInput'
responseType: 'Job'
errorCodes: [400, 500]
navigation:
  order: 3
---

# Create Job

::endpoint-card{method="POST" path="/api/jobs"}

Creates a new production job in the system. A job represents a single production order that will be routed through one or more manufacturing paths. Every job requires a human-readable name and a goal quantity indicating how many units need to be produced. Optionally, you can attach Jira metadata at creation time to link the job to an external Jira ticket for traceability.

After creating a job, the next step is typically to define one or more paths using the [Paths API](/api-docs/paths), then create serial numbers against those paths to begin tracking production. The job itself does not contain routing information — that lives on the path level.

## Request

### Request Body

| Field               | Type       | Required | Description                                                                                                                                                   |
| ------------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`              | `string`   | Yes      | A human-readable name or identifier for the job. Typically a work order number (e.g. `"JOB-2024-001"`). Must be a non-empty string.                           |
| `goalQuantity`      | `number`   | Yes      | The target number of units to produce for this job. Must be a positive integer greater than zero. This value is used to compute overall progress percentages. |
| `jiraTicketKey`     | `string`   | No       | The Jira issue key to link this job to (e.g. `"PI-42"`). When provided, establishes a reference between this job and the corresponding Jira ticket.           |
| `jiraTicketSummary` | `string`   | No       | The summary (title) of the linked Jira ticket. Stored for display purposes so the UI can show the ticket summary without making a Jira API call.              |
| `jiraPartNumber`    | `string`   | No       | The part number extracted from the Jira ticket's custom fields. Used to display part identification information alongside the job.                            |
| `jiraPriority`      | `string`   | No       | The priority level from the Jira ticket (e.g. `"High"`, `"Medium"`, `"Low"`). Stored for display and filtering purposes.                                      |
| `jiraEpicLink`      | `string`   | No       | The epic link key from Jira (e.g. `"PI-10"`). Indicates which Jira epic this ticket belongs to.                                                               |
| `jiraLabels`        | `string[]` | No       | An array of label strings from the Jira ticket (e.g. `["Q1-2024", "rush"]`). Used for categorization and filtering in the UI.                                 |

## Response

### 201 Created

Returned when the job is successfully created. The response contains the complete `Job` object with server-generated fields (`id`, `createdAt`, `updatedAt`).

| Field               | Type                    | Description                                                     |
| ------------------- | ----------------------- | --------------------------------------------------------------- |
| `id`                | `string`                | Server-generated unique identifier for the new job              |
| `name`              | `string`                | The job name as provided in the request                         |
| `goalQuantity`      | `number`                | The goal quantity as provided in the request                    |
| `jiraTicketKey`     | `string \| undefined`   | Jira issue key, if provided                                     |
| `jiraTicketSummary` | `string \| undefined`   | Jira ticket summary, if provided                                |
| `jiraPartNumber`    | `string \| undefined`   | Part number from Jira, if provided                              |
| `jiraPriority`      | `string \| undefined`   | Priority from Jira, if provided                                 |
| `jiraEpicLink`      | `string \| undefined`   | Epic link from Jira, if provided                                |
| `jiraLabels`        | `string[] \| undefined` | Labels from Jira, if provided                                   |
| `createdAt`         | `string`                | ISO 8601 timestamp of when the job was created                  |
| `updatedAt`         | `string`                | ISO 8601 timestamp — same as `createdAt` for newly created jobs |

### 400 Bad Request

Returned when the request body fails validation. The response includes a message describing the specific validation failure.

| Condition                          | Message                                 |
| ---------------------------------- | --------------------------------------- |
| `name` is missing or empty         | `"name is required"`                    |
| `goalQuantity` is missing          | `"goalQuantity is required"`            |
| `goalQuantity` is zero or negative | `"goalQuantity must be greater than 0"` |
| `goalQuantity` is not a number     | `"goalQuantity must be a number"`       |

### 500 Internal Server Error

Returned if an unhandled error occurs while persisting the job to the database.

| Condition                    | Message                   |
| ---------------------------- | ------------------------- |
| Database write failure       | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request — Full payload with Jira metadata

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "JOB-2024-001",
    "goalQuantity": 50,
    "jiraTicketKey": "PI-42",
    "jiraTicketSummary": "Build 50 aluminum housings",
    "jiraPartNumber": "ALU-HOUSING-7075",
    "jiraPriority": "High",
    "jiraEpicLink": "PI-10",
    "jiraLabels": ["Q1-2024", "rush"]
  }'
```

### Response — Full payload

```json
{
  "id": "job_abc123",
  "name": "JOB-2024-001",
  "goalQuantity": 50,
  "jiraTicketKey": "PI-42",
  "jiraTicketSummary": "Build 50 aluminum housings",
  "jiraPartNumber": "ALU-HOUSING-7075",
  "jiraPriority": "High",
  "jiraEpicLink": "PI-10",
  "jiraLabels": ["Q1-2024", "rush"],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### Request — Minimal payload (no Jira)

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "JOB-2024-002",
    "goalQuantity": 200
  }'
```

### Response — Minimal payload

```json
{
  "id": "job_def456",
  "name": "JOB-2024-002",
  "goalQuantity": 200,
  "createdAt": "2024-01-16T14:00:00.000Z",
  "updatedAt": "2024-01-16T14:00:00.000Z"
}
```

## Notes

- Jira fields are **write-once at creation time**. They cannot be modified via the [Update Job](/api-docs/jobs/update) endpoint. If you need to change Jira metadata, you must delete and recreate the job.
- The `id` field is generated server-side and cannot be specified in the request body.
- Creating a job does not automatically create any paths or serial numbers. You must explicitly create paths via the [Paths API](/api-docs/paths) after the job exists.
- There is no uniqueness constraint on `name`. Multiple jobs can share the same name, though this is not recommended for clarity.
- The `goalQuantity` on the job is the top-level target. Individual paths can have their own `goalQuantity` values that may sum to a different total — the job-level value is the authoritative production target.

## Related Endpoints

- [List Jobs](/api-docs/jobs/list) — Retrieve all production jobs
- [Get Job](/api-docs/jobs/get) — Retrieve a single job with paths and progress
- [Update Job](/api-docs/jobs/update) — Modify an existing job's name or goal quantity
- [Create Path](/api-docs/paths/create) — Define a manufacturing route for a job
- [Link Jira Ticket](/api-docs/jira/link) — Link an existing job to a Jira ticket after creation

::
