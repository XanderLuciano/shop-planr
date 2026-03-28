---
title: "Waive Step"
description: "Waive a process step for a serial number with approval"
method: "POST"
endpoint: "/api/serials/:id/waive-step/:stepId"
service: "lifecycleService"
category: "Serials"
requestBody: "WaiveStepInput"
responseType: "SnStepStatus"
errorCodes: [400, 404]
navigation:
  order: 13
---

# Waive Step

::endpoint-card{method="POST" path="/api/serials/:id/waive-step/:stepId"}

Waives a process step for a serial number. The step's status is changed to `waived`, meaning it is no longer required for the serial to advance. Requires an approver and a reason for audit purposes.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | `string` | Yes | Reason for waiving the step |
| `approverId` | `string` | Yes | ID of the user approving the waiver |

## Example Request

```json
{
  "reason": "Customer accepted without final inspection",
  "approverId": "user_supervisor"
}
```

## Response

Returns the updated `SnStepStatus` object:

```json
{
  "id": "ss_001",
  "serialId": "sn_00001",
  "stepId": "step_003",
  "stepIndex": 2,
  "status": "waived",
  "updatedAt": "2024-01-15T16:30:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Missing reason or approverId, step already completed/waived |
| `404` | Serial or step not found |

::
