---
title: "Batch Attach Certificate"
description: "Attach a certificate to multiple serial numbers in a single operation"
method: "POST"
endpoint: "/api/certs/batch-attach"
service: "certService"
category: "Certs"
requestBody: "BatchAttachCertInput"
responseType: "CertAttachment[]"
errorCodes: [400, 404, 500]
navigation:
  order: 4
---

# Batch Attach Certificate

::endpoint-card{method="POST" path="/api/certs/batch-attach"}

Attaches a certificate to multiple serial numbers in a single operation. For each serial in the `serialIds` array, a `CertAttachment` record is created linking the certificate to that serial. This is the primary mechanism for recording that a quality certification has been verified against a batch of parts.

Each attachment is also recorded in the audit trail as a `cert_attached` event, providing full traceability of when and by whom each certificate was attached.

The attachment is recorded against the serial's current process step at the time of the call. If a serial has already been advanced past the step where the cert logically applies, the attachment will still be created — but it will reference the serial's current step position, not a historical one.

## Request

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `certId` | `string` | Yes | The unique identifier of the certificate to attach (e.g. `"cert_abc123"`). Must reference an existing certificate. |
| `serialIds` | `string[]` | Yes | An array of serial number IDs to attach the certificate to. Must contain at least one ID. |
| `userId` | `string` | Yes | The ID of the user performing the attachment. Recorded in the `CertAttachment` and the audit trail. |

## Response

### 200 OK

Returned when all attachments are successfully created. The response contains an array of `CertAttachment` objects — one for each serial in the request.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string \| undefined` | Server-generated attachment ID, if assigned by the repository |
| `serialId` | `string` | The serial number this attachment belongs to |
| `certId` | `string` | The certificate that was attached |
| `stepId` | `string` | The process step ID where the attachment was recorded |
| `attachedAt` | `string` | ISO 8601 timestamp of when the attachment was created |
| `attachedBy` | `string` | The user ID who performed the attachment |

### 400 Bad Request

Returned when the request body fails validation.

| Condition | Message |
|-----------|---------|
| `certId` is missing or empty | `"certId is required"` |
| `serialIds` is missing or empty array | `"serialIds must have at least one item"` |
| `userId` is missing or empty | `"userId is required"` |

### 404 Not Found

Returned when the referenced certificate does not exist.

| Condition | Message |
|-----------|---------|
| Certificate does not exist | `"Certificate not found: cert_abc123"` |

### 500 Internal Server Error

Returned if an unhandled error occurs during the batch operation.

| Condition | Message |
|-----------|---------|
| Database write failure | `"Internal Server Error"` |

## Examples

### Request — Attach to three serials

```bash
curl -X POST http://localhost:3000/api/certs/batch-attach \
  -H "Content-Type: application/json" \
  -d '{
    "certId": "cert_abc123",
    "serialIds": ["sn_001", "sn_002", "sn_003"],
    "userId": "user_xyz"
  }'
```

### Response — Three attachments created

```json
[
  {
    "id": "ca_001",
    "serialId": "sn_001",
    "certId": "cert_abc123",
    "stepId": "step_a1",
    "attachedAt": "2024-01-15T10:30:00.000Z",
    "attachedBy": "user_xyz"
  },
  {
    "id": "ca_002",
    "serialId": "sn_002",
    "certId": "cert_abc123",
    "stepId": "step_a1",
    "attachedAt": "2024-01-15T10:30:00.000Z",
    "attachedBy": "user_xyz"
  },
  {
    "id": "ca_003",
    "serialId": "sn_003",
    "certId": "cert_abc123",
    "stepId": "step_b2",
    "attachedAt": "2024-01-15T10:30:00.000Z",
    "attachedBy": "user_xyz"
  }
]
```

### Request — Single serial attachment

```bash
curl -X POST http://localhost:3000/api/certs/batch-attach \
  -H "Content-Type: application/json" \
  -d '{
    "certId": "cert_def456",
    "serialIds": ["sn_004"],
    "userId": "user_abc"
  }'
```

### Response — Single attachment

```json
[
  {
    "id": "ca_004",
    "serialId": "sn_004",
    "certId": "cert_def456",
    "stepId": "step_c3",
    "attachedAt": "2024-01-15T11:00:00.000Z",
    "attachedBy": "user_abc"
  }
]
```

## Notes

- Attachments are **idempotent**. The `cert_attachments` table has a UNIQUE constraint on `(serialId, certId, stepId)`. If a certificate is already attached to a serial at the same step, the existing record is returned rather than creating a duplicate.
- Each successful attachment generates a `cert_attached` audit entry via the [Audit API](/api-docs/audit). The audit entry includes the `userId`, `serialId`, `certId`, and `stepId`.
- The `stepId` on each attachment reflects the serial's current step at the time of the call. Serials at different steps in the same batch will have different `stepId` values in their attachment records.
- The `userId` field is not validated against the users table — any non-empty string is accepted. This supports kiosk-mode workflows where user identity is self-reported.
- If any serial ID in the array does not exist, the behavior depends on the repository implementation. The operation may partially succeed or fail entirely.

## Related Endpoints

- [Create Certificate](/api-docs/certs/create) — Create a certificate before attaching it
- [Get Certificate Attachments](/api-docs/certs/attachments) — List all serials that have a given certificate
- [List Audit Entries](/api-docs/audit/list) — Query `cert_attached` events in the audit trail
- [Get Serial](/api-docs/serials/get) — View a serial's attached certificates

::
