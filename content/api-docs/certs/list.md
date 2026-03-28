---
title: "List Certificates"
description: "Retrieve all certificates"
method: "GET"
endpoint: "/api/certs"
service: "certService"
category: "Certs"
responseType: "Certificate[]"
errorCodes: [400]
navigation:
  order: 1
---

# List Certificates

::endpoint-card{method="GET" path="/api/certs"}

Retrieves all certificates. Returns an array of `Certificate` objects representing material and process certifications.

## Response

Returns an array of `Certificate` objects:

```json
[
  {
    "id": "cert_abc123",
    "type": "material",
    "name": "Steel Alloy 4140 Cert",
    "metadata": { "grade": "4140", "supplier": "MetalCo" },
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error |

::
