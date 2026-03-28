---
title: "Batch Create Serials"
description: "Create multiple serial numbers for a job path in a single batch"
method: "POST"
endpoint: "/api/serials"
service: "serialService"
category: "Serials"
requestBody: "BatchCreateSerialsInput"
responseType: "SerialNumber[]"
errorCodes: [400, 404]
navigation:
  order: 3
---

# Batch Create Serials

::endpoint-card{method="POST" path="/api/serials"}

Creates multiple serial numbers in a single batch for a given job and path. Serial numbers are assigned sequential identifiers (e.g. `SN-00001`, `SN-00002`).

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jobId` | `string` | Yes | ID of the parent job |
| `pathId` | `string` | Yes | ID of the routing path |
| `quantity` | `number` | Yes | Number of serials to create |
| `certId` | `string` | No | Certificate to auto-attach to all created serials |

## Example Request

```json
{
  "jobId": "job_abc123",
  "pathId": "path_xyz",
  "quantity": 10
}
```

## Response

Returns an array of created `SerialNumber` objects:

```json
[
  {
    "id": "sn_00001",
    "jobId": "job_abc123",
    "pathId": "path_xyz",
    "currentStepIndex": 0,
    "status": "in_progress",
    "forceCompleted": false,
    "createdAt": "2024-01-15T11:00:00Z",
    "updatedAt": "2024-01-15T11:00:00Z"
  }
]
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Missing required fields, `quantity <= 0`, or invalid `certId` |
| `404` | Job or path not found |

::
