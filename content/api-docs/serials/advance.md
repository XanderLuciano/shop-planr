---
title: "Advance Serial"
description: "Advance a serial number to the next process step"
method: "POST"
endpoint: "/api/serials/:id/advance"
service: "serialService"
category: "Serials"
requestBody: "AdvanceSerialInput"
responseType: "AdvancementResult"
errorCodes: [400, 404]
navigation:
  order: 4
---

# Advance Serial

::endpoint-card{method="POST" path="/api/serials/:id/advance"}

Advances a serial number to the next process step in its path. In flexible or per-step advancement modes, optional steps may be bypassed (skipped or deferred) automatically.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | Yes | ID of the user performing the advancement |

## Example Request

```json
{
  "userId": "user_01"
}
```

## Response

Returns an `AdvancementResult` with the updated serial and any bypassed steps:

```json
{
  "serial": {
    "id": "sn_00001",
    "jobId": "job_abc123",
    "pathId": "path_xyz",
    "currentStepIndex": 2,
    "status": "in_progress",
    "forceCompleted": false,
    "createdAt": "2024-01-15T11:00:00Z",
    "updatedAt": "2024-01-15T15:00:00Z"
  },
  "bypassed": [
    {
      "stepId": "step_002",
      "stepName": "Optional QC",
      "classification": "skipped"
    }
  ]
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Serial is already completed or scrapped |
| `404` | Serial not found |

::
