---
title: 'Apply Template'
description: 'Apply a route template to a job, creating a new manufacturing path'
method: 'POST'
endpoint: '/api/templates/:id/apply'
service: 'templateService'
category: 'Templates'
requestBody: 'ApplyTemplateInput'
responseType: 'Path'
errorCodes: [400, 404, 500]
navigation:
  order: 6
---

# Apply Template

::endpoint-card{method="POST" path="/api/templates/:id/apply"}

Applies a route template to a job, creating a new manufacturing path with process steps cloned from the template. This is the primary mechanism for turning a reusable template into a live production route.

The operation performs a **deep clone** of the template's steps. Each step receives a fresh `step_`-prefixed ID, and the resulting path is completely independent of the source template. Future modifications to the template will not affect the created path, and vice versa.

The new path is created with `strict` advancement mode by default. You can change this after creation using the [Update Path Advancement Mode](/api-docs/paths/advancement-mode) endpoint.

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                                           |
| --------- | -------- | -------- | --------------------------------------------------------------------- |
| `id`      | `string` | Yes      | The unique identifier of the template to apply (e.g. `"tmpl_abc123"`) |

### Request Body

| Field          | Type     | Required | Description                                                                                       |
| -------------- | -------- | -------- | ------------------------------------------------------------------------------------------------- |
| `jobId`        | `string` | Yes      | The ID of the job to create the path on. Must reference an existing job.                          |
| `pathName`     | `string` | No       | A custom name for the new path. If omitted, the template's name is used as the path name.         |
| `goalQuantity` | `number` | Yes      | The target number of units to produce on this path. Must be a positive integer greater than zero. |

## Response

### 201 Created

Returned when the path is successfully created from the template. The response contains the complete `Path` object with all cloned steps.

| Field                    | Type                                             | Description                                                                 |
| ------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------- |
| `id`                     | `string`                                         | Server-generated unique identifier for the new path (prefixed with `path_`) |
| `jobId`                  | `string`                                         | The job this path belongs to                                                |
| `name`                   | `string`                                         | The path name — either the custom `pathName` or the template's name         |
| `goalQuantity`           | `number`                                         | The goal quantity as provided in the request                                |
| `steps`                  | `ProcessStep[]`                                  | Process steps cloned from the template, each with a fresh ID                |
| `steps[].id`             | `string`                                         | Server-generated step ID (prefixed with `step_`)                            |
| `steps[].name`           | `string`                                         | Step name from the template                                                 |
| `steps[].order`          | `number`                                         | Zero-based position from the template                                       |
| `steps[].location`       | `string \| undefined`                            | Location from the template, if any                                          |
| `steps[].optional`       | `boolean`                                        | Whether the step is optional (from template, defaults to `false`)           |
| `steps[].dependencyType` | `'physical' \| 'preferred' \| 'completion_gate'` | Dependency type (from template, defaults to `"preferred"`)                  |
| `advancementMode`        | `'strict' \| 'flexible' \| 'per_step'`           | Always `"strict"` for newly applied templates                               |
| `createdAt`              | `string`                                         | ISO 8601 timestamp of when the path was created                             |
| `updatedAt`              | `string`                                         | ISO 8601 timestamp — same as `createdAt` for newly created paths            |

### 400 Bad Request

Returned when the request body fails validation.

| Condition                          | Message                                    |
| ---------------------------------- | ------------------------------------------ |
| `jobId` is missing or empty        | `"jobId is required"`                      |
| `goalQuantity` is missing          | `"goalQuantity is required"`               |
| `goalQuantity` is zero or negative | `"goalQuantity must be greater than zero"` |

### 404 Not Found

Returned when the template or the referenced job does not exist.

| Condition               | Message                                  |
| ----------------------- | ---------------------------------------- |
| Template does not exist | `"TemplateRoute not found: tmpl_abc123"` |
| Job does not exist      | `"Job not found: job_xyz"`               |

### 500 Internal Server Error

Returned if an unhandled error occurs while creating the path.

| Condition              | Message                   |
| ---------------------- | ------------------------- |
| Database write failure | `"Internal Server Error"` |

## Examples

### Request — Apply with custom path name

```bash
curl -X POST http://localhost:3000/api/templates/tmpl_abc123/apply \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job_abc123",
    "pathName": "Assembly Line A — Batch 1",
    "goalQuantity": 100
  }'
```

### Response — Path created with custom name

```json
{
  "id": "path_xyz789",
  "jobId": "job_abc123",
  "name": "Assembly Line A — Batch 1",
  "goalQuantity": 100,
  "steps": [
    {
      "id": "step_001",
      "name": "Raw Material Inspection",
      "order": 0,
      "location": "QC Lab",
      "optional": false,
      "dependencyType": "preferred"
    },
    {
      "id": "step_002",
      "name": "CNC Milling",
      "order": 1,
      "location": "CNC Room",
      "optional": false,
      "dependencyType": "preferred"
    },
    {
      "id": "step_003",
      "name": "Deburring",
      "order": 2,
      "location": "Finishing Bay",
      "optional": false,
      "dependencyType": "preferred"
    },
    {
      "id": "step_004",
      "name": "Final Inspection",
      "order": 3,
      "location": "QC Lab",
      "optional": false,
      "dependencyType": "preferred"
    }
  ],
  "advancementMode": "strict",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### Request — Apply with default name

```bash
curl -X POST http://localhost:3000/api/templates/tmpl_def456/apply \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job_def456",
    "goalQuantity": 50
  }'
```

### Response — Path uses template name

```json
{
  "id": "path_uvw321",
  "jobId": "job_def456",
  "name": "Quick Assembly",
  "goalQuantity": 50,
  "steps": [
    {
      "id": "step_005",
      "name": "Assembly",
      "order": 0,
      "optional": false,
      "dependencyType": "preferred"
    },
    {
      "id": "step_006",
      "name": "Test",
      "order": 1,
      "optional": false,
      "dependencyType": "preferred"
    }
  ],
  "advancementMode": "strict",
  "createdAt": "2024-01-15T11:00:00.000Z",
  "updatedAt": "2024-01-15T11:00:00.000Z"
}
```

## Notes

- Applying a template is a **deep-clone** operation. The created path and its steps are completely independent of the source template. Modifying or deleting the template afterward has no effect on the path.
- Each step in the new path receives a fresh `step_`-prefixed ID. These IDs are different from any IDs on the template's steps (templates use name-based step definitions, not ID-based).
- The `advancementMode` on the new path is always `"strict"` regardless of any setting on the template. Change it after creation via the [Paths API](/api-docs/paths/advancement-mode).
- You can apply the same template to the same job multiple times to create multiple paths (e.g., for different production batches).
- The `pathName` field is optional. When omitted, the template's `name` is used as the path name. This is useful when you want the path to inherit the template's identity.
- After applying a template, the next step is typically to create serial numbers against the new path using the [Serials API](/api-docs/serials).

## Related Endpoints

- [Get Template](/api-docs/templates/get) — Preview a template before applying it
- [Create Path](/api-docs/paths/create) — Create a path manually without a template
- [Create Serials](/api-docs/serials/create) — Create serial numbers on the new path
- [Update Path Advancement Mode](/api-docs/paths/advancement-mode) — Change the advancement mode after applying

::
