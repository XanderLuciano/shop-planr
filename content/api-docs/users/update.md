---
title: "Update User"
description: "Update an existing shop user"
method: "PUT"
endpoint: "/api/users/:id"
service: "userService"
category: "Users"
requestBody: "Partial<ShopUser>"
responseType: "ShopUser"
errorCodes: [400, 404]
navigation:
  order: 3
---

# Update User

::endpoint-card{method="PUT" path="/api/users/:id"}

Updates an existing shop user. Accepts a partial payload — only the fields provided will be updated. Can be used to change name, department, or deactivate a user.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | User ID |

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | No | Updated display name |
| `department` | `string` | No | Updated department |
| `active` | `boolean` | No | Set to `false` to deactivate |

## Example Request

```json
{
  "department": "Quality Control",
  "active": true
}
```

## Response

Returns the updated `ShopUser` object:

```json
{
  "id": "user_abc",
  "name": "Jane Smith",
  "department": "Quality Control",
  "active": true,
  "createdAt": "2024-01-10T08:00:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Invalid input |
| `404` | User not found |

::
