---
title: "Push to Jira"
description: "Push job data to a linked Jira ticket"
method: "POST"
endpoint: "/api/jira/push"
service: "jiraService"
category: "Jira"
requestBody: "PushToJiraInput"
errorCodes: [400, 404, 502]
navigation:
  order: 4
---

# Push to Jira

::endpoint-card{method="POST" path="/api/jira/push"}

Pushes production data from a job to its linked Jira ticket. Supports two modes: updating the ticket description with a formatted table, or adding a comment summary.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jobId` | `string` | Yes | Job ID to push data from |
| `mode` | `string` | Yes | `"description_table"` or `"comment_summary"` |

## Example Request

```json
{
  "jobId": "job_abc123",
  "mode": "description_table"
}
```

## Response

Returns a success confirmation:

```json
{
  "success": true
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Missing `jobId` or invalid `mode` value |
| `404` | Job not found or no linked Jira ticket |
| `502` | Jira API unreachable or returned an error |

::
