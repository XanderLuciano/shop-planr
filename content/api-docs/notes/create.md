---
title: "Create Note"
description: "Create a step note for one or more serial numbers"
method: "POST"
endpoint: "/api/notes"
service: "noteService"
category: "Notes"
requestBody: "{ jobId, pathId, stepId, serialIds, text, createdBy }"
responseType: "StepNote"
errorCodes: [400]
navigation:
  order: 1
---

# Create Note

::endpoint-card{method="POST" path="/api/notes"}

Creates a step note attached to one or more serial numbers at a specific process step. Notes can later be pushed to Jira as comments.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jobId` | `string` | Yes | Job ID the note belongs to |
| `pathId` | `string` | Yes | Path ID the note belongs to |
| `stepId` | `string` | Yes | Step ID the note is attached to |
| `serialIds` | `string[]` | Yes | Serial number IDs the note applies to |
| `text` | `string` | Yes | Note content |
| `createdBy` | `string` | Yes | User ID of the note author |

## Example Request

```json
{
  "jobId": "job_abc123",
  "pathId": "path_xyz",
  "stepId": "step_001",
  "serialIds": ["sn_001", "sn_002"],
  "text": "Minor surface blemish observed, within tolerance.",
  "createdBy": "user_abc"
}
```

## Response

Returns the created `StepNote` object:

```json
{
  "id": "note_abc123",
  "jobId": "job_abc123",
  "pathId": "path_xyz",
  "stepId": "step_001",
  "serialIds": ["sn_001", "sn_002"],
  "text": "Minor surface blemish observed, within tolerance.",
  "createdBy": "user_abc",
  "createdAt": "2024-01-15T10:30:00Z",
  "pushedToJira": false
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Missing required fields or invalid IDs |

::
