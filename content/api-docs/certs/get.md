---
title: "Get Certificate"
description: "Retrieve a single certificate by ID"
method: "GET"
endpoint: "/api/certs/:id"
service: "certService"
category: "Certs"
responseType: "Certificate"
errorCodes: [404, 500]
navigation:
  order: 2
---

# Get Certificate

::endpoint-card{method="GET" path="/api/certs/:id"}

Retrieves a single certificate by its unique identifier. Use this endpoint to fetch the full details of a specific certificate, including its type, name, and any metadata that was stored at creation time.

This is commonly used when displaying certificate detail views, or when you need to verify a certificate exists before performing a batch attachment operation.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The unique identifier of the certificate (e.g. `"cert_abc123"`) |

## Response

### 200 OK

Returns the `Certificate` object matching the provided ID.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the certificate |
| `type` | `'material' \| 'process'` | Classification of the certificate |
| `name` | `string` | Human-readable name or identifier |
| `metadata` | `Record<string, unknown> \| undefined` | Optional free-form metadata object |
| `createdAt` | `string` | ISO 8601 timestamp of when the certificate was created |

### 404 Not Found

Returned when no certificate exists with the given ID.

| Condition | Message |
|-----------|---------|
| Certificate does not exist | `"Certificate not found: cert_abc123"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while querying the database.

| Condition | Message |
|-----------|---------|
| Database read failure | `"Internal Server Error"` |

## Examples

### Request

```bash
curl http://localhost:3000/api/certs/cert_abc123
```

### Response — Material certificate with metadata

```json
{
  "id": "cert_abc123",
  "type": "material",
  "name": "Steel Alloy 4140 Mill Cert",
  "metadata": {
    "grade": "4140",
    "supplier": "MetalCo",
    "lotNumber": "LOT-2024-0042",
    "expirationDate": "2025-01-15"
  },
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### Request — Process certificate without metadata

```bash
curl http://localhost:3000/api/certs/cert_def456
```

### Response — Process certificate

```json
{
  "id": "cert_def456",
  "type": "process",
  "name": "Operator Welding Qualification — J. Smith",
  "createdAt": "2024-01-16T08:00:00.000Z"
}
```

## Notes

- The `id` parameter is taken from the URL path. It must match an existing certificate exactly.
- The `metadata` field is only present in the response if it was provided when the certificate was created.
- Certificates are immutable after creation — the data returned by this endpoint will never change.

## Related Endpoints

- [List Certificates](/api-docs/certs/list) — Retrieve all certificates
- [Create Certificate](/api-docs/certs/create) — Create a new certificate
- [Get Certificate Attachments](/api-docs/certs/attachments) — See which serials have this certificate attached

::
