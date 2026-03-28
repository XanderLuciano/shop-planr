---
title: "Batch Attach Certificate"
description: "Attach a certificate to multiple serial numbers at once"
method: "POST"
endpoint: "/api/certs/batch-attach"
service: "certService"
category: "Certs"
requestBody: "BatchAttachCertInput"
responseType: "CertAttachment[]"
errorCodes: [400, 404]
navigation:
  order: 4
---

# Batch Attach Certificate

::endpoint-card{method="POST" path="/api/certs/batch-attach"}

Attaches a certificate to multiple serial numbers in a single operation. Each serial receives a `CertAttachment` record linking it to the certificate at its current process step.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `certId` | `string` | Yes | ID of the certificate to attach |
| `serialIds` | `string[]` | Yes | Array of serial number IDs to attach the cert to |
| `userId` | `string` | Yes | ID of the user performing the attachment |

## Example Request

```json
{
  "certId": "cert_abc123",
  "serialIds": ["sn_001", "sn_002", "sn_003"],
  "userId": "user_xyz"
}
```

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
    "stepId": "step_a",
    "attachedAt": "2024-01-15T10:30:00Z",
    "attachedBy": "user_xyz"
  }
]
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Missing required fields or empty `serialIds` array |
| `404` | Certificate or one or more serial numbers not found |

::
