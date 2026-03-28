---
title: "Delete Override"
description: "Reverse a step override for a serial number"
method: "DELETE"
endpoint: "/api/serials/:id/overrides/:stepId"
service: "lifecycleService"
category: "Serials"
responseType: "{ success: true }"
errorCodes: [400, 404]
navigation:
  order: 12
---

# Delete Override

::endpoint-card{method="DELETE" path="/api/serials/:id/overrides/:stepId"}

Reverses (deactivates) a step override for a serial number. The override is marked as inactive rather than deleted, preserving the audit trail. Requires a `userId` in the request body for audit tracking.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | Yes | ID of the user reversing the override |

## Example Request

```json
{
  "userId": "user_01"
}
```

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
| `404` | Serial, step, or override not found |

::
