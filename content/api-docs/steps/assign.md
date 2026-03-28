---
title: "Assign Step"
description: "Assign or unassign a user to a process step"
method: "PATCH"
endpoint: "/api/steps/:id/assign"
service: "pathService"
category: "Steps"
requestBody: "AssignStepInput"
responseType: "ProcessStep"
errorCodes: [400, 404]
navigation:
  order: 1
---

# Assign Step

::endpoint-card{method="PATCH" path="/api/steps/:id/assign"}

Assigns a user to a process step, or unassigns the current user by passing `null`. Step assignments determine which operator is responsible for work at that step.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Process step ID |

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string \| null` | Yes | User ID to assign, or `null` to unassign |

## Example Request

Assign a user:

```json
{
  "userId": "user_abc"
}
```

Unassign:

```json
{
  "userId": null
}
```

## Response

Returns the updated `ProcessStep` object:

```json
{
  "id": "step_001",
  "name": "Assembly",
  "order": 1,
  "location": "Bay 3",
  "assignedTo": "user_abc",
  "optional": false,
  "dependencyType": "physical"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Invalid input |
| `404` | Step not found |

::
