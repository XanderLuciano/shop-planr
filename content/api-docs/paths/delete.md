---
title: "Delete Path"
description: "Delete a routing path from a job"
method: "DELETE"
endpoint: "/api/paths/:id"
service: "pathService"
category: "Paths"
responseType: "{ success: true }"
errorCodes: [400, 404]
navigation:
  order: 4
---

# Delete Path

::endpoint-card{method="DELETE" path="/api/paths/:id"}

Deletes a routing path and its associated process steps from a job.

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
| `404` | Path not found |

::
