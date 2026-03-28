---
title: "List Audit Entries"
description: "Retrieve audit trail entries with optional filters"
method: "GET"
endpoint: "/api/audit"
service: "auditService"
category: "Audit"
responseType: "AuditEntry[]"
errorCodes: [400]
navigation:
  order: 1
---

# List Audit Entries

::endpoint-card{method="GET" path="/api/audit"}

Retrieves audit trail entries. Supports query filters to narrow results by action type, user, serial, job, or date range.

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | `AuditAction` | No | Filter by action type (e.g. `serial_created`, `cert_attached`) |
| `userId` | `string` | No | Filter by user who performed the action |
| `serialId` | `string` | No | Filter by serial number ID |
| `jobId` | `string` | No | Filter by job ID |
| `startDate` | `string` | No | ISO date string — return entries after this date |
| `endDate` | `string` | No | ISO date string — return entries before this date |

## Response

Returns an array of `AuditEntry` objects:

```json
[
  {
    "id": "audit_001",
    "action": "serial_advanced",
    "userId": "user_abc",
    "timestamp": "2024-01-15T10:30:00Z",
    "serialId": "sn_xyz",
    "jobId": "job_abc123",
    "pathId": "path_xyz",
    "stepId": "step_001",
    "fromStepId": "step_001",
    "toStepId": "step_002"
  }
]
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Invalid filter parameters |

::
