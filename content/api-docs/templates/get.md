---
title: "Get Template"
description: "Retrieve a single route template by ID"
method: "GET"
endpoint: "/api/templates/:id"
service: "templateService"
category: "Templates"
responseType: "TemplateRoute"
errorCodes: [400, 404]
navigation:
  order: 2
---

# Get Template

::endpoint-card{method="GET" path="/api/templates/:id"}

Retrieves a single route template by its ID, including all defined process steps.

## Response

Returns the `TemplateRoute` object:

```json
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
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error |
| `404` | Template not found |

::
