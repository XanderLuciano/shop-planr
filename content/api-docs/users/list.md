---
title: "List Users"
description: "Retrieve all shop users"
method: "GET"
endpoint: "/api/users"
service: "userService"
category: "Users"
responseType: "ShopUser[]"
errorCodes: [400]
navigation:
  order: 1
---

# List Users

::endpoint-card{method="GET" path="/api/users"}

Retrieves all shop users. Returns an array of `ShopUser` objects including active and inactive users.

## Response

Returns an array of `ShopUser` objects:

```json
[
  {
    "id": "user_abc",
    "name": "Jane Smith",
    "department": "Assembly",
    "active": true,
    "createdAt": "2024-01-10T08:00:00Z"
  },
  {
    "id": "user_def",
    "name": "John Doe",
    "active": false,
    "createdAt": "2024-01-05T08:00:00Z"
  }
]
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error |

::
