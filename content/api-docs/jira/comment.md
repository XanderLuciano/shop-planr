---
title: 'Push Comment to Jira'
description: 'Push a comment summary or individual step note to the linked Jira ticket'
method: 'POST'
endpoint: '/api/jira/comment'
service: 'jiraService'
category: 'Jira'
requestBody: '{ jobId, noteId? }'
responseType: 'JiraPushResult'
errorCodes: [400, 404, 502]
navigation:
  order: 5
---

# Push Comment to Jira

::endpoint-card{method="POST" path="/api/jira/comment"}

Pushes a comment to the Jira ticket linked to the specified job. This endpoint supports two modes depending on whether a `noteId` is provided:

1. **Individual note** (`noteId` provided) — Pushes a specific step note as a Jira comment, formatted as `{StepName} - {SN-00001, SN-00002}: {note text}`. This is used to escalate individual defect observations or process notes to Jira.

2. **Comment summary** (`noteId` omitted) — Pushes a full status summary comment showing the current serial count at each step for every path, formatted as a bulleted list. This provides a snapshot of production progress as a Jira comment.

Both the `enabled` and `pushEnabled` toggles must be active in [App Settings](/api-docs/settings). The job must have a linked Jira ticket.

## Request

### Request Body

| Field    | Type     | Required | Description                                                                                                                                  |
| -------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `jobId`  | `string` | Yes      | The ID of the job whose linked Jira ticket will receive the comment.                                                                         |
| `noteId` | `string` | No       | The ID of a specific step note to push. When provided, only that note is pushed as a comment. When omitted, a full status summary is posted. |

## Response

### 200 OK

Returns a `JiraPushResult` indicating success or failure.

| Field     | Type                  | Description                                   |
| --------- | --------------------- | --------------------------------------------- |
| `success` | `boolean`             | `true` if the comment was posted successfully |
| `error`   | `string \| undefined` | Error message if `success` is `false`         |

### 400 Bad Request

| Condition                    | Message                             |
| ---------------------------- | ----------------------------------- |
| Jira integration is disabled | `"Jira integration is not enabled"` |
| Jira push is disabled        | `"Jira push is not enabled"`        |
| `jobId` is missing or empty  | `"jobId is required"`               |

### 404 Not Found

| Condition          | Message                    |
| ------------------ | -------------------------- |
| Job does not exist | `"Job not found: {jobId}"` |

### 502 Bad Gateway

| Condition                                 | Message                                   |
| ----------------------------------------- | ----------------------------------------- |
| Jira API unreachable when posting comment | `"Jira API error: {status} {statusText}"` |

## Examples

### Request — Push a specific note

```bash
curl -X POST http://localhost:3000/api/jira/comment \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job_abc123",
    "noteId": "note_def456"
  }'
```

### Response — Note pushed successfully

```json
{
  "success": true
}
```

The resulting Jira comment would look like:

> Assembly - SN-00001, SN-00002: Minor surface blemish observed, within tolerance.

### Request — Push comment summary

```bash
curl -X POST http://localhost:3000/api/jira/comment \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job_abc123"
  }'
```

### Response — Summary pushed successfully

```json
{
  "success": true
}
```

The resulting Jira comment would look like:

> **Status Summary for JOB-2024-001**
>
> **Main Route:**
>
> - CNC Machining: 12 parts
> - Deburring: 8 parts
> - Inspection: 3 parts
> - Completed: 27

### Response — Job not linked

```json
{
  "success": false,
  "error": "Job is not linked to a Jira ticket"
}
```

### Response — Note not found

```json
{
  "success": false,
  "error": "Note not found: note_invalid"
}
```

## Notes

- When pushing a note, the step name is resolved by looking up the note's `stepId` in the path's step list. If the step is not found, `"Unknown Step"` is used.
- The note comment format includes the serial IDs from the note's `serialIds` array, joined with commas.
- The comment summary uses Jira wiki markup with bold text (`*text*`) for headers and path names.
- If the Jira API call fails, the error is caught and returned as `{ success: false, error: "..." }` rather than throwing a 502.
- Pushing the same note multiple times will create duplicate comments in Jira. The note's `pushedToJira` flag is not updated by this endpoint — that tracking is informational only.
- The comment summary includes a "Completed" count for each path, representing serials that have finished all steps.

## Related Endpoints

- [Push to Jira](/api-docs/jira/push) — Push a description table instead of a comment
- [Create Note](/api-docs/notes/create) — Create a step note that can later be pushed to Jira
- [Get Notes by Step](/api-docs/notes/by-step) — List notes for a step to find one to push
- [Update Settings](/api-docs/settings/update) — Enable or disable the push toggle

::
