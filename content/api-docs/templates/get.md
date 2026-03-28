---
title: "Get Template"
description: "Retrieve a single route template by ID"
method: "GET"
endpoint: "/api/templates/:id"
service: "templateService"
category: "Templates"
responseType: "TemplateRoute"
errorCodes: [404, 500]
navigation:
  order: 2
---

# Get Template

::endpoint-card{method="GET" path="/api/templates/:id"}

Retrieves a single route template by its unique identifier, including the full list of process step definitions. Use this endpoint to display template details in an editor view, or to preview a template's steps before applying it to a job.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The unique identifier of the template (e.g. `"tmpl_abc123"`) |

## Response

### 200 OK

Returns the `TemplateRoute` object matching the provided ID.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the template |
| `name` | `string` | Human-readable template name |
| `steps` | `TemplateStep[]` | Ordered array of process step definitions |
| `steps[].name` | `string` | Step name |
| `steps[].order` | `number` | Zero-based position in the sequence |
| `steps[].location` | `string \| undefined` | Physical location for the step, if assigned |
| `steps[].optional` | `boolean` | Whether the step can be skipped during advancement |
| `steps[].dependencyType` | `'physical' \| 'preferred' \| 'completion_gate'` | How strictly the step order is enforced |
| `createdAt` | `string` | ISO 8601 timestamp of when the template was created |
| `updatedAt` | `string` | ISO 8601 timestamp of the last modification |

### 404 Not Found

Returned when no template exists with the given ID.

| Condition | Message |
|-----------|---------|
| Template does not exist | `"TemplateRoute not found: tmpl_abc123"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while querying the database.

| Condition | Message |
|-----------|---------|
| Database read failure | `"Internal Server Error"` |

## Examples

### Request

```bash
curl http://localhost:3000/api/templates/tmpl_abc123
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
  "createdAt": "2024-01-10T09:00:00.000Z",
  "updatedAt": "2024-01-10T09:00:00.000Z"
}
```

### Request — Template without locations

```bash
curl http://localhost:3000/api/templates/tmpl_def456
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
  "createdAt": "2024-01-12T14:00:00.000Z",
  "updatedAt": "2024-01-12T14:00:00.000Z"
}
```

## Notes

- The `id` parameter is taken from the URL path. It must match an existing template exactly.
- Steps are always returned in `order` sequence (ascending). The `order` field is zero-indexed.
- The `location` field is omitted from step objects when it was not provided at creation or update time.
- The `updatedAt` timestamp reflects the last time the template was modified via `PUT /api/templates/:id`. For templates that have never been updated, `updatedAt` equals `createdAt`.

## Related Endpoints

- [List Templates](/api-docs/templates/list) — Retrieve all templates
- [Update Template](/api-docs/templates/update) — Modify this template's name or steps
- [Delete Template](/api-docs/templates/delete) — Remove this template
- [Apply Template](/api-docs/templates/apply) — Create a path from this template

::
