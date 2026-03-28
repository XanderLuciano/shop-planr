---
title: "Create Template"
description: "Create a new route template with process steps"
method: "POST"
endpoint: "/api/templates"
service: "templateService"
category: "Templates"
requestBody: "CreateTemplateInput"
responseType: "TemplateRoute"
errorCodes: [400]
navigation:
  order: 3
---

# Create Template

::endpoint-card{method="POST" path="/api/templates"}

Creates a new route template. Templates define reusable sequences of process steps that can later be applied to jobs to generate routing paths.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Template name |
| `steps` | `array` | Yes | Array of step definitions |
| `steps[].name` | `string` | Yes | Step name |
| `steps[].location` | `string` | No | Physical location for the step |

## Example Request

```json
{
  "name": "Standard Assembly",
  "steps": [
    { "name": "Cutting", "location": "Bay A" },
    { "name": "Welding", "location": "Bay B" },
    { "name": "Inspection" }
  ]
}
```

## Response

Returns the created `TemplateRoute` object:

```json
{
  "id": "tmpl_abc123",
  "name": "Standard Assembly",
  "steps": [
    {
      "name": "Cutting",
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
      "name": "Inspection",
      "order": 2,
      "optional": false,
      "dependencyType": "physical"
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Missing `name` or `steps`, or empty `steps` array |

::
