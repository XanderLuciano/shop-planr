---
title: "Delete Process"
description: "Delete a process library entry"
method: "DELETE"
endpoint: "/api/library/processes/:id"
service: "libraryService"
category: "Library"
responseType: "{ success: true }"
errorCodes: [400, 404]
navigation:
  order: 2
---

# Delete Process

::endpoint-card{method="DELETE" path="/api/library/processes/:id"}

Deletes a process library entry by ID. This does not affect existing paths or steps that use this process name.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Process library entry ID |

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
| `400` | Invalid ID format |
| `404` | Process library entry not found |

::
