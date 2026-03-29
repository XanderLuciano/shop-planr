---
title: 'List Templates'
description: 'Retrieve all route templates'
method: 'GET'
endpoint: '/api/templates'
service: 'templateService'
category: 'Templates'
responseType: 'TemplateRoute[]'
errorCodes: [500]
navigation:
  order: 1
---

# List Templates

::endpoint-card{method="GET" path="/api/templates"}

Retrieves all route templates in the system. Returns the complete list of templates with their step definitions, ordered by creation time. This endpoint accepts no query parameters — it always returns the full set.

Use this endpoint to populate template selection dropdowns when setting up new jobs, or to display a template management dashboard where users can browse, edit, or delete templates.

## Request

No request body or query parameters.

## Response

### 200 OK

Returns an array of `TemplateRoute` objects. If no templates exist, returns an empty array `[]`.

| Field                    | Type                                             | Description                                                |
| ------------------------ | ------------------------------------------------ | ---------------------------------------------------------- |
| `id`                     | `string`                                         | Unique identifier for the template (prefixed with `tmpl_`) |
| `name`                   | `string`                                         | Human-readable template name                               |
| `steps`                  | `TemplateStep[]`                                 | Ordered array of process step definitions                  |
| `steps[].name`           | `string`                                         | Step name                                                  |
| `steps[].order`          | `number`                                         | Zero-based position in the sequence                        |
| `steps[].location`       | `string \| undefined`                            | Physical location for the step, if assigned                |
| `steps[].optional`       | `boolean`                                        | Whether the step can be skipped during advancement         |
| `steps[].dependencyType` | `'physical' \| 'preferred' \| 'completion_gate'` | How strictly the step order is enforced                    |
| `createdAt`              | `string`                                         | ISO 8601 timestamp of when the template was created        |
| `updatedAt`              | `string`                                         | ISO 8601 timestamp of the last modification                |

### 500 Internal Server Error

Returned if an unhandled error occurs while querying the database.

| Condition             | Message                   |
| --------------------- | ------------------------- |
| Database read failure | `"Internal Server Error"` |

## Examples

### Request

```bash
curl http://localhost:3000/api/templates
```

### Response — Multiple templates

```json
[
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
  },
  {
    "id": "tmpl_def456",
    "name": "Assembly Line A",
    "steps": [
      {
        "name": "Sub-Assembly",
        "order": 0,
        "location": "Bay A",
        "optional": false,
        "dependencyType": "physical"
      },
      {
        "name": "Final Assembly",
        "order": 1,
        "location": "Bay B",
        "optional": false,
        "dependencyType": "physical"
      }
    ],
    "createdAt": "2024-01-12T14:00:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

### Response — No templates

```json
[]
```

## Notes

- Templates are returned with all their steps fully expanded. There is no summary or abbreviated mode.
- The `optional` and `dependencyType` fields on steps reflect the defaults assigned at creation time (`false` and `"physical"` respectively) unless they were explicitly set during an update.
- This endpoint does not support pagination or filtering. For most deployments, the number of templates is small enough that this is not a concern.

## Related Endpoints

- [Get Template](/api-docs/templates/get) — Retrieve a single template by ID
- [Create Template](/api-docs/templates/create) — Create a new template
- [Apply Template](/api-docs/templates/apply) — Apply a template to a job

::
