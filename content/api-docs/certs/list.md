---
title: "List Certificates"
description: "Retrieve all material and process certificates"
method: "GET"
endpoint: "/api/certs"
service: "certService"
category: "Certs"
responseType: "Certificate[]"
errorCodes: [500]
navigation:
  order: 1
---

# List Certificates

::endpoint-card{method="GET" path="/api/certs"}

Retrieves all certificates in the system. Returns both material and process certificates in a flat array, ordered by creation time. This endpoint accepts no query parameters — it always returns the complete list.

Use this endpoint to populate certificate selection dropdowns in the UI, or to build a certificate management dashboard. For large deployments with many certificates, consider filtering client-side by `type` or `name` since the API does not currently support server-side filtering.

## Request

No request body or query parameters.

## Response

### 200 OK

Returns an array of `Certificate` objects. If no certificates exist, returns an empty array `[]`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the certificate (prefixed with `cert_`) |
| `type` | `'material' \| 'process'` | Classification of the certificate |
| `name` | `string` | Human-readable name or identifier for the certificate |
| `metadata` | `Record<string, unknown> \| undefined` | Optional free-form metadata object |
| `createdAt` | `string` | ISO 8601 timestamp of when the certificate was created |

### 500 Internal Server Error

Returned if an unhandled error occurs while querying the database.

| Condition | Message |
|-----------|---------|
| Database read failure | `"Internal Server Error"` |

## Examples

### Request

```bash
curl http://localhost:3000/api/certs
```

### Response — Multiple certificates

```json
[
  {
    "id": "cert_abc123",
    "type": "material",
    "name": "Steel Alloy 4140 Mill Cert",
    "metadata": { "grade": "4140", "supplier": "MetalCo", "lotNumber": "LOT-2024-0042" },
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  {
    "id": "cert_def456",
    "type": "process",
    "name": "Heat Treatment Record HT-887",
    "metadata": { "temperature": "1550F", "duration": "2h", "furnaceId": "F-03" },
    "createdAt": "2024-01-16T08:00:00.000Z"
  },
  {
    "id": "cert_ghi789",
    "type": "material",
    "name": "Aluminum 7075-T6 COC",
    "createdAt": "2024-01-17T14:15:00.000Z"
  }
]
```

### Response — No certificates

```json
[]
```

## Notes

- The response includes certificates of both types (`material` and `process`) in a single array. Filter client-side if you need only one type.
- The `metadata` field is omitted from the response when it was not provided at creation time (it will be `undefined`, not `null`).
- Certificates are never deleted — they are permanent records. This endpoint will always return the full historical set.

## Related Endpoints

- [Get Certificate](/api-docs/certs/get) — Retrieve a single certificate by ID
- [Create Certificate](/api-docs/certs/create) — Create a new certificate
- [Get Certificate Attachments](/api-docs/certs/attachments) — See which serials have a given certificate

::
