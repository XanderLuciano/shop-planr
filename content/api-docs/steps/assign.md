---
title: 'Assign Step'
description: 'Assign or unassign an operator to a process step'
method: 'PATCH'
endpoint: '/api/steps/:id/assign'
service: 'pathService'
category: 'Steps'
requestBody: 'AssignStepInput'
responseType: 'ProcessStep'
errorCodes: [400, 404, 500]
navigation:
  order: 1
---

# Assign Step

::endpoint-card{method="PATCH" path="/api/steps/:id/assign"}

Assigns a shop user to a process step, or removes the current assignment by passing `null`. Step assignments determine which operator is responsible for work at that step and control how work appears in the [Work Queue](/api-docs/operator/work-queue).

The endpoint validates that:

1. The step exists (by scanning all paths for the step ID)
2. If assigning (non-null `userId`), the user exists and is active

Assigning an inactive or non-existent user returns a `400` error. Passing `null` always succeeds (no user validation needed for unassignment).

The assignment is stored on the `ProcessStep` object within its parent path. It does not affect the path's `updatedAt` timestamp.

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                        |
| --------- | -------- | -------- | -------------------------------------------------- |
| `id`      | `string` | Yes      | The process step ID to assign (e.g. `"step_001"`). |

### Request Body

| Field    | Type             | Required | Description                                                                                                                     |
| -------- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `userId` | `string \| null` | Yes      | The user ID to assign to this step. Pass `null` to remove the current assignment (unassign). The user must exist and be active. |

## Response

### 200 OK

Returns the updated `ProcessStep` object with the new assignment.

| Field            | Type                  | Description                                                    |
| ---------------- | --------------------- | -------------------------------------------------------------- |
| `id`             | `string`              | Step ID (unchanged)                                            |
| `name`           | `string`              | Step name                                                      |
| `order`          | `number`              | Zero-based position in the path                                |
| `location`       | `string \| undefined` | Physical location of the step                                  |
| `assignedTo`     | `string \| undefined` | User ID of the assigned operator, or `undefined` if unassigned |
| `optional`       | `boolean`             | Whether the step can be skipped                                |
| `dependencyType` | `string`              | `"physical"`, `"preferred"`, or `"completion_gate"`            |

### 400 Bad Request

| Condition                                                | Message                           |
| -------------------------------------------------------- | --------------------------------- |
| `userId` is a non-null value that doesn't match any user | `"User not found or inactive"`    |
| `userId` matches an inactive user                        | `"User not found or inactive"`    |
| User repository not available (internal config issue)    | `"User repository not available"` |

### 404 Not Found

| Condition                       | Message                         |
| ------------------------------- | ------------------------------- |
| No step found with the given ID | `"ProcessStep not found: {id}"` |

### 500 Internal Server Error

| Condition              | Message                   |
| ---------------------- | ------------------------- |
| Database write failure | `"Internal Server Error"` |

## Examples

### Request — Assign a user

```bash
curl -X PATCH http://localhost:3000/api/steps/step_001/assign \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_a1b2c3"
  }'
```

### Response — User assigned

```json
{
  "id": "step_001",
  "name": "CNC Machining",
  "order": 0,
  "location": "Bay 1",
  "assignedTo": "user_a1b2c3",
  "optional": false,
  "dependencyType": "preferred"
}
```

### Request — Unassign

```bash
curl -X PATCH http://localhost:3000/api/steps/step_001/assign \
  -H "Content-Type: application/json" \
  -d '{
    "userId": null
  }'
```

### Response — Unassigned

```json
{
  "id": "step_001",
  "name": "CNC Machining",
  "order": 0,
  "location": "Bay 1",
  "optional": false,
  "dependencyType": "preferred"
}
```

### Error — Inactive user

```bash
curl -X PATCH http://localhost:3000/api/steps/step_001/assign \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_deactivated"
  }'
# 400: { "message": "User not found or inactive" }
```

## Notes

- Assigning a step to a new user **replaces** the previous assignment. There is no history of past assignments (though the work queue reflects the current state).
- Unassigning a step (passing `null`) causes it to appear in the "Unassigned" group in the work queue.
- The `assignedTo` field is `undefined` (omitted from JSON) when unassigned, not `null`. This is a serialization detail — the domain model uses `undefined` for absent optional fields.
- Assignment does not affect serial advancement. Any user can advance serials at any step regardless of assignment. Assignment is purely organizational.
- The step is located by scanning all paths across all jobs. This is a full scan but is fast for expected data volumes.

## Related Endpoints

- [Update Step Config](/api-docs/steps/config) — Modify optional flag and dependency type
- [List Users](/api-docs/users/list) — Get available user IDs for assignment
- [Get Work Queue](/api-docs/operator/work-queue) — See how assignments affect the work queue

::
