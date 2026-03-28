---
title: "Push to Jira"
description: "Push a production status description table to the linked Jira ticket"
method: "POST"
endpoint: "/api/jira/push"
service: "jiraService"
category: "Jira"
requestBody: "{ jobId }"
responseType: "JiraPushResult"
errorCodes: [400, 404, 502]
navigation:
  order: 4
---

# Push to Jira

::endpoint-card{method="POST" path="/api/jira/push"}

Pushes a production status description table to the Jira ticket linked to the specified job. The endpoint appends a Jira wiki markup table to the ticket's existing description, showing the current serial number distribution across process steps for each path, timestamped with today's date. This creates a running log of production progress directly on the Jira ticket.

Both the `enabled` and `pushEnabled` toggles must be active in [App Settings](/api-docs/settings). The job must have a linked Jira ticket (`jiraTicketKey` must be set), and the job must have at least one path defined.

The push operation:

1. Fetches the current ticket description from Jira via `GET`
2. Computes the step distribution (serial counts per step) for each path
3. Builds a Jira wiki markup table with step names as columns and today's counts as a data row
4. Appends the table(s) to the existing description
5. Updates the ticket via `PUT`

## Request

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jobId` | `string` | Yes | The ID of the job whose data should be pushed to Jira. The job must have a linked Jira ticket. |

## Response

### 200 OK

Returns a `JiraPushResult` indicating success or failure.

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` if the push completed successfully |
| `error` | `string \| undefined` | Error message if `success` is `false` |

### 400 Bad Request

| Condition | Message |
|-----------|---------|
| Jira integration is disabled | `"Jira integration is not enabled"` |
| Jira push is disabled | `"Jira push is not enabled"` |
| `jobId` is missing or empty | `"jobId is required"` |

### 404 Not Found

| Condition | Message |
|-----------|---------|
| Job does not exist | `"Job not found: {jobId}"` |

### 502 Bad Gateway

| Condition | Message |
|-----------|---------|
| Jira API unreachable during GET or PUT | `"Jira API error: {status} {statusText}"` |

## Examples

### Request

```bash
curl -X POST http://localhost:3000/api/jira/push \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job_abc123"
  }'
```

### Response — Success

```json
{
  "success": true
}
```

### Response — Job not linked to Jira

```json
{
  "success": false,
  "error": "Job is not linked to a Jira ticket"
}
```

### Response — Job has no paths

```json
{
  "success": false,
  "error": "Job has no paths"
}
```

## Notes

- The description table is **appended** to the existing ticket description, not replaced. Each push adds a new timestamped table, creating a historical log.
- The wiki markup format uses Jira's table syntax: `|| Header ||` for header cells and `| Data |` for data cells.
- Each path generates its own table section, prefixed with the path name in bold.
- The "Completed" column shows the count of serials that have finished all steps (step index = -1).
- If the Jira API call fails during the push, the error is caught and returned as `{ success: false, error: "..." }` rather than throwing a 502.
- Pushing to the same ticket multiple times is safe — each push appends a new dated row.
- The `mode` field from `PushToJiraInput` is not used by this endpoint. The push endpoint always writes a description table. For comment summaries, use the [Comment endpoint](/api-docs/jira/comment).

## Related Endpoints

- [Push Comment to Jira](/api-docs/jira/comment) — Push a comment summary instead of a description table
- [Get Job](/api-docs/jobs/get) — Verify the job exists and has a linked Jira ticket
- [Update Settings](/api-docs/settings/update) — Enable or disable the push toggle

::
