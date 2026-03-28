---
title: "Update Template"
description: "Update an existing route template's name or steps"
method: "PUT"
endpoint: "/api/templates/:id"
service: "templateService"
category: "Templates"
requestBody: "Partial<CreateTemplateInput>"
responseType: "TemplateRoute"
errorCodes: [400, 404, 500]
navigation:
  order: 4
---

# Update Template

::endpoint-card{method="PUT" path="/api/templates/:id"}

Updates an existing route template. This endpoint supports partial updates — you can update just the `name`, just the `steps`, or both in a single request. Only the fields you include in the request body are modified; omitted fields retain their current values.

When updating `steps`, the entire step array is replaced. There is no mechanism to add, remove, or reorder individual steps — you must provide the complete new step list. The system re-assigns `order` values from the new array indices.

Updating a template does **not** affect any paths that were previously created from it. Template application is a deep-clone operation, so existing paths are fully independent.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The unique identifier of the template to update (e.g. `"tmpl_abc123"`) |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | No | Updated template name. Must be non-empty if provided. Leading and trailing whitespace is trimmed. |
| `steps` | `array` | No | Updated array of step definitions. Must contain at least one step if provided. Replaces the entire existing step array. |
| `steps[].name` | `string` | Yes (if steps provided) | The name of the process step. |
| `steps[].location` | `string` | No | The physical location where this step is performed. |
| `steps[].optional` | `boolean` | No | Whether the step can be skipped. Defaults to `false` if omitted. |
| `steps[].dependencyType` | `'physical' \| 'preferred' \| 'completion_gate'` | No | How strictly step order is enforced. Defaults to `"preferred"` if omitted. |

## Response

### 200 OK

Returned when the template is successfully updated. The response contains the complete updated `TemplateRoute` object.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | The template's unique identifier (unchanged) |
| `name` | `string` | The template name (updated or unchanged) |
| `steps` | `TemplateStep[]` | The step definitions (updated or unchanged) |
| `steps[].name` | `string` | Step name |
| `steps[].order` | `number` | Zero-based position re-assigned from array index |
| `steps[].location` | `string \| undefined` | Location, if provided |
| `steps[].optional` | `boolean` | Whether the step is optional |
| `steps[].dependencyType` | `'physical' \| 'preferred' \| 'completion_gate'` | Dependency enforcement level |
| `createdAt` | `string` | Original creation timestamp (unchanged) |
| `updatedAt` | `string` | ISO 8601 timestamp of this update |

### 400 Bad Request

Returned when the request body fails validation.

| Condition | Message |
|-----------|---------|
| `name` is provided but empty | `"name is required"` |
| `steps` is provided but empty array | `"steps must have at least one item"` |

### 404 Not Found

Returned when no template exists with the given ID.

| Condition | Message |
|-----------|---------|
| Template does not exist | `"TemplateRoute not found: tmpl_abc123"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while persisting the update.

| Condition | Message |
|-----------|---------|
| Database write failure | `"Internal Server Error"` |

## Examples

### Request — Update name only

```bash
curl -X PUT http://localhost:3000/api/templates/tmpl_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Advanced CNC Machining v2"
  }'
```

### Response — Name updated

```json
{
  "id": "tmpl_abc123",
  "name": "Advanced CNC Machining v2",
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
    }
  ],
  "createdAt": "2024-01-10T09:00:00.000Z",
  "updatedAt": "2024-01-20T14:00:00.000Z"
}
```

### Request — Replace steps entirely

```bash
curl -X PUT http://localhost:3000/api/templates/tmpl_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "steps": [
      { "name": "Laser Cutting", "location": "Laser Bay" },
      { "name": "Welding", "location": "Weld Shop" },
      { "name": "Powder Coating", "location": "Paint Booth" },
      { "name": "QC Inspection", "location": "QC Lab" }
    ]
  }'
```

### Response — Steps replaced

```json
{
  "id": "tmpl_abc123",
  "name": "Advanced CNC Machining v2",
  "steps": [
    {
      "name": "Laser Cutting",
      "order": 0,
      "location": "Laser Bay",
      "optional": false,
      "dependencyType": "preferred"
    },
    {
      "name": "Welding",
      "order": 1,
      "location": "Weld Shop",
      "optional": false,
      "dependencyType": "preferred"
    },
    {
      "name": "Powder Coating",
      "order": 2,
      "location": "Paint Booth",
      "optional": false,
      "dependencyType": "preferred"
    },
    {
      "name": "QC Inspection",
      "order": 3,
      "location": "QC Lab",
      "optional": false,
      "dependencyType": "preferred"
    }
  ],
  "createdAt": "2024-01-10T09:00:00.000Z",
  "updatedAt": "2024-01-20T15:30:00.000Z"
}
```

## Notes

- When `steps` is provided, the **entire** step array is replaced. There is no merge or diff — the old steps are discarded and the new ones take their place.
- Step `order` values are re-assigned from the new array indices (0, 1, 2, ...) regardless of any order values you might include in the request.
- If `optional` is not specified for a step, it defaults to `false`. If `dependencyType` is not specified, it defaults to `"preferred"`.
- The `updatedAt` timestamp is set to the current time on every successful update, even if the actual data did not change.
- Updating a template has no effect on paths that were previously created from it. Template application is a one-time deep-clone.
- The `createdAt` timestamp is never modified.

## Related Endpoints

- [Get Template](/api-docs/templates/get) — Retrieve the current state of a template
- [Delete Template](/api-docs/templates/delete) — Remove a template entirely
- [Apply Template](/api-docs/templates/apply) — Create a path from the updated template
- [Create Template](/api-docs/templates/create) — Create a new template from scratch

::
