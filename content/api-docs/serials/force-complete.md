---
title: "Force Complete Serial"
description: "Force-complete a serial number, bypassing remaining steps"
method: "POST"
endpoint: "/api/serials/:id/force-complete"
service: "lifecycleService"
category: "Serials"
requestBody: "ForceCompleteInput"
responseType: "SerialNumber"
errorCodes: [400, 404]
navigation:
  order: 7
---

# Force Complete Serial

::endpoint-card{method="POST" path="/api/serials/:id/force-complete"}

Force-completes a serial number, marking it as completed regardless of its current step position. All remaining steps are bypassed. An audit trail entry is created.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | `string` | No | Reason for force-completing |
| `userId` | `string` | Yes | ID of the user performing the action |

## Example Request

```json
{
  "reason": "Customer accepted partial completion",
  "userId": "user_01"
}
```

## Response

Returns the updated `SerialNumber` object:

```json
{
  "id": "sn_00001",
  "jobId": "job_abc123",
  "pathId": "path_xyz",
  "currentStepIndex": -1,
  "status": "completed",
  "forceCompleted": true,
  "forceCompletedBy": "user_01",
  "forceCompletedAt": "2024-01-15T17:00:00Z",
  "forceCompletedReason": "Customer accepted partial completion",
  "createdAt": "2024-01-15T11:00:00Z",
  "updatedAt": "2024-01-15T17:00:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Serial already completed or scrapped |
| `404` | Serial not found |

::
