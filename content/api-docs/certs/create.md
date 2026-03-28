---
title: "Create Certificate"
description: "Create a new material or process certificate"
method: "POST"
endpoint: "/api/certs"
service: "certService"
category: "Certs"
requestBody: "CreateCertInput"
responseType: "Certificate"
errorCodes: [400]
navigation:
  order: 3
---

# Create Certificate

::endpoint-card{method="POST" path="/api/certs"}

Creates a new certificate. Certificates track material or process certifications that can be attached to serial numbers at specific process steps.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `'material' \| 'process'` | Yes | Certificate type |
| `name` | `string` | Yes | Certificate name / identifier |
| `metadata` | `Record<string, unknown>` | No | Arbitrary metadata (e.g. grade, supplier) |

## Example Request

```json
{
  "type": "material",
  "name": "Steel Alloy 4140 Cert",
  "metadata": { "grade": "4140", "supplier": "MetalCo" }
}
```

## Response

Returns the created `Certificate` object:

```json
{
  "id": "cert_abc123",
  "type": "material",
  "name": "Steel Alloy 4140 Cert",
  "metadata": { "grade": "4140", "supplier": "MetalCo" },
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Missing `type` or `name`, or invalid `type` value |

::
