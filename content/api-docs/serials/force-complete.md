---
title: "Force Complete Serial"
description: "Force-complete a serial number, bypassing all remaining required steps"
method: "POST"
endpoint: "/api/serials/:id/force-complete"
service: "lifecycleService"
category: "Serials"
requestBody: "ForceCompleteInput"
responseType: "SerialNumber"
errorCodes: [400, 404, 500]
navigation:
  order: 7
---

# Force Complete Serial

::endpoint-card{method="POST" path="/api/serials/:id/force-complete"}

Force-completes a serial number, marking it as completed regardless of its current step position. This is an exceptional operation intended for situations where normal completion is not possible — for example, when a customer accepts a partially-processed unit, or when remaining steps are no longer applicable.

The serial's status changes to `completed` with `currentStepIndex: -1`, and the `forceCompleted` flag is set to `true` to distinguish it from normally completed serials. An optional reason can be provided to document why the force-completion was necessary.

This endpoint enforces a key constraint: the serial must have **at least one incomplete required step**. If all required steps are already completed or waived, the serial should be completed normally via the [Advance Serial](/api-docs/serials/advance) endpoint instead.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The unique identifier of the serial number to force-complete (e.g. `"SN-00001"`) |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | `string` | No | Free-text reason explaining why the serial is being force-completed. Recommended for audit trail clarity. |
| `userId` | `string` | Yes | ID of the user performing the force-completion. Used for audit trail attribution. |

## Response

### 200 OK

Returned when the serial is successfully force-completed. The response contains the updated `SerialNumber` object with force-completion metadata populated.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Serial identifier |
| `jobId` | `string` | ID of the parent job |
| `pathId` | `string` | ID of the manufacturing path |
| `currentStepIndex` | `number` | Always `-1` after force-completion |
| `status` | `"completed"` | Always `"completed"` after this operation |
| `forceCompleted` | `boolean` | Always `true` after force-completion |
| `forceCompletedBy` | `string` | User ID of who performed the force-completion |
| `forceCompletedAt` | `string` | ISO 8601 timestamp of when the force-completion occurred |
| `forceCompletedReason` | `string \| undefined` | The reason text, if provided |
| `createdAt` | `string` | ISO 8601 timestamp of serial creation |
| `updatedAt` | `string` | ISO 8601 timestamp — updated to reflect the force-completion time |

### 400 Bad Request

Returned when the serial cannot be force-completed due to its current state.

| Condition | Message |
|-----------|---------|
| Serial is already scrapped | `"Cannot force-complete a scrapped serial"` |
| Serial is already completed | `"Serial is already completed"` |
| All required steps are already completed/waived | `"Serial has no incomplete required steps — use normal completion"` |

### 404 Not Found

Returned when the serial or its path does not exist.

| Condition | Message |
|-----------|---------|
| Serial does not exist | `"Serial not found: {id}"` |
| Path referenced by serial does not exist | `"Path not found: {pathId}"` |

### 500 Internal Server Error

Returned if an unhandled error occurs during force-completion.

| Condition | Message |
|-----------|---------|
| Database write failure | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request — Force-complete with reason

```bash
curl -X POST http://localhost:3000/api/serials/SN-00001/force-complete \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer accepted partial completion — remaining coating step waived verbally",
    "userId": "user_supervisor"
  }'
```

### Response — Force-completed serial

```json
{
  "id": "SN-00001",
  "jobId": "job_abc123",
  "pathId": "path_xyz789",
  "currentStepIndex": -1,
  "status": "completed",
  "forceCompleted": true,
  "forceCompletedBy": "user_supervisor",
  "forceCompletedAt": "2024-01-15T17:00:00.000Z",
  "forceCompletedReason": "Customer accepted partial completion — remaining coating step waived verbally",
  "createdAt": "2024-01-15T11:00:00.000Z",
  "updatedAt": "2024-01-15T17:00:00.000Z"
}
```

### Request — Force-complete without reason

```bash
curl -X POST http://localhost:3000/api/serials/SN-00005/force-complete \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_supervisor"
  }'
```

### Response — Force-completed without reason

```json
{
  "id": "SN-00005",
  "jobId": "job_def456",
  "pathId": "path_abc111",
  "currentStepIndex": -1,
  "status": "completed",
  "forceCompleted": true,
  "forceCompletedBy": "user_supervisor",
  "forceCompletedAt": "2024-01-16T14:00:00.000Z",
  "createdAt": "2024-01-16T09:30:00.000Z",
  "updatedAt": "2024-01-16T14:00:00.000Z"
}
```

## Notes

- Force-completion is **irreversible**. Once a serial is force-completed, it cannot be un-completed or returned to `in_progress` status.
- The system checks for incomplete required steps by examining all `SnStepStatus` records and active `SnStepOverride` records. A step is considered "incomplete required" if it is not optional, has no active override, and its status is neither `completed` nor `waived`.
- If the serial has **no** incomplete required steps, the API rejects the request with a 400 error. This prevents accidental force-completion when normal advancement would suffice. Use [Advance Serial](/api-docs/serials/advance) to complete a serial that has finished all required steps.
- The audit trail entry of type `serial_force_completed` includes the list of `incompleteStepIds` in its metadata, documenting exactly which steps were bypassed.
- Force-completed serials count toward the job's `completedSerials` total in progress calculations, just like normally completed serials. The `forceCompleted` flag allows the UI to distinguish between the two.
- The `reason` field is optional but strongly recommended. It provides context for auditors and quality reviewers who may need to understand why normal completion was bypassed.

## Related Endpoints

- [Scrap Serial](/api-docs/serials/scrap) — Alternative terminal state for defective serials
- [Advance Serial](/api-docs/serials/advance) — Normal step-by-step advancement
- [Advance to Step](/api-docs/serials/advance-to) — Jump to a specific step
- [Get Serial](/api-docs/serials/get) — View the force-completed serial's full record
- [Get Step Statuses](/api-docs/serials/step-statuses) — See which steps were incomplete at force-completion time

::
