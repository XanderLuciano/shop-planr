---
title: "Update Advancement Mode"
description: "Change the advancement mode for a path"
method: "PATCH"
endpoint: "/api/paths/:id/advancement-mode"
service: "pathService"
category: "Paths"
requestBody: "UpdateAdvancementModeInput"
responseType: "Path"
errorCodes: [400, 404]
navigation:
  order: 5
---

# Update Advancement Mode

::endpoint-card{method="PATCH" path="/api/paths/:id/advancement-mode"}

Changes the advancement mode for a path. The advancement mode controls how serial numbers progress through process steps.

- **strict**: Serials must complete steps in exact order
- **flexible**: Serials can skip optional steps
- **per_step**: Each step's dependency type determines advancement behavior

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `advancementMode` | `string` | Yes | `"strict"`, `"flexible"`, or `"per_step"` |

## Example Request

```json
{
  "advancementMode": "flexible"
}
```

## Response

Returns the updated `Path` object:

```json
{
  "id": "path_xyz",
  "jobId": "job_abc123",
  "name": "Main Route",
  "goalQuantity": 50,
  "advancementMode": "flexible",
  "steps": [],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-16T09:00:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Invalid advancement mode value |
| `404` | Path not found |

::
