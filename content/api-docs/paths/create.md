---
title: "Create Path"
description: "Create a new routing path for a job with process steps"
method: "POST"
endpoint: "/api/paths"
service: "pathService"
category: "Paths"
requestBody: "CreatePathInput"
responseType: "Path"
errorCodes: [400, 404]
navigation:
  order: 2
---

# Create Path

::endpoint-card{method="POST" path="/api/paths"}

Creates a new routing path for a job. A path defines an ordered sequence of process steps that serial numbers will advance through.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jobId` | `string` | Yes | ID of the parent job |
| `name` | `string` | Yes | Path name |
| `goalQuantity` | `number` | Yes | Target quantity for this path |
| `advancementMode` | `string` | No | `"strict"`, `"flexible"`, or `"per_step"` (default: `"strict"`) |
| `steps` | `object[]` | Yes | Array of process step definitions |
| `steps[].name` | `string` | Yes | Step name |
| `steps[].location` | `string` | No | Physical location for this step |
| `steps[].optional` | `boolean` | No | Whether the step can be skipped |
| `steps[].dependencyType` | `string` | No | `"physical"`, `"preferred"`, or `"completion_gate"` |

## Example Request

```json
{
  "jobId": "job_abc123",
  "name": "Main Route",
  "goalQuantity": 50,
  "advancementMode": "strict",
  "steps": [
    { "name": "Cutting", "location": "Bay A", "dependencyType": "physical" },
    { "name": "Welding", "location": "Bay B" },
    { "name": "Inspection", "optional": true }
  ]
}
```

## Response

Returns the created `Path` object:

```json
{
  "id": "path_xyz",
  "jobId": "job_abc123",
  "name": "Main Route",
  "goalQuantity": 50,
  "advancementMode": "strict",
  "steps": [
    {
      "id": "step_001",
      "name": "Cutting",
      "order": 0,
      "location": "Bay A",
      "optional": false,
      "dependencyType": "physical"
    },
    {
      "id": "step_002",
      "name": "Welding",
      "order": 1,
      "location": "Bay B",
      "optional": false,
      "dependencyType": "preferred"
    },
    {
      "id": "step_003",
      "name": "Inspection",
      "order": 2,
      "optional": true,
      "dependencyType": "preferred"
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Missing required fields, empty steps array, or `goalQuantity <= 0` |
| `404` | Parent job not found |

::
