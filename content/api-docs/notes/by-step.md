---
title: "Get Notes by Step"
description: "Retrieve all step notes for a specific process step"
method: "GET"
endpoint: "/api/notes/step/:id"
service: "noteService"
category: "Notes"
responseType: "StepNote[]"
errorCodes: [400, 404]
navigation:
  order: 3
---

# Get Notes by Step

::endpoint-card{method="GET" path="/api/notes/step/:id"}

Retrieves all step notes attached to a specific process step. Useful for reviewing all observations and defects recorded at a particular step.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Process step ID |

## Response

Returns an array of `StepNote` objects:

```json
[
  {
    "id": "note_abc123",
    "jobId": "job_abc123",
    "pathId": "path_xyz",
    "stepId": "step_001",
    "serialIds": ["sn_001"],
    "text": "Torque spec verified at 25 Nm.",
    "createdBy": "user_abc",
    "createdAt": "2024-01-15T10:30:00Z",
    "pushedToJira": true,
    "jiraCommentId": "10042"
  }
]
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Invalid step ID format |
| `404` | Step not found |

::
