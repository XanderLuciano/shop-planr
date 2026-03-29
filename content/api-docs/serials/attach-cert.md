---
title: 'Attach Certificate'
description: 'Attach a certificate to a serial number at its current process step'
method: 'POST'
endpoint: '/api/serials/:id/attach-cert'
service: 'certService'
category: 'Serials'
requestBody: 'AttachCertInput'
responseType: 'CertAttachment'
errorCodes: [400, 404, 500]
navigation:
  order: 8
---

# Attach Certificate

::endpoint-card{method="POST" path="/api/serials/:id/attach-cert"}

Attaches a certificate to a serial number at its current process step. This creates a `CertAttachment` record that links the certificate to the serial at a specific point in the manufacturing process, establishing a traceable chain of custody for quality documentation.

The attachment is **idempotent** — if the same certificate is already attached to the same serial at the same step, the existing attachment is returned without creating a duplicate. This allows safe retries without worrying about duplicate records.

The serial must be in `in_progress` status (i.e. not completed or scrapped) because the attachment is recorded against the serial's **current** step. Completed serials have `currentStepIndex: -1` and no valid step to attach to.

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                                    |
| --------- | -------- | -------- | -------------------------------------------------------------- |
| `id`      | `string` | Yes      | The unique identifier of the serial number (e.g. `"SN-00001"`) |

### Request Body

| Field    | Type     | Required | Description                                                                                         |
| -------- | -------- | -------- | --------------------------------------------------------------------------------------------------- |
| `certId` | `string` | Yes      | ID of the certificate to attach. The certificate must exist in the system.                          |
| `userId` | `string` | Yes      | ID of the user performing the attachment. Recorded on the attachment record and in the audit trail. |

## Response

### 200 OK

Returned when the certificate is successfully attached (or was already attached — idempotent). The response contains the `CertAttachment` record.

| Field        | Type     | Description                                                                                         |
| ------------ | -------- | --------------------------------------------------------------------------------------------------- |
| `id`         | `string` | Unique identifier for the attachment record                                                         |
| `serialId`   | `string` | ID of the serial number the certificate is attached to                                              |
| `certId`     | `string` | ID of the attached certificate                                                                      |
| `stepId`     | `string` | ID of the process step where the attachment occurred (the serial's current step at attachment time) |
| `attachedAt` | `string` | ISO 8601 timestamp of when the attachment was created                                               |
| `attachedBy` | `string` | User ID of who performed the attachment                                                             |

### 400 Bad Request

Returned when the attachment cannot be performed due to validation failures.

| Condition                                    | Message                                             |
| -------------------------------------------- | --------------------------------------------------- |
| Serial is completed (`currentStepIndex: -1`) | `"Serial is already completed, cannot attach cert"` |
| `certId` is missing or invalid               | Varies — describes the specific validation issue    |

### 404 Not Found

Returned when the serial, its path, or the certificate does not exist.

| Condition                                | Message                             |
| ---------------------------------------- | ----------------------------------- |
| Serial does not exist                    | `"SerialNumber not found: {id}"`    |
| Path referenced by serial does not exist | `"Path not found: {pathId}"`        |
| Certificate does not exist               | `"Certificate not found: {certId}"` |

### 500 Internal Server Error

Returned if an unhandled error occurs during the attachment operation.

| Condition                    | Message                   |
| ---------------------------- | ------------------------- |
| Database write failure       | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request — Attach a material certificate

```bash
curl -X POST http://localhost:3000/api/serials/SN-00001/attach-cert \
  -H "Content-Type: application/json" \
  -d '{
    "certId": "cert_mat01",
    "userId": "user_op1"
  }'
```

### Response — Successful attachment

```json
{
  "id": "ca_001",
  "serialId": "SN-00001",
  "certId": "cert_mat01",
  "stepId": "step_002",
  "attachedAt": "2024-01-15T14:30:00.000Z",
  "attachedBy": "user_op1"
}
```

### Request — Idempotent re-attachment

Attaching the same certificate again at the same step returns the existing record:

```bash
curl -X POST http://localhost:3000/api/serials/SN-00001/attach-cert \
  -H "Content-Type: application/json" \
  -d '{
    "certId": "cert_mat01",
    "userId": "user_op1"
  }'
```

### Response — Existing attachment returned

```json
{
  "id": "ca_001",
  "serialId": "SN-00001",
  "certId": "cert_mat01",
  "stepId": "step_002",
  "attachedAt": "2024-01-15T14:30:00.000Z",
  "attachedBy": "user_op1"
}
```

## Notes

- The attachment is recorded against the serial's **current step** at the time of the API call. The step ID is resolved server-side from the serial's `currentStepIndex` and the path's step array. You cannot specify a different step.
- **Idempotency** is enforced via a UNIQUE constraint on `(serialId, certId, stepId)`. If the same combination already exists, the existing record is returned without creating a duplicate or raising an error.
- An audit trail entry of type `cert_attached` is created for each new attachment, capturing the user, serial, certificate, job, path, and step. Idempotent re-attachments do not create duplicate audit entries.
- Certificates can be attached at **any step** during the serial's journey — simply call this endpoint whenever the serial is at the desired step. For batch attachment at creation time, use the `certId` parameter on [Batch Create Serials](/api-docs/serials/create).
- The same certificate can be attached to the same serial at **different steps** (e.g. a process cert re-verified at multiple stages). Each step produces a separate attachment record.
- Scrapped serials can still have certificates attached if they haven't been completed (they retain their `currentStepIndex`). However, this is an unusual workflow.

## Related Endpoints

- [Get Cert Attachments](/api-docs/serials/cert-attachments) — List all certificate attachments for a serial
- [Get Serial](/api-docs/serials/get) — View the serial with its certificate data
- [Batch Create Serials](/api-docs/serials/create) — Auto-attach a cert during batch creation
- [Create Certificate](/api-docs/certs/create) — Create a certificate before attaching it

::
