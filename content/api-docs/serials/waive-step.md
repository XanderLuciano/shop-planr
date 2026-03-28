---
title: "Waive Step"
description: "Formally waive a deferred process step for a serial number with approver authorization"
method: "POST"
endpoint: "/api/serials/:id/waive-step/:stepId"
service: "lifecycleService"
category: "Serials"
requestBody: "WaiveStepInput"
responseType: "SnStepStatus"
errorCodes: [400, 404, 500]
navigation:
  order: 13
---

# Waive Step

::endpoint-card{method="POST" path="/api/serials/:id/waive-step/:stepId"}

Formally waives a deferred process step for a serial number. Waiving changes the step's status from `deferred` to `waived`, indicating that an authorized approver has determined the step is no longer required for this specific serial.

Waivers are a formal quality control mechanism — they require both a reason and an approver identity, both of which are recorded in the audit trail. This distinguishes waivers from overrides: overrides are set **before** advancement to affect future behavior, while waivers resolve steps that were **already bypassed** during advancement.

Only steps in `deferred` status can be waived. Additionally, only **required** steps can be waived — optional steps that were bypassed receive `skipped` status and don't need waivers.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The unique identifier of the serial number (e.g. `"SN-00001"`) |
| `stepId` | `string` | Yes | The unique identifier of the deferred step to waive (e.g. `"step_003"`) |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | `string` | Yes | Explanation of why the step is being waived. Must be a non-empty string. Recorded in the audit trail. |
| `approverId` | `string` | Yes | ID of the user authorizing the waiver. This is typically a supervisor or quality lead — not necessarily the same person who deferred the step. |

## Response

### 200 OK

Returned when the step is successfully waived. The response contains the updated `SnStepStatus` object.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the step status record |
| `serialId` | `string` | ID of the serial number |
| `stepId` | `string` | ID of the waived step |
| `stepIndex` | `number` | Zero-based position of the step in the path sequence |
| `status` | `"waived"` | Always `"waived"` after this operation |
| `updatedAt` | `string` | ISO 8601 timestamp of when the waiver was applied |

### 400 Bad Request

Returned when the waiver cannot be applied due to validation failures.

| Condition | Message |
|-----------|---------|
| `reason` is missing or empty | `"Waiver requires a reason and approver identity"` |
| `approverId` is missing or empty | `"Waiver requires a reason and approver identity"` |
| Step is not in `deferred` status | `"Can only waive deferred required steps"` |
| Step is optional (only required steps can be waived) | `"Can only waive required steps — this step is optional"` |

### 404 Not Found

Returned when the serial, step, or step status record does not exist.

| Condition | Message |
|-----------|---------|
| Serial does not exist | `"Serial not found: {id}"` |
| Step status record does not exist | `"SnStepStatus not found: {serialId}/{stepId}"` |
| Process step does not exist in the path | `"ProcessStep not found: {stepId}"` |
| Path referenced by serial does not exist | `"Path not found: {pathId}"` |

### 500 Internal Server Error

Returned if an unhandled error occurs during the waiver operation.

| Condition | Message |
|-----------|---------|
| Database write failure | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request — Waive a deferred inspection step

```bash
curl -X POST http://localhost:3000/api/serials/SN-00001/waive-step/step_003 \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer accepted without final inspection per PO amendment #47",
    "approverId": "user_supervisor"
  }'
```

### Response — Step waived

```json
{
  "id": "snss_015",
  "serialId": "SN-00001",
  "stepId": "step_003",
  "stepIndex": 2,
  "status": "waived",
  "updatedAt": "2024-01-15T16:30:00.000Z"
}
```

### Error — Step is not deferred

```bash
curl -X POST http://localhost:3000/api/serials/SN-00002/waive-step/step_001 \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Not needed",
    "approverId": "user_supervisor"
  }'
```

```json
{
  "statusCode": 400,
  "message": "Can only waive deferred required steps"
}
```

## Notes

- **Only deferred required steps** can be waived. Steps with status `pending`, `in_progress`, `completed`, `skipped`, or already `waived` will be rejected. Optional steps that were bypassed receive `skipped` status and don't need waivers.
- The `approverId` is recorded separately from the `userId` that might appear in other endpoints. This is intentional — waivers represent a formal approval decision, and the approver should be someone with authority to make that decision (e.g. a supervisor or quality lead).
- An audit trail entry of type `step_waived` is recorded, capturing the `approverId`, serial, job, path, step, and reason in the metadata. This provides a complete audit trail for quality compliance.
- Waived steps count as "resolved" for completion readiness. The [Force Complete](/api-docs/serials/force-complete) endpoint checks whether all required steps are completed or waived — waived steps do not block force-completion.
- Waivers are **permanent** — there is no endpoint to un-waive a step. If a waiver was applied in error, the step cannot be returned to `deferred` status.
- The difference between waivers and overrides: **Overrides** are set before advancement to affect how steps are classified during future advancement (skipped vs deferred). **Waivers** resolve steps that were already deferred during past advancement.

## Related Endpoints

- [Complete Deferred Step](/api-docs/serials/complete-deferred) — Alternative: complete the deferred step instead of waiving it
- [Get Step Statuses](/api-docs/serials/step-statuses) — View step statuses to identify deferred steps
- [List & Create Overrides](/api-docs/serials/overrides) — Pre-advancement step overrides (different from waivers)
- [Force Complete Serial](/api-docs/serials/force-complete) — Force-complete checks waived steps as resolved

::
