---
title: "Create Job"
description: "Create a new production job with optional Jira ticket linking"
method: "POST"
endpoint: "/api/jobs"
service: "jobService"
category: "Jobs"
requestBody: "CreateJobInput"
responseType: "Job"
errorCodes: [400]
navigation:
  order: 3
---

# Create Job

::endpoint-card{method="POST" path="/api/jobs"}

Creates a new production job. A job represents a production order that will be routed through one or more paths with process steps.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Job name / identifier |
| `goalQuantity` | `number` | Yes | Target quantity to produce |
| `jiraTicketKey` | `string` | No | Link to Jira ticket (e.g. `PI-42`) |
| `jiraTicketSummary` | `string` | No | Jira ticket summary |
| `jiraPartNumber` | `string` | No | Part number from Jira |
| `jiraPriority` | `string` | No | Priority from Jira |
| `jiraEpicLink` | `string` | No | Epic link from Jira |
| `jiraLabels` | `string[]` | No | Labels from Jira |

## Example Request

```json
{
  "name": "JOB-2024-001",
  "goalQuantity": 50,
  "jiraTicketKey": "PI-42"
}
```

## Response

Returns the created `Job` object:

```json
{
  "id": "job_abc123",
  "name": "JOB-2024-001",
  "goalQuantity": 50,
  "jiraTicketKey": "PI-42",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Missing `name` or `goalQuantity`, or `goalQuantity <= 0` |

::
