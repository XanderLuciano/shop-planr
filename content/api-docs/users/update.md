---
title: 'Update User'
description: "Update an existing shop user's name, department, or active status"
method: 'PUT'
endpoint: '/api/users/:id'
service: 'userService'
category: 'Users'
requestBody: '{ name?, department?, active? }'
responseType: 'ShopUser'
errorCodes: [400, 404, 500]
navigation:
  order: 3
---

# Update User

::endpoint-card{method="PUT" path="/api/users/:id"}

Updates an existing shop user. Accepts a partial payload — only the fields provided in the request body are modified. This endpoint is used to rename users, change their department, or toggle their active status (soft delete / reactivation).

The user must exist. If the `name` field is provided, it must be a non-empty string (same validation as creation). The `active` field accepts a boolean — setting it to `false` effectively deactivates the user, removing them from the active users list and preventing new step assignments.

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                |
| --------- | -------- | -------- | ------------------------------------------ |
| `id`      | `string` | Yes      | The unique user ID (e.g. `"user_a1b2c3"`). |

### Request Body

All fields are optional. Only provided fields are updated.

| Field        | Type      | Required | Description                                                                 |
| ------------ | --------- | -------- | --------------------------------------------------------------------------- |
| `name`       | `string`  | No       | Updated display name. Must be non-empty if provided. Trimmed of whitespace. |
| `department` | `string`  | No       | Updated department. Can be set to any string or empty string.               |
| `active`     | `boolean` | No       | Set to `false` to deactivate the user, `true` to reactivate.                |

## Response

### 200 OK

Returns the complete updated `ShopUser` object.

| Field        | Type                  | Description                             |
| ------------ | --------------------- | --------------------------------------- |
| `id`         | `string`              | User ID (unchanged)                     |
| `name`       | `string`              | Display name (updated if provided)      |
| `department` | `string \| undefined` | Department (updated if provided)        |
| `active`     | `boolean`             | Active status (updated if provided)     |
| `createdAt`  | `string`              | Original creation timestamp (unchanged) |

### 400 Bad Request

| Condition                    | Message              |
| ---------------------------- | -------------------- |
| `name` is provided but empty | `"name is required"` |
| `name` is only whitespace    | `"name is required"` |

### 404 Not Found

| Condition                        | Message                  |
| -------------------------------- | ------------------------ |
| No user exists with the given ID | `"User not found: {id}"` |

### 500 Internal Server Error

| Condition              | Message                   |
| ---------------------- | ------------------------- |
| Database write failure | `"Internal Server Error"` |

## Examples

### Request — Change department

```bash
curl -X PUT http://localhost:3000/api/users/user_a1b2c3 \
  -H "Content-Type: application/json" \
  -d '{
    "department": "Quality Control"
  }'
```

### Response — Department updated

```json
{
  "id": "user_a1b2c3",
  "name": "Jane Smith",
  "department": "Quality Control",
  "active": true,
  "createdAt": "2024-01-10T08:00:00.000Z"
}
```

### Request — Deactivate user

```bash
curl -X PUT http://localhost:3000/api/users/user_a1b2c3 \
  -H "Content-Type: application/json" \
  -d '{
    "active": false
  }'
```

### Response — User deactivated

```json
{
  "id": "user_a1b2c3",
  "name": "Jane Smith",
  "department": "Quality Control",
  "active": false,
  "createdAt": "2024-01-10T08:00:00.000Z"
}
```

### Request — Rename and reactivate

```bash
curl -X PUT http://localhost:3000/api/users/user_a1b2c3 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith-Johnson",
    "active": true
  }'
```

### Response — Renamed and reactivated

```json
{
  "id": "user_a1b2c3",
  "name": "Jane Smith-Johnson",
  "department": "Quality Control",
  "active": true,
  "createdAt": "2024-01-10T08:00:00.000Z"
}
```

## Notes

- Deactivating a user does **not** remove their existing step assignments. Steps assigned to a deactivated user will still show that assignment, but the user will no longer appear in assignment dropdowns.
- Deactivating a user does **not** affect historical audit records. All past actions attributed to the user remain intact.
- The `createdAt` timestamp is immutable and always reflects the original creation time.
- There is no `updatedAt` field on the `ShopUser` type. The response does not indicate when the last update occurred.
- Sending an empty request body `{}` is valid but results in no changes — the existing user is returned as-is.
- The `name` field is trimmed before storage, consistent with the create endpoint.

## Related Endpoints

- [List Users](/api-docs/users/list) — Verify the user appears (or doesn't) in the active list
- [Create User](/api-docs/users/create) — Create a new user
- [Assign Step](/api-docs/steps/assign) — Assign or unassign the user from a step

::
