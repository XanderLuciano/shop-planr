---
title: "Get Serial"
description: "Retrieve a single serial number with certificate data"
method: "GET"
endpoint: "/api/serials/:id"
service: "serialService"
category: "Serials"
responseType: "SerialNumber"
errorCodes: [400, 404]
navigation:
  order: 2
---

# Get Serial

::endpoint-card{method="GET" path="/api/serials/:id"}

Retrieves a single serial number by ID, including its associated certificate attachments.

## Response

Returns the `SerialNumber` object enriched with `certs`:

```json
{
  "id": "sn_00001",
  "jobId": "job_abc123",
  "pathId": "path_xyz",
  "currentStepIndex": 1,
  "status": "in_progress",
  "forceCompleted": false,
  "createdAt": "2024-01-15T11:00:00Z",
  "updatedAt": "2024-01-15T14:00:00Z",
  "certs": [
    {
      "id": "cert_mat01",
      "type": "material",
      "name": "Steel Grade A Cert",
      "createdAt": "2024-01-10T08:00:00Z"
    }
  ]
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error |
| `404` | Serial not found |

::
