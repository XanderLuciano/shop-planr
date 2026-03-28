---
title: "Get Cert Attachments"
description: "Retrieve all certificate attachments for a serial number with step-level detail"
method: "GET"
endpoint: "/api/serials/:id/cert-attachments"
service: "certService"
category: "Serials"
responseType: "CertAttachment[]"
errorCodes: [400, 500]
navigation:
  order: 9
---

# Get Cert Attachments

::endpoint-card{method="GET" path="/api/serials/:id/cert-attachments"}

Retrieves all certificate attachment records for a serial number. Each record shows which certificate was attached, at which process step, by whom, and when. This provides the full chain of custody for quality documentation associated with a specific unit.

Unlike the [Get Serial](/api-docs/serials/get) endpoint (which returns full `Certificate` objects in its `certs` array), this endpoint returns `CertAttachment` records that include step-level detail — specifically the `stepId` where each attachment occurred. Use this endpoint when you need to know **where** in the manufacturing process each certificate was attached.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The unique identifier of the serial number (e.g. `"SN-00001"`) |

## Response

### 200 OK

Returned when the request is successful. The response is always an array, even if no attachments exist (empty array `[]`).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the attachment record |
| `serialId` | `string` | ID of the serial number |
| `certId` | `string` | ID of the attached certificate |
| `stepId` | `string` | ID of the process step where the certificate was attached |
| `attachedAt` | `string` | ISO 8601 timestamp of when the attachment was created |
| `attachedBy` | `string` | User ID of who performed the attachment |

### 400 Bad Request

Returned if the serial ID parameter is missing.

| Condition | Message |
|-----------|---------|
| Serial ID is missing from the URL | `"Serial ID is required"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while fetching attachment records.

| Condition | Message |
|-----------|---------|
| Database connection failure | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request

```bash
curl -X GET http://localhost:3000/api/serials/SN-00001/cert-attachments \
  -H "Accept: application/json"
```

### Response — Multiple attachments at different steps

```json
[
  {
    "id": "ca_001",
    "serialId": "SN-00001",
    "certId": "cert_mat01",
    "stepId": "step_001",
    "attachedAt": "2024-01-15T11:30:00.000Z",
    "attachedBy": "user_op1"
  },
  {
    "id": "ca_002",
    "serialId": "SN-00001",
    "certId": "cert_proc01",
    "stepId": "step_002",
    "attachedAt": "2024-01-15T14:30:00.000Z",
    "attachedBy": "user_op2"
  },
  {
    "id": "ca_003",
    "serialId": "SN-00001",
    "certId": "cert_proc02",
    "stepId": "step_003",
    "attachedAt": "2024-01-15T16:00:00.000Z",
    "attachedBy": "user_qc1"
  }
]
```

### Response — No attachments

```json
[]
```

## Notes

- This endpoint returns **attachment records**, not full certificate objects. To get the certificate's name, type, and metadata, use the certificate ID from the attachment to call the Certificates API, or use [Get Serial](/api-docs/serials/get) which returns full certificate objects.
- The `stepId` field tells you exactly where in the manufacturing process the certificate was attached. Cross-reference with the path's step array to get the step name and order.
- Attachments are ordered by the database's natural ordering (typically insertion order). There is no guaranteed sort order — sort client-side by `attachedAt` if chronological order is needed.
- This endpoint does **not** validate that the serial exists — it simply queries for attachment records matching the serial ID. If the serial doesn't exist, an empty array is returned rather than a 404 error.
- The same certificate can appear multiple times if it was attached at different steps (e.g. a process cert verified at multiple stages). Each attachment has a unique `id`.

## Related Endpoints

- [Attach Certificate](/api-docs/serials/attach-cert) — Attach a new certificate to a serial
- [Get Serial](/api-docs/serials/get) — View the serial with full certificate objects
- [Get Step Statuses](/api-docs/serials/step-statuses) — View step-level status to correlate with cert attachments

::
