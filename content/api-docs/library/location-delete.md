---
title: "Delete Location"
description: "Delete a location library entry"
method: "DELETE"
endpoint: "/api/library/locations/:id"
service: "libraryService"
category: "Library"
responseType: "{ success: true }"
errorCodes: [400, 404]
navigation:
  order: 4
---

# Delete Location

::endpoint-card{method="DELETE" path="/api/library/locations/:id"}

Deletes a location library entry by ID. This does not affect existing steps that use this location name.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Location library entry ID |

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
| `404` | Location library entry not found |

::
