---
title: "Get Certificate Attachments"
description: "Retrieve all attachments for a specific certificate"
method: "GET"
endpoint: "/api/certs/:id/attachments"
service: "certService"
category: "Certs"
responseType: "CertAttachment[]"
errorCodes: [400, 404]
navigation:
  order: 5
---

# Get Certificate Attachments

::endpoint-card{method="GET" path="/api/certs/:id/attachments"}

Retrieves all attachment records for a specific certificate, showing which serial numbers have this certificate attached and at which process step.

## Response

Returns an array of `CertAttachment` objects:

```json
[
  {
    "id": "ca_001",
    "serialId": "sn_001",
    "certId": "cert_abc123",
    "stepId": "step_a",
    "attachedAt": "2024-01-15T10:30:00Z",
    "attachedBy": "user_xyz"
  },
  {
    "id": "ca_002",
    "serialId": "sn_002",
    "certId": "cert_abc123",
    "stepId": "step_b",
    "attachedAt": "2024-01-16T08:00:00Z",
    "attachedBy": "user_xyz"
  }
]
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error |
| `404` | Certificate not found |

::
