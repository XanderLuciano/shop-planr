---
title: "Get Notes by Serial"
description: "Retrieve all step notes referencing a specific serial number"
method: "GET"
endpoint: "/api/notes/serial/:id"
service: "noteService"
category: "Notes"
responseType: "StepNote[]"
errorCodes: [500]
navigation:
  order: 2
---

# Get Notes by Serial

::endpoint-card{method="GET" path="/api/notes/serial/:id"}

Retrieves all step notes that reference a specific serial number. A note references a serial when the serial's ID appears in the note's `serialIds` array. This returns notes across all steps and paths for the given serial, providing a complete annotation history for a single part.

This endpoint is used on the serial detail page to display the full note history in the Notes section, giving operators and supervisors visibility into every observation recorded against the part throughout its production lifecycle.

The query is performed at the repository level by scanning notes whose `serialIds` array contains the given ID. Notes are returned in storage order (typically creation order).

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The serial number ID to query notes for (e.g. `"sn_00001"`). |

## Response

### 200 OK

Returns an array of `StepNote` objects. May be empty if no notes reference the serial.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique note identifier |
| `jobId` | `string` | Job ID the note belongs to |
| `pathId` | `string` | Path ID the note belongs to |
| `stepId` | `string` | Step ID where the note was created |
| `serialIds` | `string[]` | All serial IDs this note references (may include other serials beyond the queried one) |
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
curl http://localhost:3000/api/notes/serial/sn_00001
```

### Response — Multiple notes across steps

```json
[
  {
    "id": "note_a1b2c3",
    "jobId": "job_abc123",
    "pathId": "path_xyz789",
    "stepId": "step_001",
    "serialIds": ["sn_00001", "sn_00002"],
    "text": "Minor surface blemish observed, within tolerance.",
    "createdBy": "user_a1b2c3",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "pushedToJira": false
  },
  {
    "id": "note_d4e5f6",
    "jobId": "job_abc123",
    "pathId": "path_xyz789",
    "stepId": "step_003",
    "serialIds": ["sn_00001"],
    "text": "Final inspection passed. Dimensions within spec.",
    "createdBy": "user_d4e5f6",
    "createdAt": "2024-01-16T14:00:00.000Z",
    "pushedToJira": true,
    "jiraCommentId": "10042"
  }
]
```

### Response — No notes for serial

```json
[]
```

## Notes

- The response includes the **full `serialIds` array** for each note, not just the queried serial. A note created for serials `["sn_00001", "sn_00002", "sn_00003"]` will appear in the results for any of those three serial IDs, and the response will show all three IDs.
- This endpoint does not validate that the serial ID exists. Querying a non-existent serial ID simply returns an empty array.
- Notes are immutable — the returned data reflects the state at creation time. The `pushedToJira` and `jiraCommentId` fields may be updated by the Jira service after the note is pushed.
- There is no pagination. All matching notes are returned in a single response.

## Related Endpoints

- [Get Notes by Step](/api-docs/notes/by-step) — Query notes by step instead of serial
- [Create Note](/api-docs/notes/create) — Create a new note referencing this serial
- [Push Comment to Jira](/api-docs/jira/comment) — Push a note to Jira

::
