---
title: 'Advance to Step'
description: 'Advance a serial number directly to a specific target step, bypassing intermediate steps'
method: 'POST'
endpoint: '/api/serials/:id/advance-to'
service: 'lifecycleService'
category: 'Serials'
requestBody: 'AdvanceToStepInput'
responseType: 'AdvancementResult'
errorCodes: [400, 404, 500]
navigation:
  order: 5
---

# Advance to Step

::endpoint-card{method="POST" path="/api/serials/:id/advance-to"}

Advances a serial number directly to a specific target step index, potentially bypassing multiple intermediate steps in a single operation. This is the primary advancement mechanism for `flexible` and `per_step` mode paths where non-sequential movement is allowed.

Intermediate steps between the serial's current position and the target are automatically classified as either **skipped** (for optional steps or steps with active overrides) or **deferred** (for required steps that must be completed later). The classification is recorded in both the `SnStepStatus` records and the audit trail.

Setting `targetStepIndex` equal to the total number of steps in the path triggers **completion** — the serial transitions to `completed` status with `currentStepIndex: -1`.

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                                               |
| --------- | -------- | -------- | ------------------------------------------------------------------------- |
| `id`      | `string` | Yes      | The unique identifier of the serial number to advance (e.g. `"SN-00001"`) |

### Request Body

| Field             | Type     | Required | Description                                                                                                                                                                   |
| ----------------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `targetStepIndex` | `number` | Yes      | Zero-based index of the target step to advance to. Must be greater than the serial's current step index. Set to `path.steps.length` to trigger completion past the last step. |
| `userId`          | `string` | Yes      | ID of the user performing the advancement. Used for audit trail tracking.                                                                                                     |

## Response

### 200 OK

Returned when the serial is successfully advanced. The response is an `AdvancementResult` object containing the updated serial and a list of any bypassed steps.

#### Top-level fields

| Field      | Type             | Description                                                           |
| ---------- | ---------------- | --------------------------------------------------------------------- |
| `serial`   | `SerialNumber`   | The updated serial number object (see below)                          |
| `bypassed` | `BypassedStep[]` | Array of steps that were bypassed during this advancement (see below) |

#### `serial` — Updated SerialNumber

| Field              | Type                           | Description                                          |
| ------------------ | ------------------------------ | ---------------------------------------------------- |
| `id`               | `string`                       | Serial identifier                                    |
| `jobId`            | `string`                       | ID of the parent job                                 |
| `pathId`           | `string`                       | ID of the manufacturing path                         |
| `currentStepIndex` | `number`                       | New step index after advancement. `-1` if completed. |
| `status`           | `"in_progress" \| "completed"` | Updated status                                       |
| `forceCompleted`   | `boolean`                      | Always `false` for normal advancement                |
| `createdAt`        | `string`                       | ISO 8601 timestamp of serial creation                |
| `updatedAt`        | `string`                       | ISO 8601 timestamp reflecting the advancement time   |

#### `bypassed[]` — Bypassed step details

Each element describes a step that was skipped over during the advancement.

| Field            | Type                      | Description                                                                                                                                            |
| ---------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `stepId`         | `string`                  | ID of the bypassed step                                                                                                                                |
| `stepName`       | `string`                  | Human-readable name of the bypassed step                                                                                                               |
| `classification` | `"skipped" \| "deferred"` | How the step was classified. `skipped` = optional or overridden (no further action needed). `deferred` = required (must be completed or waived later). |

### 400 Bad Request

Returned when the advancement cannot be performed due to validation failures.

| Condition                                                                            | Message                                                                   |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Serial status is `scrapped`                                                          | `"Cannot advance a scrapped serial"`                                      |
| Serial status is `completed`                                                         | `"Cannot advance a completed serial"`                                     |
| `targetStepIndex` is at or before current position                                   | `"Cannot advance to a step at or before the current position"`            |
| `targetStepIndex` exceeds total steps + 1                                            | `"Target step index is out of range"`                                     |
| Path is in `strict` mode and target is not N+1                                       | `"Path is in strict mode — can only advance to the next sequential step"` |
| Intermediate step has `physical` dependency and is not optional/overridden/completed | `"Cannot skip step with physical dependency"`                             |

