---
title: 'Create Note'
description: 'Create a step note for one or more serial numbers at a process step'
method: 'POST'
endpoint: '/api/notes'
service: 'noteService'
category: 'Notes'
requestBody: '{ jobId, pathId, stepId, serialIds, text, userId }'
responseType: 'StepNote'
errorCodes: [400, 500]
navigation:
  order: 1
---

# Create Note

::endpoint-card{method="POST" path="/api/notes"}

Creates a step note attached to one or more serial numbers at a specific process step. The note records a free-text observation, defect description, or process deviation that is permanently associated with the specified serials and step.

All six fields are required. The `text` field is trimmed of leading and trailing whitespace before storage. The `serialIds` array must contain at least one serial ID. The `userId` field identifies the operator who created the note and is recorded in the audit trail.

Creating a note also generates a `note_created` audit entry with the user, job, path, and step IDs for traceability.

## Request

### Request Body

| Field       | Type       | Required | Description                                                                                                                                        |
| ----------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jobId`     | `string`   | Yes      | The job ID this note belongs to. Used for Jira integration (to find the linked ticket) and audit trail recording.                                  |
| `pathId`    | `string`   | Yes      | The path ID this note belongs to. Used to resolve the step name when pushing to Jira.                                                              |
| `stepId`    | `string`   | Yes      | The process step ID where the observation was made. Notes are queryable by step.                                                                   |
| `serialIds` | `string[]` | Yes      | Array of serial number IDs this note applies to. Must contain at least one ID. A single note can reference multiple serials (e.g. a batch defect). |
| `text`      | `string`   | Yes      | The note content. Must be a non-empty string. Trimmed of leading/trailing whitespace.                                                              |
| `userId`    | `string`   | Yes      | The user ID of the note author. Stored as `createdBy` on the note and recorded in the audit trail.                                                 |

## Response

### 200 OK

Returns the newly created `StepNote` object with server-generated fields.

| Field           | Type                  | Description                                               |
| --------------- | --------------------- | --------------------------------------------------------- |
| `id`            | `string`              | Server-generated unique identifier (e.g. `"note_a1b2c3"`) |
| `jobId`         | `string`              | Job ID as provided                                        |
| `pathId`        | `string`              | Path ID as provided                                       |
| `stepId`        | `string`              | Step ID as provided                                       |
| `serialIds`     | `string[]`            | Serial IDs as provided                                    |
| `text`          | `string`              | Trimmed note text                                         |
| `createdBy`     | `string`              | User ID of the author (from `userId` input)               |
| `createdAt`     | `string`              | ISO 8601 timestamp of creation                            |
| `pushedToJira`  | `boolean`             | Always `false` for newly created notes                    |
| `jiraCommentId` | `string \| undefined` | Always absent for newly created notes                     |

### 400 Bad Request

| Condition                             | Message                   |
| ------------------------------------- | ------------------------- |
| `text` is missing or empty            | `"text is required"`      |
| `text` is only whitespace             | `"text is required"`      |
| `serialIds` is missing or empty array | `"serialIds is required"` |

### 500 Internal Server Error

| Condition              | Message                   |
| ---------------------- | ------------------------- |
| Database write failure | `"Internal Server Error"` |

## Examples

### Request — Note on multiple serials

```bash
curl -X POST http://localhost:3000/api/notes \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job_abc123",
    "pathId": "path_xyz789",
    "stepId": "step_001",
    "serialIds": ["sn_00001", "sn_00002", "sn_00003"],
    "text": "Minor surface blemish observed on batch, within tolerance. Documented for traceability.",
    "userId": "user_a1b2c3"
  }'
```

### Response — Note created

```json
{
  "id": "note_m4n7p9",
  "jobId": "job_abc123",
  "pathId": "path_xyz789",
  "stepId": "step_001",
  "serialIds": ["sn_00001", "sn_00002", "sn_00003"],
  "text": "Minor surface blemish observed on batch, within tolerance. Documented for traceability.",
  "createdBy": "user_a1b2c3",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "pushedToJira": false
}
```

### Request — Note on a single serial

```bash
curl -X POST http://localhost:3000/api/notes \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job_abc123",
    "pathId": "path_xyz789",
    "stepId": "step_002",
    "serialIds": ["sn_00005"],
    "text": "Torque verified at 25 Nm per spec.",
    "userId": "user_d4e5f6"
  }'
```

### Response — Single serial note

```json
{
  "id": "note_q8r9s0",
  "jobId": "job_abc123",
  "pathId": "path_xyz789",
  "stepId": "step_002",
  "serialIds": ["sn_00005"],
  "text": "Torque verified at 25 Nm per spec.",
  "createdBy": "user_d4e5f6",
  "createdAt": "2024-01-15T11:00:00.000Z",
  "pushedToJira": false
}
```

## Notes

- The `userId` field in the request body maps to `createdBy` in the response. This naming difference exists because the API input uses `userId` consistently across all endpoints, while the domain model uses `createdBy` for attribution.
- The note does **not** validate that the `jobId`, `pathId`, `stepId`, or `serialIds` reference existing records. Invalid IDs will be stored but may cause issues when querying or pushing to Jira.
- Notes are immutable after creation. There is no update or delete endpoint. To correct a note, create a new one with the corrected text.
- The `pushedToJira` flag is informational. It is set to `true` when the note is pushed via the [Comment endpoint](/api-docs/jira/comment), but this tracking is managed by the Jira service, not the notes API.
- Creating a note generates a `note_created` audit entry. The audit entry records the `userId`, `jobId`, `pathId`, and `stepId` but not the note text itself.

## Related Endpoints

- [Get Notes by Serial](/api-docs/notes/by-serial) — Query notes for a specific serial
- [Get Notes by Step](/api-docs/notes/by-step) — Query notes for a specific step
- [Push Comment to Jira](/api-docs/jira/comment) — Push this note to Jira as a comment

::
