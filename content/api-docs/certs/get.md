---
title: "Get Certificate"
description: "Retrieve a single certificate by ID"
method: "GET"
endpoint: "/api/certs/:id"
service: "certService"
category: "Certs"
responseType: "Certificate"
errorCodes: [400, 404]
navigation:
  order: 2
---

# Get Certificate

::endpoint-card{method="GET" path="/api/certs/:id"}

Retrieves a single certificate by its ID.

## Response

Returns the `Certificate` object:

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
| `400` | Validation error |
| `404` | Certificate not found |

::
