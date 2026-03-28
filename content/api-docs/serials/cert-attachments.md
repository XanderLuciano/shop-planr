---
title: "Get Cert Attachments"
description: "Retrieve all certificate attachments for a serial number"
method: "GET"
endpoint: "/api/serials/:id/cert-attachments"
service: "certService"
category: "Serials"
responseType: "CertAttachment[]"
errorCodes: [400]
navigation:
  order: 9
---

# Get Cert Attachments

::endpoint-card{method="GET" path="/api/serials/:id/cert-attachments"}

Retrieves all certificate attachments for a serial number, showing which certificates were attached at which process steps.

## Response

Returns an array of `CertAttachment` objects:

```json
[
  {
    "id": "ca_001",
    "serialId": "sn_00001",
    "certId": "cert_mat01",
    "stepId": "step_001",
    "attachedAt": "2024-01-15T11:30:00Z",
    "attachedBy": "user_01"
  },
  {
    "id": "ca_002",
    "serialId": "sn_00001",
    "certId": "cert_proc01",
    "stepId": "step_002",
    "attachedAt": "2024-01-15T14:30:00Z",
    "attachedBy": "user_02"
  }
]
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Serial ID is required |

::
