---
title: 'Advance Serial'
description: 'Advance a serial number to the next process step in its path'
method: 'POST'
endpoint: '/api/serials/:id/advance'
service: 'serialService'
category: 'Serials'
requestBody: 'AdvanceSerialInput'
responseType: 'SerialNumber'
errorCodes: [400, 404, 500]
navigation:
  order: 4
---

# Advance Serial

::endpoint-card{method="POST" path="/api/serials/:id/advance"}

Advances a serial number to the next sequential process step in its path. This is the standard advancement mechanism for `strict` mode paths where serials must move through steps one at a time in order.

When the serial is at the **last step** in the path, advancing it transitions the serial to `completed` status with `currentStepIndex: -1`. The step status for the current step is marked as `completed`, and an audit trail entry is recorded.

For non-sequential advancement (skipping steps, jumping ahead), use the [Advance to Step](/api-docs/serials/advance-to) endpoint instead. This endpoint always moves exactly one step forward.

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                                               |
| --------- | -------- | -------- | ------------------------------------------------------------------------- |
| `id`      | `string` | Yes      | The unique identifier of the serial number to advance (e.g. `"SN-00001"`) |

### Request Body

| Field    | Type     | Required | Description                                                                                                      |
| -------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `userId` | `string` | Yes      | ID of the user performing the advancement. Used for audit trail tracking. If omitted, defaults to `"anonymous"`. |

## Response

### 200 OK

Returned when the serial is successfully advanced. The response contains the updated `SerialNumber` object reflecting the new step position.

| Field              | Type                           | Description                                                                 |
| ------------------ | ------------------------------ | --------------------------------------------------------------------------- |
| `id`               | `string`                       | Serial identifier                                                           |
| `jobId`            | `string`                       | ID of the parent job                                                        |
| `pathId`           | `string`                       | ID of the manufacturing path                                                |
| `currentStepIndex` | `number`                       | New step index after advancement. `-1` if the serial just completed.        |
| `status`           | `"in_progress" \| "completed"` | Updated status. Changes to `"completed"` when advancing past the last step. |
| `forceCompleted`   | `boolean`                      | Always `false` for normal advancement                                       |
| `createdAt`        | `string`                       | ISO 8601 timestamp of serial creation                                       |
| `updatedAt`        | `string`                       | ISO 8601 timestamp — updated to reflect the advancement time                |

### 400 Bad Request

Returned when the serial cannot be advanced due to its current state.

| Condition                         | Message                                |
| --------------------------------- | -------------------------------------- |
| Serial status is `scrapped`       | `"Cannot advance a scrapped serial"`   |
| Serial status is `completed`      | `"Serial number is already completed"` |
| Serial `currentStepIndex` is `-1` | `"Serial number is already completed"` |

### 404 Not Found

Returned when the serial number does not exist.

| Condition                                | Message                          |
| ---------------------------------------- | -------------------------------- |
| Serial does not exist                    | `"SerialNumber not found: {id}"` |
| Path referenced by serial does not exist | `"Path not found: {pathId}"`     |

### 500 Internal Server Error

Returned if an unhandled error occurs during advancement.

| Condition                    | Message                   |
| ---------------------------- | ------------------------- |
| Database write failure       | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request — Advance to next step

```bash
curl -X POST http://localhost:3000/api/serials/SN-00001/advance \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_op1"
  }'
```

### Response — Advanced to step 2

```json
{
  "id": "SN-00001",
  "jobId": "job_abc123",
  "pathId": "path_xyz789",
  "currentStepIndex": 2,
  "status": "in_progress",
  "forceCompleted": false,
  "createdAt": "2024-01-15T11:00:00.000Z",
  "updatedAt": "2024-01-15T15:00:00.000Z"
}
```

### Request — Advance past final step (completion)

```bash
curl -X POST http://localhost:3000/api/serials/SN-00002/advance \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_qc1"
  }'
```

### Response — Serial completed

```json
{
  "id": "SN-00002",
  "jobId": "job_abc123",
  "pathId": "path_xyz789",
  "currentStepIndex": -1,
  "status": "completed",
  "forceCompleted": false,
  "createdAt": "2024-01-15T11:00:00.000Z",
  "updatedAt": "2024-01-15T17:30:00.000Z"
}
```

## Notes

- This endpoint performs a **single-step** advancement. It always moves the serial from step N to step N+1, or from the last step to completion. It does not skip or bypass any steps.
- Two audit trail entries may be created: a `serial_advanced` entry for mid-path advancement, or a `serial_completed` entry when the serial finishes the last step.
- The `userId` defaults to `"anonymous"` if not provided in the request body. Always provide a real user ID for proper audit trail attribution.
- This endpoint does **not** update `SnStepStatus` records — it only updates the serial's `currentStepIndex` and `status`. Step status tracking is managed by the [Advance to Step](/api-docs/serials/advance-to) endpoint and the lifecycle service. For strict-mode paths, step statuses are updated during advancement via the lifecycle layer.
- If you need to advance a serial multiple steps at once, use the [Advance to Step](/api-docs/serials/advance-to) endpoint with the desired `targetStepIndex`.

## Related Endpoints

- [Advance to Step](/api-docs/serials/advance-to) — Jump to a specific step (non-sequential)
- [Get Step Statuses](/api-docs/serials/step-statuses) — View per-step status after advancement
- [Scrap Serial](/api-docs/serials/scrap) — Remove a serial from production
- [Force Complete Serial](/api-docs/serials/force-complete) — Complete a serial bypassing remaining steps
- [Get Serial](/api-docs/serials/get) — Retrieve the serial's current state

::
