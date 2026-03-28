---
title: "Get Notes by Serial"
description: "Retrieve all step notes for a specific serial number"
method: "GET"
endpoint: "/api/notes/serial/:id"
service: "noteService"
category: "Notes"
responseType: "StepNote[]"
errorCodes: [400, 404]
navigation:
  order: 2
---

# Get Notes by Serial

::endpoint-card{method="GET" path="/api/notes/serial/:id"}

Retrieves all step notes associated with a specific serial number. Returns notes across all steps and paths for the serial.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Serial number ID |

## Response

Returns an array of `StepNote` objects:

```json
[
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
]
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Invalid serial ID format |
| `404` | Serial number not found |

::
