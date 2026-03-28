---
title: "Delete Template"
description: "Delete a route template"
method: "DELETE"
endpoint: "/api/templates/:id"
service: "templateService"
category: "Templates"
responseType: "{ success: true }"
errorCodes: [400, 404]
navigation:
  order: 5
---

# Delete Template

::endpoint-card{method="DELETE" path="/api/templates/:id"}

Deletes a route template by its ID. This does not affect any paths that were previously created from this template.

## Response

Returns a success confirmation:

```json
{
  "success": true
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error |
| `404` | Template not found |

::
