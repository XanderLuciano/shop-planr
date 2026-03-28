---
title: "Attach Certificate"
description: "Attach a certificate to a serial number at its current step"
method: "POST"
endpoint: "/api/serials/:id/attach-cert"
service: "certService"
category: "Serials"
requestBody: "AttachCertInput"
responseType: "CertAttachment"
errorCodes: [400, 404]
navigation:
  order: 8
---

# Attach Certificate

::endpoint-card{method="POST" path="/api/serials/:id/attach-cert"}

Attaches a certificate to a serial number at its current process step. The attachment is idempotent — re-attaching the same certificate at the same step is a no-op. An audit trail entry is created.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `certId` | `string` | Yes | ID of the certificate to attach |
| `userId` | `string` | Yes | ID of the user performing the attachment |

## Example Request

```json
{
  "certId": "cert_mat01",
  "userId": "user_01"
}
```

## Response

Returns the `CertAttachment` record:

```json
{
  "id": "ca_001",
  "serialId": "sn_00001",
  "certId": "cert_mat01",
  "stepId": "step_002",
  "attachedAt": "2024-01-15T14:30:00Z",
  "attachedBy": "user_01"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Serial is already completed (no current step), or invalid cert ID |
| `404` | Serial or certificate not found |

::
