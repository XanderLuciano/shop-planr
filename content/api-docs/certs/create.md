---
title: "Create Certificate"
description: "Create a new material or process certificate"
method: "POST"
endpoint: "/api/certs"
service: "certService"
category: "Certs"
requestBody: "CreateCertInput"
responseType: "Certificate"
errorCodes: [400, 500]
navigation:
  order: 3
---

# Create Certificate

::endpoint-card{method="POST" path="/api/certs"}

Creates a new certificate in the system. A certificate represents a quality document — either a material certification (e.g., mill test report, certificate of conformance) or a process certification (e.g., heat treatment record, calibration certificate). Once created, a certificate can be attached to serial numbers at specific process steps using the [Batch Attach](/api-docs/certs/batch-attach) endpoint.

Certificates are immutable after creation. The `type`, `name`, and `metadata` fields cannot be changed once the certificate is persisted. If you need to correct a certificate, create a new one and attach it to the relevant serials.

## Request

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `'material' \| 'process'` | Yes | The classification of the certificate. Must be exactly `"material"` or `"process"`. |
| `name` | `string` | Yes | A human-readable name or identifier for the certificate (e.g. `"Steel Alloy 4140 Mill Cert"`). Must be a non-empty string. |
| `metadata` | `Record<string, unknown>` | No | An optional free-form JSON object for storing domain-specific attributes such as supplier name, grade, lot number, expiration date, or any other key-value data. |

## Response

### 201 Created

Returned when the certificate is successfully created. The response contains the complete `Certificate` object with the server-generated `id` and `createdAt` timestamp.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Server-generated unique identifier (prefixed with `cert_`) |
| `type` | `'material' \| 'process'` | The certificate type as provided in the request |
| `name` | `string` | The certificate name as provided in the request |
| `metadata` | `Record<string, unknown> \| undefined` | The metadata object, if provided |
| `createdAt` | `string` | ISO 8601 timestamp of when the certificate was created |

### 400 Bad Request

Returned when the request body fails validation. The response includes a message describing the specific validation failure.

| Condition | Message |
|-----------|---------|
| `type` is missing or not one of the allowed values | `"type must be one of: material, process"` |
| `name` is missing or empty | `"name is required"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while persisting the certificate to the database.

| Condition | Message |
|-----------|---------|
| Database write failure | `"Internal Server Error"` |

## Examples

### Request — Material certificate with metadata

```bash
curl -X POST http://localhost:3000/api/certs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "material",
    "name": "Steel Alloy 4140 Mill Cert",
    "metadata": {
      "grade": "4140",
      "supplier": "MetalCo",
      "lotNumber": "LOT-2024-0042",
      "expirationDate": "2025-01-15"
    }
  }'
```

### Response — Material certificate

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
curl -X POST http://localhost:3000/api/certs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "process",
    "name": "Heat Treatment Record HT-887"
  }'
```

### Response — Process certificate

```json
{
  "id": "cert_def456",
  "type": "process",
  "name": "Heat Treatment Record HT-887",
  "createdAt": "2024-01-15T11:00:00.000Z"
}
```

## Notes

- The `id` field is generated server-side using the `cert_` prefix and cannot be specified in the request body.
- The `type` field is validated strictly — only `"material"` and `"process"` are accepted. Any other value (including `null`, empty string, or misspellings) will return a 400 error.
- The `metadata` field accepts any valid JSON object. There is no schema validation on its contents — the object is stored and returned as-is.
- There is no uniqueness constraint on `name`. Multiple certificates can share the same name, though this is not recommended for clarity.
- Certificates are permanent records and cannot be updated or deleted after creation.

## Related Endpoints

- [List Certificates](/api-docs/certs/list) — Retrieve all certificates
- [Get Certificate](/api-docs/certs/get) — Retrieve a single certificate by ID
- [Batch Attach Certificate](/api-docs/certs/batch-attach) — Attach this certificate to multiple serials

::
