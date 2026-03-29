---
title: 'List Jobs'
description: 'Retrieve all production jobs in the system'
method: 'GET'
endpoint: '/api/jobs'
service: 'jobService'
category: 'Jobs'
responseType: 'Job[]'
errorCodes: [400, 500]
navigation:
  order: 1
---

# List Jobs

::endpoint-card{method="GET" path="/api/jobs"}

Returns every production job in the system as a flat array of `Job` objects. This endpoint does not accept any query parameters or support pagination — it always returns the complete list. Use this endpoint to populate job listing pages, dashboard summaries, or dropdown selectors where the user needs to pick from all available jobs.

The response includes Jira metadata fields when present but does **not** include nested paths or computed progress. To retrieve paths and progress for a specific job, use the [Get Job](/api-docs/jobs/get) endpoint.

## Request

This endpoint accepts no path parameters, query parameters, or request body.

## Response

### 200 OK

Returned when the request is successful. The response is always an array, even if no jobs exist (in which case an empty array `[]` is returned).

| Field               | Type                    | Description                                                      |
| ------------------- | ----------------------- | ---------------------------------------------------------------- |
| `id`                | `string`                | Unique identifier for the job (e.g. `"job_abc123"`)              |
| `name`              | `string`                | Human-readable job name, typically a work order number           |
| `goalQuantity`      | `number`                | Target number of units to produce for this job                   |
| `jiraTicketKey`     | `string \| undefined`   | Jira issue key if the job is linked to a ticket (e.g. `"PI-42"`) |
| `jiraTicketSummary` | `string \| undefined`   | Summary text from the linked Jira ticket                         |
| `jiraPartNumber`    | `string \| undefined`   | Part number extracted from the Jira ticket's custom fields       |
| `jiraPriority`      | `string \| undefined`   | Priority level from the Jira ticket (e.g. `"High"`, `"Medium"`)  |
| `jiraEpicLink`      | `string \| undefined`   | Epic link key from Jira (e.g. `"PI-10"`)                         |
| `jiraLabels`        | `string[] \| undefined` | Array of label strings from the Jira ticket                      |
| `createdAt`         | `string`                | ISO 8601 timestamp of when the job was created                   |
| `updatedAt`         | `string`                | ISO 8601 timestamp of the last modification                      |

### 400 Bad Request

Returned if an unexpected validation error occurs during the request.

| Condition                   | Message                                          |
| --------------------------- | ------------------------------------------------ |
| Internal validation failure | Varies — describes the specific validation issue |

### 500 Internal Server Error

Returned if an unhandled error occurs while fetching jobs from the database.

| Condition                    | Message                   |
| ---------------------------- | ------------------------- |
| Database connection failure  | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request

```bash
curl -X GET http://localhost:3000/api/jobs \
  -H "Accept: application/json"
```

### Response

```json
[
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
  },
  {
    "id": "job_def456",
    "name": "JOB-2024-002",
    "goalQuantity": 200,
    "createdAt": "2024-01-16T14:00:00.000Z",
    "updatedAt": "2024-01-18T09:15:00.000Z"
  },
  {
    "id": "job_ghi789",
    "name": "JOB-2024-003",
    "goalQuantity": 25,
    "jiraTicketKey": "PI-87",
    "jiraTicketSummary": "Prototype run — titanium brackets",
    "jiraPriority": "Medium",
    "jiraLabels": ["prototype"],
    "createdAt": "2024-02-01T08:45:00.000Z",
    "updatedAt": "2024-02-01T08:45:00.000Z"
  }
]
```

## Notes

- This endpoint returns **all** jobs with no filtering or pagination. For large datasets, consider implementing client-side filtering or requesting a specific job by ID.
- Jira-related fields (`jiraTicketKey`, `jiraTicketSummary`, etc.) are only present on jobs that were linked to a Jira ticket at creation time. They will be `undefined` (omitted from JSON) on jobs created without Jira metadata.
- The response does **not** include `paths` or `progress` data. Use [Get Job](/api-docs/jobs/get) to retrieve the full job detail with nested paths and computed progress.

## Related Endpoints

- [Get Job](/api-docs/jobs/get) — Retrieve a single job with paths and progress
- [Create Job](/api-docs/jobs/create) — Create a new production job
- [Update Job](/api-docs/jobs/update) — Modify an existing job's name or goal quantity

::
