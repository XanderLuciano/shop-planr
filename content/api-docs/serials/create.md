---
title: 'Batch Create Serials'
description: 'Create multiple serial numbers for a job path in a single batch operation'
method: 'POST'
endpoint: '/api/serials'
service: 'serialService'
category: 'Serials'
requestBody: 'BatchCreateSerialsInput'
responseType: 'SerialNumber[]'
errorCodes: [400, 404, 500]
navigation:
  order: 3
---

# Batch Create Serials

::endpoint-card{method="POST" path="/api/serials"}

Creates multiple serial numbers in a single batch for a given job and path. Serial numbers are assigned sequential identifiers from a persistent counter (e.g. `SN-00001`, `SN-00002`), ensuring uniqueness across the entire system. Each created serial starts at step index `0` with status `in_progress`. The system initializes per-step status records for every step in the path. Optionally, provide a `certId` to auto-attach a certificate to every serial at the first step.

## Request

### Request Body

| Field      | Type     | Required | Description                                                              |
| ---------- | -------- | -------- | ------------------------------------------------------------------------ |
| `jobId`    | `string` | Yes      | ID of the parent job. Must exist.                                        |
| `pathId`   | `string` | Yes      | ID of the manufacturing path. Must exist with at least one step.         |
| `quantity` | `number` | Yes      | Number of serials to create. Must be a positive integer.                 |
| `certId`   | `string` | No       | Certificate ID to auto-attach at the first step. Must exist if provided. |

## Response

### 201 Created

Array of `SerialNumber` objects, one per created serial.

| Field              | Type            | Description                               |
| ------------------ | --------------- | ----------------------------------------- |
| `id`               | `string`        | Sequential identifier (e.g. `"SN-00001"`) |
| `jobId`            | `string`        | Parent job ID                             |
| `pathId`           | `string`        | Manufacturing path ID                     |
| `currentStepIndex` | `number`        | Always `0` for new serials                |
| `status`           | `"in_progress"` | Always `"in_progress"`                    |
| `forceCompleted`   | `boolean`       | Always `false`                            |
| `createdAt`        | `string`        | ISO 8601 creation timestamp               |
| `updatedAt`        | `string`        | Same as `createdAt` for new serials       |

### 400 Bad Request

Returned when the request body fails validation.

| Condition                                        | Message                             |
| ------------------------------------------------ | ----------------------------------- |
| `quantity` is missing or not a number            | `"quantity is required"`            |
| `quantity` is zero or negative                   | `"quantity must be greater than 0"` |
| Path has no steps defined                        | `"path.steps must not be empty"`    |
| `certId` provided but certificate does not exist | `"Certificate not found: {certId}"` |

### 404 Not Found

| Condition           | Message                      |
| ------------------- | ---------------------------- |
| Path does not exist | `"Path not found: {pathId}"` |

### 500 Internal Server Error

| Condition                 | Message                   |
| ------------------------- | ------------------------- |
| Database write failure    | `"Internal Server Error"` |
| Counter increment failure | `"Internal Server Error"` |

## Examples

### Request — Basic batch creation

```bash
curl -X POST http://localhost:3000/api/serials \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job_abc123",
    "pathId": "path_xyz789",
    "quantity": 3
  }'
```

### Response — Basic batch

```json
[
  {
    "id": "SN-00001",
    "jobId": "job_abc123",
    "pathId": "path_xyz789",
    "currentStepIndex": 0,
    "status": "in_progress",
    "forceCompleted": false,
    "createdAt": "2024-01-15T11:00:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  },
  {
    "id": "SN-00002",
    "jobId": "job_abc123",
    "pathId": "path_xyz789",
    "currentStepIndex": 0,
    "status": "in_progress",
    "forceCompleted": false,
    "createdAt": "2024-01-15T11:00:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  },
  {
    "id": "SN-00003",
    "jobId": "job_abc123",
    "pathId": "path_xyz789",
    "currentStepIndex": 0,
    "status": "in_progress",
    "forceCompleted": false,
    "createdAt": "2024-01-15T11:00:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
]
```

### Request — Batch with auto-attached certificate

```bash
curl -X POST http://localhost:3000/api/serials \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job_abc123",
    "pathId": "path_xyz789",
    "quantity": 10,
    "certId": "cert_mat01"
  }'
```

### Response — Batch with certificate (same shape)

The response shape is identical — certificate attachments are created as a side effect but are not reflected in the `SerialNumber` response. Use [Get Cert Attachments](/api-docs/serials/cert-attachments) to verify the attachment.

## Notes

- Serial identifiers are **globally sequential** across the entire system. If the last created serial was `SN-00050`, the next batch starts at `SN-00051` regardless of job or path. The counter is persisted in the database and survives server restarts.
- The `certId` parameter triggers automatic certificate attachment to **all** serials in the batch at the **first step** (step index 0). For step-specific cert attachments, use the [Attach Certificate](/api-docs/serials/attach-cert) endpoint after advancing the serial.
- An audit trail entry of type `serial_created` is recorded for the batch, capturing the `userId`, `jobId`, `pathId`, and `batchQuantity`. Individual serial IDs are not recorded in the batch audit entry.
- Step status initialization happens atomically with serial creation. If the path has 5 steps, each serial will have 5 `SnStepStatus` records: step 0 as `in_progress`, steps 1-4 as `pending`.
- There is no upper limit on `quantity` enforced by the API. The path's `goalQuantity` is not enforced — you can create more serials than the goal.
- The `userId` field in the request body (if provided) is used for audit tracking. If omitted, it defaults to `"anonymous"`.

## Related Endpoints

- [Advance Serial](/api-docs/serials/advance) — Move a serial to the next step
- [Advance to Step](/api-docs/serials/advance-to) — Jump a serial to a specific step
- [Attach Certificate](/api-docs/serials/attach-cert) — Attach a cert to a serial at its current step
- [Get Step Statuses](/api-docs/serials/step-statuses) — Verify step status initialization
- [Create Path](/api-docs/paths/create) — Define the manufacturing route before creating serials

::
