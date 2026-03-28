---
title: "List Templates"
description: "Retrieve all route templates"
method: "GET"
endpoint: "/api/templates"
service: "templateService"
category: "Templates"
responseType: "TemplateRoute[]"
errorCodes: [400]
navigation:
  order: 1
---

# List Templates

::endpoint-card{method="GET" path="/api/templates"}

Retrieves all route templates. Templates define reusable sequences of process steps that can be applied to jobs to create routing paths.

## Response

Returns an array of `TemplateRoute` objects:

```json
[
  {
    "id": "tmpl_abc123",
    "name": "Standard Assembly",
    "steps": [
      {
        "name": "Cutting",
        "order": 0,
        "location": "Bay A",
        "optional": false,
        "dependencyType": "physical"
      },
      {
        "name": "Welding",
        "order": 1,
        "location": "Bay B",
        "optional": false,
        "dependencyType": "physical"
      }
    ],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
]
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error |

::
