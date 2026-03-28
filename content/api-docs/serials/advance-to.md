---
title: "Advance to Step"
description: "Advance a serial number to a specific target step"
method: "POST"
endpoint: "/api/serials/:id/advance-to"
service: "lifecycleService"
category: "Serials"
requestBody: "AdvanceToStepInput"
responseType: "AdvancementResult"
errorCodes: [400, 404]
navigation:
  order: 5
---

# Advance to Step

::endpoint-card{method="POST" path="/api/serials/:id/advance-to"}

Advances a serial number directly to a specific target step index, bypassing intermediate steps. Steps between the current position and the target are classified as skipped or deferred based on the path's advancement mode and step configuration.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `targetStepIndex` | `number` | Yes | Zero-based index of the target step |
| `userId` | `string` | Yes | ID of the user performing the advancement |

## Example Request

```json
{
  "targetStepIndex": 3,
  "userId": "user_01"
}
```

## Response

Returns an `AdvancementResult` with the updated serial and bypassed steps:

```json
{
  "serial": {
    "id": "sn_00001",
    "jobId": "job_abc123",
    "pathId": "path_xyz",
    "currentStepIndex": 3,
    "status": "in_progress",
    "forceCompleted": false,
    "createdAt": "2024-01-15T11:00:00Z",
    "updatedAt": "2024-01-15T16:00:00Z"
  },
  "bypassed": [
    { "stepId": "step_002", "stepName": "Welding", "classification": "skipped" },
    { "stepId": "step_003", "stepName": "Coating", "classification": "deferred" }
  ]
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Serial already completed/scrapped, target step index out of range, or target is behind current position |
| `404` | Serial not found |

::
