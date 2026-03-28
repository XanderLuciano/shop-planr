---
title: "Update Template"
description: "Update an existing route template"
method: "PUT"
endpoint: "/api/templates/:id"
service: "templateService"
category: "Templates"
requestBody: "Partial<CreateTemplateInput>"
responseType: "TemplateRoute"
errorCodes: [400, 404]
navigation:
  order: 4
---

# Update Template

::endpoint-card{method="PUT" path="/api/templates/:id"}

Updates an existing route template. Supports partial updates — only the provided fields are modified.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | No | Updated template name |
| `steps` | `array` | No | Updated array of step definitions |
| `steps[].name` | `string` | Yes (if steps provided) | Step name |
| `steps[].location` | `string` | No | Physical location for the step |

## Example Request

```json
{
  "name": "Updated Assembly Template",
  "steps": [
    { "name": "Laser Cutting", "location": "Bay A" },
    { "name": "Welding", "location": "Bay B" },
    { "name": "QC Inspection" }
  ]
}
```

## Response

Returns the updated `TemplateRoute` object:

```json
{
  "id": "tmpl_abc123",
  "name": "Updated Assembly Template",
  "steps": [
    {
      "name": "Laser Cutting",
      "order": 0,
      "location": "Bay A",
      "optional": false,
      "dependencyType": "physical"
    },
    {
      "name": "Welding",
      "order": 1,
      "location": "Bay B",
      "optional": false,
      "dependencyType": "physical"
    },
    {
      "name": "QC Inspection",
      "order": 2,
      "optional": false,
      "dependencyType": "physical"
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-20T14:00:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error or empty `steps` array |
| `404` | Template not found |

::
