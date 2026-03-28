---
title: "Create User"
description: "Create a new shop floor user profile"
method: "POST"
endpoint: "/api/users"
service: "userService"
category: "Users"
requestBody: "{ name, department? }"
responseType: "ShopUser"
errorCodes: [400, 500]
navigation:
  order: 2
---

# Create User

::endpoint-card{method="POST" path="/api/users"}

Creates a new shop floor user profile. The user is created with `active: true` by default and can immediately be assigned to process steps or used for attribution in serial advancement, note creation, and other audit-tracked operations.

The `name` field is required and must be a non-empty string. It is trimmed of leading and trailing whitespace before storage. The optional `department` field provides organizational context but has no functional impact on routing or permissions.

There is no uniqueness constraint on `name`. Multiple users can share the same name, though this is not recommended as it creates ambiguity in the UI.

## Request

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Display name for the user. Must be a non-empty string. Leading and trailing whitespace is trimmed. Examples: `"Jane Smith"`, `"Operator 7"`. |
| `department` | `string` | No | Department or team the user belongs to. Free-text, no validation. Examples: `"Assembly"`, `"Quality Control"`, `"CNC"`. |

## Response

### 201 Created

Returns the newly created `ShopUser` object with server-generated fields.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Server-generated unique identifier (e.g. `"user_a1b2c3"`) |
| `name` | `string` | The trimmed display name as provided |
| `department` | `string \| undefined` | Department, if provided |
| `active` | `boolean` | Always `true` for newly created users |
| `createdAt` | `string` | ISO 8601 timestamp of creation |

### 400 Bad Request

| Condition | Message |
|-----------|---------|
| `name` is missing or empty | `"name is required"` |
| `name` is only whitespace | `"name is required"` |

### 500 Internal Server Error

| Condition | Message |
|-----------|---------|
| Database write failure | `"Internal Server Error"` |

## Examples

### Request — Full payload

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "department": "Assembly"
  }'
```

### Response — Full payload

```json
{
  "id": "user_a1b2c3",
  "name": "Jane Smith",
  "department": "Assembly",
  "active": true,
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### Request — Minimal payload (no department)

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Operator 7"
  }'
```

### Response — Minimal payload

```json
{
  "id": "user_d4e5f6",
  "name": "Operator 7",
  "active": true,
  "createdAt": "2024-01-15T11:00:00.000Z"
}
```

## Notes

- The `id` is generated server-side using the `user_` prefix followed by a unique nanoid. It cannot be specified in the request.
- The `active` flag is always `true` on creation. To create a deactivated user, create them first and then update with `active: false`.
- The `createdAt` timestamp is set server-side and cannot be overridden.
- There is no `updatedAt` field on users. The `createdAt` is the only timestamp.
- User names are trimmed but not otherwise validated. Special characters, numbers, and Unicode are all accepted.

## Related Endpoints

- [List Users](/api-docs/users/list) — Retrieve all active users
- [Update User](/api-docs/users/update) — Modify name, department, or active status
- [Assign Step](/api-docs/steps/assign) — Assign the new user to a process step

::
