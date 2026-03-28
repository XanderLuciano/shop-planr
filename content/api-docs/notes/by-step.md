---
title: "Get Notes by Step"
description: "Retrieve all step notes attached to a specific process step"
method: "GET"
endpoint: "/api/notes/step/:id"
service: "noteService"
category: "Notes"
responseType: "StepNote[]"
errorCodes: [500]
navigation:
  order: 3
---

# Get Notes by Step

::endpoint-card{method="GET" path="/api/notes/step/:id"}

Retrieves all step notes attached to a specific process step. Returns every note created at the given step across all serial numbers, providing a complete view of observations and defects recorded at a particular workstation or process stage.

This endpoint is used by the operator step view to display contextual notes alongside the parts currently at the step. It is also called internally by the step view API endpoint (`GET /api/operator/step/:stepId`) to include notes in the aggregated response.

Notes are returned in storage order (typically creation order).

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The process step ID to query notes for (e.g. `"step_001"`). |

## Response

### 200 OK

Returns an array of `StepNote` objects. May be empty if no notes exist for the step.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique note identifier |
| `jobId` | `string` | Job ID the note belongs to |
| `pathId` | `string` | Path ID the note belongs to |
| `stepId` | `string` | Step ID (matches the queried `:id` parameter) |
| `serialIds` | `string[]` | Serial IDs this note applies to |
| `text` | `string` | Note content |
| `createdBy` | `string` | User ID of the note author |
| `createdAt` | `string` | ISO 8601 creation timestamp |
| `pushedToJira` | `boolean` | Whether this note has been pushed to Jira |
| `jiraCommentId` | `string \| undefined` | Jira comment ID if pushed |

### 500 Internal Server Error

| Condition | Message |
|-----------|---------|
| Database read failure | `"Internal Server Error"` |

## Examples

### Request

```bash
curl http://localhost:3000/api/notes/step/step_001
```

### Response — Notes at a step

```json
[
  {
    "id": "note_a1b2c3",
    "jobId": "job_abc123",
    "pathId": "path_xyz789",
    "stepId": "step_001",
    "serialIds": ["sn_00001", "sn_00002"],
    "text": "Minor surface blemish observed on batch, within tolerance.",
    "createdBy": "user_a1b2c3",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "pushedToJira": false
  },
  {
    "id": "note_g7h8i9",
    "jobId": "job_abc123",
    "pathId": "path_xyz789",
    "stepId": "step_001",
    "serialIds": ["sn_00005"],
    "text": "Torque spec verified at 25 Nm.",
    "createdBy": "user_d4e5f6",
    "createdAt": "2024-01-15T14:00:00.000Z",
    "pushedToJira": true,
    "jiraCommentId": "10042"
  }
]
```

### Response — No notes at step

```json
[]
```

## Notes

- This endpoint does not validate that the step ID exists. Querying a non-existent step ID returns an empty array rather than a 404.
- Notes from different jobs and paths can appear in the same response if they share the same step ID. In practice, step IDs are unique across the system (generated with `step_` prefix + nanoid), so this only returns notes from the specific step instance.
- The `serialIds` array on each note shows all serials the note applies to, not just those currently at the step. Serials may have advanced past the step since the note was created.
- There is no pagination. All matching notes are returned in a single response.
- This is the same data source used by the [Step View](/api-docs/operator/step-view) endpoint, which includes notes in its aggregated response.

## Related Endpoints

- [Get Notes by Serial](/api-docs/notes/by-serial) — Query notes by serial instead of step
- [Create Note](/api-docs/notes/create) — Create a new note at this step
- [Get Step View](/api-docs/operator/step-view) — Aggregated step view that includes notes

::
