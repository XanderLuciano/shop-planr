---
title: "Update Path"
description: "Update an existing routing path and its steps"
method: "PUT"
endpoint: "/api/paths/:id"
service: "pathService"
category: "Paths"
requestBody: "UpdatePathInput"
responseType: "Path"
errorCodes: [400, 404]
navigation:
  order: 3
---

# Update Path

::endpoint-card{method="PUT" path="/api/paths/:id"}

Updates an existing routing path. Only the provided fields are modified; omitted fields remain unchanged. When `steps` is provided, the entire step list is replaced.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | No | Updated path name |
| `goalQuantity` | `number` | No | Updated target quantity |
| `advancementMode` | `string` | No | `"strict"`, `"flexible"`, or `"per_step"` |
| `steps` | `object[]` | No | Replacement step definitions |
| `steps[].name` | `string` | Yes | Step name |
| `steps[].location` | `string` | No | Physical location |
| `steps[].optional` | `boolean` | No | Whether the step can be skipped |
| `steps[].dependencyType` | `string` | No | `"physical"`, `"preferred"`, or `"completion_gate"` |

## Example Request

```json
{
  "name": "Main Route v2",
  "goalQuantity": 60,
  "steps": [
    { "name": "Cutting", "location": "Bay A" },
    { "name": "Welding", "location": "Bay C" },
    { "name": "QC Check" }
  ]
}
```

## Response

Returns the updated `Path` object:

```json
{
  "id": "path_xyz",
  "jobId": "job_abc123",
  "name": "Main Route v2",
  "goalQuantity": 60,
  "advancementMode": "strict",
  "steps": [
    { "id": "step_004", "name": "Cutting", "order": 0, "location": "Bay A", "optional": false, "dependencyType": "preferred" },
    { "id": "step_005", "name": "Welding", "order": 1, "location": "Bay C", "optional": false, "dependencyType": "preferred" },
    { "id": "step_006", "name": "QC Check", "order": 2, "optional": false, "dependencyType": "preferred" }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-16T09:00:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error (e.g. `goalQuantity <= 0`, empty steps) |
| `404` | Path not found |

::
