---
title: "Push Note as Jira Comment"
description: "Push a step note to Jira as a comment on the linked ticket"
method: "POST"
endpoint: "/api/jira/comment"
service: "jiraService"
category: "Jira"
requestBody: "PushNoteToJiraInput"
errorCodes: [400, 404, 502]
navigation:
  order: 5
---

# Push Note as Jira Comment

::endpoint-card{method="POST" path="/api/jira/comment"}

Pushes a step note to the linked Jira ticket as a comment. The note's text content is posted as a Jira comment, and the note is marked as pushed.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `noteId` | `string` | Yes | ID of the step note to push |

## Example Request

```json
{
  "noteId": "note_abc123"
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
| `400` | Missing `noteId` |
| `404` | Note not found or no linked Jira ticket for the note's job |
| `502` | Jira API unreachable or returned an error |

::