### 404 Not Found

Returned when the serial or its path does not exist.

| Condition                                | Message                      |
| ---------------------------------------- | ---------------------------- |
| Serial does not exist                    | `"Serial not found: {id}"`   |
| Path referenced by serial does not exist | `"Path not found: {pathId}"` |

### 500 Internal Server Error

Returned if an unhandled error occurs during advancement.

| Condition                    | Message                   |
| ---------------------------- | ------------------------- |
| Database write failure       | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request — Advance from step 0 to step 3

```bash
curl -X POST http://localhost:3000/api/serials/SN-00001/advance-to \
  -H "Content-Type: application/json" \
  -d '{
    "targetStepIndex": 3,
    "userId": "user_op1"
  }'
```

### Response — With bypassed steps

```json
{
  "serial": {
    "id": "SN-00001",
    "jobId": "job_abc123",
    "pathId": "path_xyz789",
    "currentStepIndex": 3,
    "status": "in_progress",
    "forceCompleted": false,
    "createdAt": "2024-01-15T11:00:00.000Z",
    "updatedAt": "2024-01-15T16:00:00.000Z"
  },
  "bypassed": [
    {
      "stepId": "step_002",
      "stepName": "Optional QC Check",
      "classification": "skipped"
    },
    {
      "stepId": "step_003",
      "stepName": "Coating",
      "classification": "deferred"
    }
  ]
}
```

### Request — Advance to completion (past last step)

For a path with 4 steps (indices 0-3), set `targetStepIndex: 4` to complete:

```bash
curl -X POST http://localhost:3000/api/serials/SN-00002/advance-to \
  -H "Content-Type: application/json" \
  -d '{
    "targetStepIndex": 4,
    "userId": "user_qc1"
  }'
```

### Response — Serial completed

```json
{
  "serial": {
    "id": "SN-00002",
    "jobId": "job_abc123",
    "pathId": "path_xyz789",
    "currentStepIndex": -1,
    "status": "completed",
    "forceCompleted": false,
    "createdAt": "2024-01-15T11:00:00.000Z",
    "updatedAt": "2024-01-15T17:30:00.000Z"
  },
  "bypassed": []
}
```

### Request — Sequential advance in strict mode

In strict mode, only N+1 is allowed:

```bash
curl -X POST http://localhost:3000/api/serials/SN-00003/advance-to \
  -H "Content-Type: application/json" \
  -d '{
    "targetStepIndex": 1,
    "userId": "user_op1"
  }'
```

## Notes

- **Advancement mode enforcement**: In `strict` mode, only `targetStepIndex === currentStepIndex + 1` is allowed (or completion at `totalSteps`). In `flexible` and `per_step` modes, any forward target is valid subject to dependency constraints.
- **Physical dependency blocking**: Steps with `dependencyType: "physical"` cannot be bypassed unless they are optional, have an active override, or have already been completed. This prevents skipping steps that represent physical prerequisites (e.g. you can't coat a part that hasn't been machined).
- **Step status updates**: The origin step (current position) is marked `completed`. Each bypassed step is marked `skipped` or `deferred`. The destination step is marked `in_progress`. These updates are persisted in the `SnStepStatus` records.
- **Audit trail**: Multiple audit entries may be created in a single call — one `serial_advanced` entry for the overall movement, plus individual `step_skipped` or `step_deferred` entries for each bypassed step.
- **Deferred steps** must be resolved before the serial can be considered truly complete. Use [Complete Deferred Step](/api-docs/serials/complete-deferred) or [Waive Step](/api-docs/serials/waive-step) to resolve them.
- **Override interaction**: Active step overrides cause required steps to be classified as `skipped` instead of `deferred`, since the override effectively makes them optional for that serial.

## Related Endpoints

- [Advance Serial](/api-docs/serials/advance) — Simple next-step advancement
- [Complete Deferred Step](/api-docs/serials/complete-deferred) — Resolve a deferred step
- [Waive Step](/api-docs/serials/waive-step) — Formally waive a deferred step
- [List & Create Overrides](/api-docs/serials/overrides) — Manage step overrides that affect bypass classification
- [Get Step Statuses](/api-docs/serials/step-statuses) — View per-step status after advancement

::
