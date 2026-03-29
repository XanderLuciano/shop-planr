---
title: 'Get Certificate Attachments'
description: 'Retrieve all attachment records for a specific certificate'
method: 'GET'
endpoint: '/api/certs/:id/attachments'
service: 'certService'
category: 'Certs'
responseType: 'CertAttachment[]'
errorCodes: [404, 500]
navigation:
  order: 5
---

# Get Certificate Attachments

::endpoint-card{method="GET" path="/api/certs/:id/attachments"}

Retrieves all attachment records for a specific certificate. Each record shows which serial number has this certificate attached, at which process step the attachment was made, when it happened, and who performed it.

This endpoint is useful for auditing certificate coverage — for example, verifying that every serial in a production batch has a required material certification attached, or reviewing which process steps a particular certification was recorded at.

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                                     |
| --------- | -------- | -------- | --------------------------------------------------------------- |
| `id`      | `string` | Yes      | The unique identifier of the certificate (e.g. `"cert_abc123"`) |

## Response

### 200 OK

Returns an array of `CertAttachment` objects for the specified certificate. If the certificate exists but has no attachments, returns an empty array `[]`.

| Field        | Type                  | Description                                           |
| ------------ | --------------------- | ----------------------------------------------------- |
| `id`         | `string \| undefined` | Server-generated attachment ID, if assigned           |
| `serialId`   | `string`              | The serial number this attachment belongs to          |
| `certId`     | `string`              | The certificate ID (matches the path parameter)       |
| `stepId`     | `string`              | The process step ID where the attachment was recorded |
| `attachedAt` | `string`              | ISO 8601 timestamp of when the attachment was created |
| `attachedBy` | `string`              | The user ID who performed the attachment              |

### 404 Not Found

Returned when no certificate exists with the given ID.

| Condition                  | Message                                |
| -------------------------- | -------------------------------------- |
| Certificate does not exist | `"Certificate not found: cert_abc123"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while querying the database.

| Condition             | Message                   |
| --------------------- | ------------------------- |
| Database read failure | `"Internal Server Error"` |

## Examples

### Request

```bash
curl http://localhost:3000/api/certs/cert_abc123/attachments
```

### Response — Multiple attachments across different steps

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
    "serialId": "sn_005",
    "certId": "cert_abc123",
    "stepId": "step_b2",
    "attachedAt": "2024-01-16T08:00:00.000Z",
    "attachedBy": "user_abc"
  }
]
```

### Response — No attachments

```json
[]
```

## Notes

- This endpoint returns attachments for a single certificate across all serials. To see all certificates attached to a single serial, use the serial detail endpoint instead.
- The `stepId` in each attachment record indicates where in the manufacturing route the certificate was attached. Different serials may have the same certificate attached at different steps if they were at different points in the route when the attachment was made.
- Attachments are immutable — once created, they cannot be modified or deleted. This ensures the audit trail remains intact.
- The response is not paginated. For certificates attached to a very large number of serials, the response may be large.

## Related Endpoints

- [Get Certificate](/api-docs/certs/get) — Retrieve the certificate's own details
- [Batch Attach Certificate](/api-docs/certs/batch-attach) — Attach this certificate to additional serials
- [Get Audit by Serial](/api-docs/audit/serial) — View the full audit trail for a specific serial, including cert attachments
- [List Certificates](/api-docs/certs/list) — Browse all certificates

::
