---
title: "Complete Deferred Step"
description: "Complete a previously deferred process step for a serial number"
method: "POST"
endpoint: "/api/serials/:id/complete-deferred/:stepId"
service: "lifecycleService"
category: "Serials"
requestBody: "CompleteDeferredStepInput"
responseType: "SnStepStatus"
errorCodes: [400, 404, 500]
navigation:
  order: 14
---

# Complete Deferred Step

::endpoint-card{method="POST" path="/api/serials/:id/complete-deferred/:stepId"}

Completes a previously deferred process step for a serial number. Deferred steps are required steps that were bypassed during advancement (via [Advance to Step](/api-docs/serials/advance-to)) and still need to be resolved. This endpoint changes the step's status from `deferred` to `completed`, indicating that the work was performed out of sequence but is now done.

This is one of two ways to resolve a deferred step. The other is [Waive Step](/api-docs/serials/waive-step), which formally excuses the step without completing it. Use this endpoint when the work was actually performed; use waive when the work is no longer required.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The unique identifier of the serial number (e.g. `"SN-00001"`) |
| `stepId` | `string` | Yes | The unique identifier of the deferred step to complete (e.g. `"step_002"`) |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | Yes | ID of the user completing the deferred step. Used for audit trail attribution. |

## Response

### 200 OK

Returned when the deferred step is successfully completed. The response contains the updated `SnStepStatus` object.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the step status record |
| `serialId` | `string` | ID of the serial number |
| `stepId` | `string` | ID of the completed step |
| `stepIndex` | `number` | Zero-based position of the step in the path sequence |
| `status` | `"completed"` | Always `"completed"` after this operation |
| `updatedAt` | `string` | ISO 8601 timestamp of when the completion was recorded |

### 400 Bad Request

Returned when the step cannot be completed due to its current status.

| Condition | Message |
|-----------|---------|
| Step is not in `deferred` status | `"Can only complete deferred steps — step status is: {currentStatus}"` |

### 404 Not Found

Returned when the serial or step status record does not exist.

| Condition | Message |
|-----------|---------|
| Serial does not exist | `"Serial not found: {id}"` |
| Step status record does not exist | `"SnStepStatus not found: {serialId}/{stepId}"` |

### 500 Internal Server Error

Returned if an unhandled error occurs during the completion operation.

| Condition | Message |
|-----------|---------|
| Database write failure | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request — Complete a deferred heat treatment step

```bash
curl -X POST http://localhost:3000/api/serials/SN-00001/complete-deferred/step_002 \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_op2"
  }'
```

### Response — Step completed

```json
{
  "id": "snss_008",
  "serialId": "SN-00001",
  "stepId": "step_002",
  "stepIndex": 1,
  "status": "completed",
  "updatedAt": "2024-01-16T10:00:00.000Z"
}
```

### Error — Step is not deferred

Attempting to complete a step that is `pending`, `in_progress`, `completed`, `skipped`, or `waived`:

```bash
curl -X POST http://localhost:3000/api/serials/SN-00002/complete-deferred/step_001 \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_op1"
  }'
```

```json
{
  "statusCode": 400,
  "message": "Can only complete deferred steps — step status is: completed"
}
```

## Notes

- **Only deferred steps** can be completed via this endpoint. Steps with any other status (`pending`, `in_progress`, `completed`, `skipped`, `waived`) will be rejected with a 400 error that includes the current status in the message.
- An audit trail entry of type `deferred_step_completed` is recorded, capturing the user, serial, job, path, and step. This provides traceability for out-of-sequence work completion.
- Completing a deferred step does **not** change the serial's `currentStepIndex` or overall `status`. The serial remains at whatever step it was advanced to — this endpoint only updates the individual step's status record.
- After completing all deferred steps, the serial may become eligible for normal completion. Use [Get Step Statuses](/api-docs/serials/step-statuses) to check whether any deferred steps remain.
- This endpoint is commonly used in manufacturing workflows where a step like heat treatment or coating is performed in batches — the serial advances past the step during routing, and the step is completed later when the batch process finishes.
- The error message includes the current status value, which helps diagnose why the completion was rejected (e.g. the step was already completed, or was waived instead of deferred).

## Related Endpoints

- [Waive Step](/api-docs/serials/waive-step) — Alternative: formally waive the step instead of completing it
- [Get Step Statuses](/api-docs/serials/step-statuses) — View step statuses to identify deferred steps
- [Advance to Step](/api-docs/serials/advance-to) — The advancement that creates deferred steps
- [Force Complete Serial](/api-docs/serials/force-complete) — Force-complete when deferred steps cannot be resolved

::
