---
title: "Complete Deferred Step"
description: "Complete a previously deferred process step for a serial number"
method: "POST"
endpoint: "/api/serials/:id/complete-deferred/:stepId"
service: "lifecycleService"
category: "Serials"
requestBody: "CompleteDeferredStepInput"
responseType: "SnStepStatus"
errorCodes: [400, 404]
navigation:
  order: 14
---

# Complete Deferred Step

::endpoint-card{method="POST" path="/api/serials/:id/complete-deferred/:stepId"}

Completes a previously deferred process step for a serial number. Deferred steps are steps that were bypassed during advancement but still need to be completed later. The step's status changes from `deferred` to `completed`.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | Yes | ID of the user completing the deferred step |

## Example Request

```json
{
  "userId": "user_01"
}
```

## Response

Returns the updated `SnStepStatus` object:

```json
{
  "id": "ss_002",
  "serialId": "sn_00001",
  "stepId": "step_002",
  "stepIndex": 1,
  "status": "completed",
  "updatedAt": "2024-01-16T10:00:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Step is not in `deferred` status |
| `404` | Serial or step not found |

::
