---
title: "Update Step Config"
description: "Update configuration options for a process step"
method: "PATCH"
endpoint: "/api/steps/:id/config"
service: "pathService"
category: "Steps"
requestBody: "{ optional?, dependencyType? }"
responseType: "ProcessStep"
errorCodes: [400, 404]
navigation:
  order: 2
---

# Update Step Config

::endpoint-card{method="PATCH" path="/api/steps/:id/config"}

Updates configuration options for a process step. Can toggle whether the step is optional and change its dependency type.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Process step ID |

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `optional` | `boolean` | No | Whether the step can be skipped |
| `dependencyType` | `string` | No | `"physical"`, `"preferred"`, or `"completion_gate"` |

## Example Request

```json
{
  "optional": true,
  "dependencyType": "preferred"
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
  "optional": true,
  "dependencyType": "preferred"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Invalid `dependencyType` value |
| `404` | Step not found |

::
