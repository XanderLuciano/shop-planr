---
title: "Create Template"
description: "Create a new route template with process steps"
method: "POST"
endpoint: "/api/templates"
service: "templateService"
category: "Templates"
requestBody: "CreateTemplateInput"
responseType: "TemplateRoute"
errorCodes: [400, 500]
navigation:
  order: 3
---

# Create Template

::endpoint-card{method="POST" path="/api/templates"}

Creates a new route template. A template defines a reusable sequence of process steps that can later be applied to jobs to generate manufacturing paths. Each step requires a name and optionally a physical location. The system automatically assigns zero-based `order` values, sets `optional` to `false`, and sets `dependencyType` to `"physical"` for all steps.

After creating a template, use the [Apply Template](/api-docs/templates/apply) endpoint to create paths from it on specific jobs.

## Request

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | A human-readable name for the template (e.g. `"Standard CNC Machining"`). Must be a non-empty string. Leading and trailing whitespace is trimmed. |
| `steps` | `array` | Yes | An ordered array of step definitions. Must contain at least one step. The array order determines the `order` field on each step. |
| `steps[].name` | `string` | Yes | The name of the process step (e.g. `"CNC Milling"`, `"Inspection"`). |
| `steps[].location` | `string` | No | The physical location where this step is performed (e.g. `"Bay A"`, `"QC Lab"`). |

## Response

### 201 Created

Returned when the template is successfully created. The response contains the complete `TemplateRoute` object with server-generated fields.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Server-generated unique identifier (prefixed with `tmpl_`) |
| `name` | `string` | The template name as provided (trimmed) |
| `steps` | `TemplateStep[]` | The step definitions with server-assigned `order`, `optional`, and `dependencyType` |
| `steps[].name` | `string` | Step name as provided |
| `steps[].order` | `number` | Zero-based position assigned from array index |
| `steps[].location` | `string \| undefined` | Location as provided, if any |
| `steps[].optional` | `boolean` | Always `false` for newly created templates |
| `steps[].dependencyType` | `'physical' \| 'preferred' \| 'completion_gate'` | Always `"physical"` for newly created templates |
| `createdAt` | `string` | ISO 8601 timestamp of when the template was created |
| `updatedAt` | `string` | ISO 8601 timestamp — same as `createdAt` for newly created templates |

### 400 Bad Request

Returned when the request body fails validation.

| Condition | Message |
|-----------|---------|
| `name` is missing or empty | `"name is required"` |
| `steps` is missing or empty array | `"steps must have at least one item"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while persisting the template.

| Condition | Message |
|-----------|---------|
| Database write failure | `"Internal Server Error"` |

## Examples

### Request — Template with locations

```bash
curl -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Standard CNC Machining",
    "steps": [
      { "name": "Raw Material Inspection", "location": "QC Lab" },
      { "name": "CNC Milling", "location": "CNC Room" },
      { "name": "Deburring", "location": "Finishing Bay" },
      { "name": "Final Inspection", "location": "QC Lab" }
    ]
  }'
```

### Response — Template with locations

```json
{
  "id": "tmpl_abc123",
  "name": "Standard CNC Machining",
  "steps": [
    {
      "name": "Raw Material Inspection",
      "order": 0,
      "location": "QC Lab",
      "optional": false,
      "dependencyType": "physical"
    },
    {
      "name": "CNC Milling",
      "order": 1,
      "location": "CNC Room",
      "optional": false,
      "dependencyType": "physical"
    },
    {
      "name": "Deburring",
      "order": 2,
      "location": "Finishing Bay",
      "optional": false,
      "dependencyType": "physical"
    },
    {
      "name": "Final Inspection",
      "order": 3,
      "location": "QC Lab",
      "optional": false,
      "dependencyType": "physical"
    }
  ],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### Request — Minimal template (no locations)

```bash
curl -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Quick Assembly",
    "steps": [
      { "name": "Assembly" },
      { "name": "Test" }
    ]
  }'
```

### Response — Minimal template

```json
{
  "id": "tmpl_def456",
  "name": "Quick Assembly",
  "steps": [
    {
      "name": "Assembly",
      "order": 0,
      "optional": false,
      "dependencyType": "physical"
    },
    {
      "name": "Test",
      "order": 1,
      "optional": false,
      "dependencyType": "physical"
    }
  ],
  "createdAt": "2024-01-15T11:00:00.000Z",
  "updatedAt": "2024-01-15T11:00:00.000Z"
}
```

## Notes

- The `id` field is generated server-side using the `tmpl_` prefix and cannot be specified in the request body.
- Step `order` values are assigned automatically from the array index (0, 1, 2, ...). You cannot specify custom order values in the request.
- All steps are created with `optional: false` and `dependencyType: "physical"` by default. To change these values, use the [Update Template](/api-docs/templates/update) endpoint after creation.
- There is no uniqueness constraint on template `name`. Multiple templates can share the same name.
- The `name` field is trimmed of leading and trailing whitespace before storage.
- Creating a template does not create any paths or affect any jobs. Templates are inert until applied.

## Related Endpoints

- [List Templates](/api-docs/templates/list) — Retrieve all templates
- [Update Template](/api-docs/templates/update) — Modify the template after creation
- [Apply Template](/api-docs/templates/apply) — Create a path from this template on a job

::
