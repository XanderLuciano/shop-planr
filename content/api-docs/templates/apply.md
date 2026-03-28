---
title: "Apply Template"
description: "Apply a route template to a job, creating a new routing path"
method: "POST"
endpoint: "/api/templates/:id/apply"
service: "templateService"
category: "Templates"
requestBody: "ApplyTemplateInput"
responseType: "Path"
errorCodes: [400, 404]
navigation:
  order: 6
---

# Apply Template

::endpoint-card{method="POST" path="/api/templates/:id/apply"}

Applies a route template to a job, creating a new routing path with the template's process steps. This is the primary way to generate paths from reusable templates.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jobId` | `string` | Yes | ID of the job to apply the template to |
| `pathName` | `string` | No | Custom name for the created path (defaults to template name) |
| `goalQuantity` | `number` | Yes | Target quantity for the new path |

## Example Request

```json
{
  "jobId": "job_abc123",
  "pathName": "Assembly Line A",
  "goalQuantity": 100
}
```

## Response

Returns the created `Path` object with steps populated from the template:

```json
{
  "id": "path_xyz789",
  "jobId": "job_abc123",
  "name": "Assembly Line A",
  "goalQuantity": 100,
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
      "dependencyType": "physical"
    }
  ],
  "advancementMode": "strict",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Missing `jobId` or `goalQuantity`, or `goalQuantity <= 0` |
| `404` | Template or job not found |

::
