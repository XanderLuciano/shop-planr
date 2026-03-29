---
title: 'Get Audit by Serial'
description: 'Retrieve the complete audit trail for a specific serial number'
method: 'GET'
endpoint: '/api/audit/serial/:id'
service: 'auditService'
category: 'Audit'
responseType: 'AuditEntry[]'
errorCodes: [500]
navigation:
  order: 2
---

# Get Audit by Serial

::endpoint-card{method="GET" path="/api/audit/serial/:id"}

Retrieves all audit trail entries associated with a specific serial number. This provides a complete chronological history of everything that has happened to a part — from creation through every step advancement, certificate attachment, lifecycle event, and note.

This is the primary endpoint for part traceability. Use it to display a serial's full history on the part detail page, generate traceability reports for quality audits, or investigate production issues by reviewing the sequence of events for a specific unit.

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                                                  |
| --------- | -------- | -------- | ---------------------------------------------------------------------------- |
| `id`      | `string` | Yes      | The unique identifier of the serial number (e.g. `"sn_xyz"` or `"SN-00042"`) |

## Response

### 200 OK

Returns an array of `AuditEntry` objects for the specified serial, ordered chronologically. If no audit entries exist for the serial, returns an empty array `[]`.

| Field           | Type                                   | Description                                                          |
| --------------- | -------------------------------------- | -------------------------------------------------------------------- |
| `id`            | `string`                               | Unique identifier for the audit entry (prefixed with `aud_`)         |
| `action`        | `AuditAction`                          | The type of event (see [Action Types](/api-docs/audit#action-types)) |
| `userId`        | `string`                               | The user who performed the action                                    |
| `timestamp`     | `string`                               | ISO 8601 timestamp of when the event occurred                        |
| `serialId`      | `string \| undefined`                  | The serial number ID (matches the path parameter for most entries)   |
| `certId`        | `string \| undefined`                  | The certificate involved, if applicable                              |
| `jobId`         | `string \| undefined`                  | The job this serial belongs to                                       |
| `pathId`        | `string \| undefined`                  | The path this serial is routing through                              |
| `stepId`        | `string \| undefined`                  | The process step involved, if applicable                             |
| `fromStepId`    | `string \| undefined`                  | The step the serial moved from (for advancement events)              |
| `toStepId`      | `string \| undefined`                  | The step the serial moved to (for advancement events)                |
| `batchQuantity` | `number \| undefined`                  | Batch size (for `serial_created` events)                             |
| `metadata`      | `Record<string, unknown> \| undefined` | Action-specific data                                                 |

### 500 Internal Server Error

Returned if an unhandled error occurs while querying the database.

| Condition             | Message                   |
| --------------------- | ------------------------- |
| Database read failure | `"Internal Server Error"` |

## Examples

### Request

```bash
curl http://localhost:3000/api/audit/serial/sn_xyz
```

### Response — Full serial lifecycle

```json
[
  {
    "id": "aud_001",
    "action": "serial_created",
    "userId": "user_def",
    "timestamp": "2024-01-15T10:00:00.000Z",
    "jobId": "job_abc123",
    "pathId": "path_xyz",
    "batchQuantity": 10
  },
  {
    "id": "aud_002",
    "action": "cert_attached",
    "userId": "user_abc",
    "timestamp": "2024-01-15T10:15:00.000Z",
    "serialId": "sn_xyz",
    "certId": "cert_mat001",
    "stepId": "step_001",
    "jobId": "job_abc123",
    "pathId": "path_xyz"
  },
  {
    "id": "aud_003",
    "action": "serial_advanced",
    "userId": "user_abc",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "serialId": "sn_xyz",
    "jobId": "job_abc123",
    "pathId": "path_xyz",
    "fromStepId": "step_001",
    "toStepId": "step_002"
  },
  {
    "id": "aud_004",
    "action": "step_deferred",
    "userId": "user_abc",
    "timestamp": "2024-01-15T11:00:00.000Z",
    "serialId": "sn_xyz",
    "jobId": "job_abc123",
    "pathId": "path_xyz",
    "stepId": "step_003"
  },
  {
    "id": "aud_005",
    "action": "serial_advanced",
    "userId": "user_abc",
    "timestamp": "2024-01-15T11:00:00.000Z",
    "serialId": "sn_xyz",
    "jobId": "job_abc123",
    "pathId": "path_xyz",
    "fromStepId": "step_002",
    "toStepId": "step_004"
  },
  {
    "id": "aud_006",
    "action": "serial_completed",
    "userId": "user_abc",
    "timestamp": "2024-01-15T14:00:00.000Z",
    "serialId": "sn_xyz",
    "jobId": "job_abc123",
    "pathId": "path_xyz",
    "fromStepId": "step_004"
  },
  {
    "id": "aud_007",
    "action": "deferred_step_completed",
    "userId": "user_ghi",
    "timestamp": "2024-01-16T09:00:00.000Z",
    "serialId": "sn_xyz",
    "jobId": "job_abc123",
    "pathId": "path_xyz",
    "stepId": "step_003"
  }
]
```

### Response — Scrapped serial

```json
[
  {
    "id": "aud_010",
    "action": "serial_created",
    "userId": "user_def",
    "timestamp": "2024-01-15T10:00:00.000Z",
    "jobId": "job_abc123",
    "pathId": "path_xyz",
    "batchQuantity": 10
  },
  {
    "id": "aud_011",
    "action": "serial_advanced",
    "userId": "user_abc",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "serialId": "sn_bad",
    "fromStepId": "step_001",
    "toStepId": "step_002"
  },
  {
    "id": "aud_012",
    "action": "serial_scrapped",
    "userId": "user_abc",
    "timestamp": "2024-01-15T11:00:00.000Z",
    "serialId": "sn_bad",
    "jobId": "job_abc123",
    "pathId": "path_xyz",
    "stepId": "step_002",
    "metadata": {
      "reason": "out_of_tolerance",
      "explanation": "Diameter measured 0.003 over spec on CMM check"
    }
  }
]
```

### Response — No audit entries

```json
[]
```

## Notes

- This endpoint queries by `serialId` across all audit entries. It returns entries where the `serialId` field matches the provided ID.
- The `serial_created` event may not have a `serialId` field set (it records the batch creation, not individual serials). It will still appear in the results if the repository implementation associates it with the serial.
- An empty response `[]` does not necessarily mean the serial doesn't exist — it may simply have no audit entries yet. The endpoint does not validate that the serial ID references an existing serial.
- The response is not paginated. For serials with a very long history (hundreds of events), the response may be large. In practice, most serials have a manageable number of events (creation + N step advancements + completion).
- The `metadata` field varies by action type:
  - `serial_scrapped`: `{ reason: string, explanation?: string }`
  - `serial_force_completed`: `{ reason?: string, incompleteStepIds: string[] }`
  - `step_waived`: `{ reason: string, approverId: string }`
  - `step_override_created`: `{ reason?: string }`
  - `bom_edited`: `{ bomId: string, changeDescription: string, versionNumber: number }`

## Related Endpoints

- [List Audit Entries](/api-docs/audit/list) — Browse the full audit trail with pagination
- [Get Serial](/api-docs/serials/get) — View the serial's current state and routing information
- [Get Certificate Attachments](/api-docs/certs/attachments) — See certificate attachment records

::
