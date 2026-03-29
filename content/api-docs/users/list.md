---
title: "List Users"
description: "Retrieve all active shop users"
method: "GET"
endpoint: "/api/users"
service: "userService"
category: "Users"
responseType: "ShopUser[]"
errorCodes: [500]
navigation:
  order: 1
---

# List Users

::endpoint-card{method="GET" path="/api/users"}

Retrieves all active shop users. This endpoint returns only users with `active: true`, making it suitable for populating assignment dropdowns and operator selection lists in the UI. Inactive (deactivated) users are excluded from the response.

The returned array is not paginated — all active users are returned in a single response. For most shop floor deployments, the user count is small enough (tens to low hundreds) that pagination is unnecessary.

## Request

No request body or query parameters.

## Response

### 200 OK

Returns an array of `ShopUser` objects. May be empty if no active users exist.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique user identifier (e.g. `"user_abc123"`) |
| `name` | `string` | Display name of the user |
| `department` | `string \| undefined` | Department the user belongs to, if set |
| `active` | `boolean` | Always `true` in this response (inactive users are filtered out) |
| `createdAt` | `string` | ISO 8601 timestamp of when the user was created |

### 500 Internal Server Error

| Condition | Message |
|-----------|---------|
| Database read failure | `"Internal Server Error"` |

## Examples

### Request

```bash
curl http://localhost:3000/api/users
```

### Response — Multiple users

```json
[
  {
    "id": "user_a1b2c3",
    "name": "Jane Smith",
    "department": "Assembly",
    "active": true,
    "createdAt": "2024-01-10T08:00:00.000Z"
  },
  {
    "id": "user_d4e5f6",
    "name": "John Doe",
    "department": "Quality Control",
    "active": true,
    "createdAt": "2024-01-10T08:30:00.000Z"
  },
  {
    "id": "user_g7h8i9",
    "name": "Maria Garcia",
    "active": true,
    "createdAt": "2024-01-12T09:00:00.000Z"
  }
]
```

### Response — No active users

```json
[]
```

## Notes

- This endpoint calls `userService.listActiveUsers()`, which filters by `active: true` at the repository level. Deactivated users are never included.
- The `department` field is optional. Users created without a department will not have this field in the response (it will be `undefined`, omitted from JSON serialization).
- There is no sorting guarantee on the returned array. The order depends on the database insertion order.
- For a complete list including inactive users, there is no public API endpoint — this is by design to keep the operator-facing UI clean.

## Related Endpoints

- [Create User](/api-docs/users/create) — Add a new user to the system
- [Update User](/api-docs/users/update) — Modify a user's name, department, or active status
- [Assign Step](/api-docs/steps/assign) — Assign a user to a process step
- [Get Work Queue](/api-docs/operator/work-queue) — View work grouped by assigned operator

::
