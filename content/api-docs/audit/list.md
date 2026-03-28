---
title: "List Audit Entries"
description: "Retrieve audit trail entries with optional pagination"
method: "GET"
endpoint: "/api/audit"
service: "auditService"
category: "Audit"
responseType: "AuditEntry[]"
errorCodes: [500]
navigation:
  order: 1
---

# List Audit Entries

::endpoint-card{method="GET" path="/api/audit"}

Retrieves audit trail entries with optional pagination. Returns entries in reverse chronological order (newest first). Each entry represents a single production event with full context — the action type, the user who performed it, when it happened, and references to the affected domain objects.

Use this endpoint to build audit trail dashboards, generate compliance reports, or investigate production events. For serial-specific audit trails, use the [Get Audit by Serial](/api-docs/audit/serial) endpoint instead.

## Request

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | `number` | No | Maximum number of entries to return. If omitted, returns all entries. |
| `offset` | `number` | No | Number of entries to skip before returning results. Use with `limit` for pagination. |

## Response

### 200 OK

Returns an array of `AuditEntry` objects. If no entries exist (or the offset exceeds the total count), returns an empty array `[]`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the audit entry (prefixed with `aud_`) |
| `action` | `AuditAction` | The type of event (see [Action Types](/api-docs/audit#action-types)) |
| `userId` | `string` | The user who performed the action |
| `timestamp` | `string` | ISO 8601 timestamp of when the event occurred |
| `serialId` | `string \| undefined` | The serial number involved, if applicable |
| `certId` | `string \| undefined` | The certificate involved, if applicable |
| `jobId` | `string \| undefined` | The job involved, if applicable |
| `pathId` | `string \| undefined` | The path involved, if applicable |
| `stepId` | `string \| undefined` | The process step involved, if applicable |
| `fromStepId` | `string \| undefined` | The step the serial moved from (for `serial_advanced` events) |
| `toStepId` | `string \| undefined` | The step the serial moved to (for `serial_advanced` events) |
| `batchQuantity` | `number \| undefined` | The number of serials in a batch (for `serial_created` events) |
| `metadata` | `Record<string, unknown> \| undefined` | Action-specific data (e.g., scrap reason, BOM change description) |

### 500 Internal Server Error

Returned if an unhandled error occurs while querying the database.

| Condition | Message |
|-----------|---------|
| Database read failure | `"Internal Server Error"` |

## Examples

### Request — All entries

```bash
curl http://localhost:3000/api/audit
```

### Request — Paginated (first 20 entries)

```bash
curl "http://localhost:3000/api/audit?limit=20&offset=0"
```

### Request — Second page

```bash
curl "http://localhost:3000/api/audit?limit=20&offset=20"
```

### Response — Mixed audit entries

```json
[
  {
    "id": "aud_001",
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
    "id": "aud_002",
    "action": "cert_attached",
    "userId": "user_abc",
    "timestamp": "2024-01-15T10:25:00.000Z",
    "serialId": "sn_xyz",
    "certId": "cert_abc123",
    "stepId": "step_001",
    "jobId": "job_abc123",
    "pathId": "path_xyz"
  },
  {
    "id": "aud_003",
    "action": "serial_created",
    "userId": "user_def",
    "timestamp": "2024-01-15T10:00:00.000Z",
    "jobId": "job_abc123",
    "pathId": "path_xyz",
    "batchQuantity": 10
  },
  {
    "id": "aud_004",
    "action": "serial_scrapped",
    "userId": "user_abc",
    "timestamp": "2024-01-15T09:45:00.000Z",
    "serialId": "sn_bad",
    "jobId": "job_abc123",
    "pathId": "path_xyz",
    "stepId": "step_002",
    "metadata": {
      "reason": "out_of_tolerance",
      "explanation": "Diameter measured 0.003 over spec"
    }
  },
  {
    "id": "aud_005",
    "action": "bom_edited",
    "userId": "user_xyz",
    "timestamp": "2024-01-14T16:00:00.000Z",
    "metadata": {
      "bomId": "bom_abc123",
      "changeDescription": "Increased bolt quantity per engineering review",
      "versionNumber": 2
    }
  }
]
```

### Response — No entries

```json
[]
```

## Notes

- The audit trail is **read-only**. There are no endpoints to create, update, or delete audit entries. Entries are generated automatically by the service layer as side effects of production operations.
- The `limit` and `offset` parameters are parsed from query strings and converted to numbers. Non-numeric values are ignored (treated as if not provided).
- When neither `limit` nor `offset` is provided, the endpoint returns **all** audit entries. For large production environments, always use pagination to avoid oversized responses.
- The fields present on each entry depend on the `action` type. For example, `fromStepId` and `toStepId` are only present on `serial_advanced` entries, while `batchQuantity` is only present on `serial_created` entries.
- The `metadata` field contains action-specific data. For `serial_scrapped` events, it includes `reason` and optionally `explanation`. For `bom_edited` events, it includes `bomId`, `changeDescription`, and `versionNumber`. For `step_waived` events, it includes `reason` and `approverId`.
- Client-side filtering by `action`, `userId`, `serialId`, `jobId`, or date range is recommended for building filtered views. The API does not currently support server-side filtering beyond pagination.

## Related Endpoints

- [Get Audit by Serial](/api-docs/audit/serial) — Get the audit trail for a specific serial number
- [Serials API](/api-docs/serials) — Serial operations that generate audit entries
- [Certificates API](/api-docs/certs) — Certificate operations that generate audit entries
- [BOM API](/api-docs/bom) — BOM edits that generate audit entries

::
