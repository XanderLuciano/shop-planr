---
title: "Create User"
description: "Create a new shop user"
method: "POST"
endpoint: "/api/users"
service: "userService"
category: "Users"
requestBody: "{ name, department? }"
responseType: "ShopUser"
errorCodes: [400]
navigation:
  order: 2
---

# Create User

::endpoint-card{method="POST" path="/api/users"}

Creates a new shop user. Users are assigned to steps and tracked in the audit trail.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | User display name |
| `department` | `string` | No | Department the user belongs to |

## Example Request

```json
{
  "name": "Jane Smith",
  "department": "Assembly"
}
```

## Response

Returns the created `ShopUser` object:

```json
{
  "id": "user_abc",
  "name": "Jane Smith",
  "department": "Assembly",
  "active": true,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Missing `name` or invalid input |

::
