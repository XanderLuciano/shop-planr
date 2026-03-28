---
title: "Get Audit by Serial"
description: "Retrieve audit trail entries for a specific serial number"
method: "GET"
endpoint: "/api/audit/serial/:id"
service: "auditService"
category: "Audit"
responseType: "AuditEntry[]"
errorCodes: [400, 404]
navigation:
  order: 2
---

# Get Audit by Serial

::endpoint-card{method="GET" path="/api/audit/serial/:id"}

Retrieves all audit trail entries associated with a specific serial number. Useful for tracing the full history of a part through the production process.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Serial number ID |

## Response

Returns an array of `AuditEntry` objects for the serial:

```json
[
  {
    "id": "audit_001",
    "action": "serial_created",
    "userId": "user_abc",
    "timestamp": "2024-01-15T10:00:00Z",
    "serialId": "sn_xyz",
    "jobId": "job_abc123",
    "pathId": "path_xyz",
    "batchQuantity": 10
  },
  {
    "id": "audit_002",
    "action": "serial_advanced",
    "userId": "user_abc",
    "timestamp": "2024-01-15T10:30:00Z",
    "serialId": "sn_xyz",
    "jobId": "job_abc123",
    "fromStepId": "step_001",
    "toStepId": "step_002"
  }
]
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Invalid serial ID format |
| `404` | Serial number not found |

::
