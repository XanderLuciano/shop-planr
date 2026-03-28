---
title: "Create Path"
description: "Create a new manufacturing path with ordered process steps for a production job"
method: "POST"
endpoint: "/api/paths"
service: "pathService"
category: "Paths"
requestBody: "CreatePathInput"
responseType: "Path"
errorCodes: [400, 404, 500]
navigation:
  order: 3
---

# Create Path

::endpoint-card{method="POST" path="/api/paths"}

Creates a new manufacturing path attached to an existing production job. A path defines the ordered sequence of process steps that serial numbers will travel through during production. Every path requires a parent job ID, a human-readable name, a goal quantity, and at least one process step.

Steps are provided as an ordered array — the array index determines each step's `order` value (zero-based). Each step can optionally specify a physical location, whether it is optional, and a dependency type that controls how strictly its completion is enforced. If `advancementMode` is not specified, it defaults to `"strict"`, requiring serial numbers to complete every step in exact order.

After creating a path, the next step is typically to create serial numbers against it using the [Serials API](/api-docs/serials). Serial numbers are the individual units that advance through the path's steps.

## Request

### Request Body

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `jobId` | `string` | Yes | — | The unique identifier of the parent job this path belongs to (e.g. `"job_abc123"`). The job must already exist. |
| `name` | `string` | Yes | — | A human-readable name for the path (e.g. `"Main Route"`, `"Rework Path"`). Must be a non-empty string. Leading and trailing whitespace is trimmed. |
| `goalQuantity` | `number` | Yes | — | The target number of units to produce on this path. Must be a positive integer greater than zero. |
| `advancementMode` | `"strict" \| "flexible" \| "per_step"` | No | `"strict"` | Controls how serial numbers advance through steps. `strict` requires sequential completion of all steps. `flexible` allows skipping optional steps. `per_step` defers to each step's individual configuration. |
| `steps` | `object[]` | Yes | — | An ordered array of process step definitions. Must contain at least one step. Array order determines step sequence (index 0 = first step). |

#### `steps[]` — Step Definition objects

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `string` | Yes | — | The name of the process step (e.g. `"CNC Machining"`, `"QC Inspection"`). Describes the manufacturing operation performed at this step. |
| `location` | `string` | No | `undefined` | The physical workstation, bay, or area where this step is performed (e.g. `"Bay 3"`, `"QC Lab"`). Used for operator routing and dashboard display. |
| `optional` | `boolean` | No | `false` | Whether this step can be skipped without blocking serial advancement. Only relevant when `advancementMode` is `"flexible"` or `"per_step"`. |
| `dependencyType` | `"physical" \| "preferred" \| "completion_gate"` | No | `"preferred"` | How strictly this step's completion is enforced. `physical` = must be performed, `preferred` = should be completed but can be bypassed, `completion_gate` = hard gate that blocks all downstream steps. |

## Response

### 201 Created

Returned when the path is successfully created. The response contains the complete `Path` object with server-generated fields (`id`, step `id`s, `order` values, `createdAt`, `updatedAt`).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Server-generated unique identifier for the new path |
| `jobId` | `string` | The parent job's ID as provided in the request |
| `name` | `string` | The path name as provided (trimmed) |
| `goalQuantity` | `number` | The goal quantity as provided |
| `advancementMode` | `"strict" \| "flexible" \| "per_step"` | The advancement mode — either as provided or the default `"strict"` |
| `steps` | `ProcessStep[]` | The created process steps with server-generated IDs and computed order values |
| `createdAt` | `string` | ISO 8601 timestamp of when the path was created |
| `updatedAt` | `string` | ISO 8601 timestamp — same as `createdAt` for newly created paths |

#### `steps[]` — Created Process Step objects

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Server-generated unique identifier for the step (e.g. `"step_abc123"`) |
| `name` | `string` | Step name as provided in the request |
| `order` | `number` | Zero-based position derived from the step's index in the input array |
| `location` | `string \| undefined` | Physical location, if provided |
| `optional` | `boolean` | Whether the step is optional — `false` if not specified in the request |
| `dependencyType` | `"physical" \| "preferred" \| "completion_gate"` | Dependency type — `"preferred"` if not specified in the request |

### 400 Bad Request

Returned when the request body fails validation. Validation checks run in order: name, goal quantity, then steps.

| Condition | Message |
|-----------|---------|
| `name` is missing or empty | `"name is required"` |
| `goalQuantity` is missing | `"goalQuantity is required"` |
| `goalQuantity` is zero or negative | `"goalQuantity must be greater than 0"` |
| `steps` is missing or empty array | `"steps is required"` |

### 404 Not Found

Returned when the specified `jobId` does not match any existing job. The job existence check happens during path creation in the repository layer.

| Condition | Message |
|-----------|---------|
| Job does not exist | `"Job not found: {jobId}"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while persisting the path to the database.

| Condition | Message |
|-----------|---------|
| Database write failure | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request — Full payload with all step options

```bash
curl -X POST http://localhost:3000/api/paths \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job_abc123",
    "name": "Main Route",
    "goalQuantity": 40,
    "advancementMode": "strict",
    "steps": [
      {
        "name": "CNC Machining",
        "location": "Bay 3",
        "optional": false,
        "dependencyType": "physical"
      },
      {
        "name": "Deburring",
        "location": "Bay 3",
        "optional": false,
        "dependencyType": "preferred"
      },
      {
        "name": "QC Inspection",
        "location": "QC Lab",
        "optional": false,
        "dependencyType": "completion_gate"
      }
    ]
  }'
```

### Response — Full payload

```json
{
  "id": "path_xyz789",
  "jobId": "job_abc123",
  "name": "Main Route",
  "goalQuantity": 40,
  "advancementMode": "strict",
  "steps": [
    {
      "id": "step_001",
      "name": "CNC Machining",
      "order": 0,
      "location": "Bay 3",
      "optional": false,
      "dependencyType": "physical"
    },
    {
      "id": "step_002",
      "name": "Deburring",
      "order": 1,
      "location": "Bay 3",
      "optional": false,
      "dependencyType": "preferred"
    },
    {
      "id": "step_003",
      "name": "QC Inspection",
      "order": 2,
      "location": "QC Lab",
      "optional": false,
      "dependencyType": "completion_gate"
    }
  ],
  "createdAt": "2024-01-15T11:00:00.000Z",
  "updatedAt": "2024-01-15T11:00:00.000Z"
}
```

### Request — Minimal payload (defaults applied)

```bash
curl -X POST http://localhost:3000/api/paths \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job_abc123",
    "name": "Simple Path",
    "goalQuantity": 10,
    "steps": [
      { "name": "Assembly" },
      { "name": "Testing" }
    ]
  }'
```

### Response — Minimal payload (defaults applied)

```json
{
  "id": "path_min001",
  "jobId": "job_abc123",
  "name": "Simple Path",
  "goalQuantity": 10,
  "advancementMode": "strict",
  "steps": [
    {
      "id": "step_m01",
      "name": "Assembly",
      "order": 0,
      "optional": false,
      "dependencyType": "preferred"
    },
    {
      "id": "step_m02",
      "name": "Testing",
      "order": 1,
      "optional": false,
      "dependencyType": "preferred"
    }
  ],
  "createdAt": "2024-01-16T09:00:00.000Z",
  "updatedAt": "2024-01-16T09:00:00.000Z"
}
```

### Request — Flexible path with optional steps

```bash
curl -X POST http://localhost:3000/api/paths \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job_abc123",
    "name": "Rework Path",
    "goalQuantity": 5,
    "advancementMode": "flexible",
    "steps": [
      {
        "name": "Rework Station",
        "location": "Bay 5",
        "dependencyType": "physical"
      },
      {
        "name": "Optional Polish",
        "location": "Bay 5",
        "optional": true,
        "dependencyType": "preferred"
      },
      {
        "name": "Re-Inspection",
        "location": "QC Lab",
        "dependencyType": "completion_gate"
      }
    ]
  }'
```

### Response — Flexible path with optional steps

```json
{
  "id": "path_rw001",
  "jobId": "job_abc123",
  "name": "Rework Path",
  "goalQuantity": 5,
  "advancementMode": "flexible",
  "steps": [
    {
      "id": "step_rw01",
      "name": "Rework Station",
      "order": 0,
      "location": "Bay 5",
      "optional": false,
      "dependencyType": "physical"
    },
    {
      "id": "step_rw02",
      "name": "Optional Polish",
      "order": 1,
      "location": "Bay 5",
      "optional": true,
      "dependencyType": "preferred"
    },
    {
      "id": "step_rw03",
      "name": "Re-Inspection",
      "order": 2,
      "location": "QC Lab",
      "optional": false,
      "dependencyType": "completion_gate"
    }
  ],
  "createdAt": "2024-01-17T14:30:00.000Z",
  "updatedAt": "2024-01-17T14:30:00.000Z"
}
```

## Notes

- Step `order` values are assigned automatically based on array index. The first step in the array gets `order: 0`, the second gets `order: 1`, and so on. You cannot specify order values in the request — they are always derived from position.
- Step `id` values are generated server-side and cannot be specified in the request body.
- The `advancementMode` defaults to `"strict"` if omitted. In strict mode, the `optional` and `dependencyType` fields on steps are still stored but have no effect — every step must be completed in order regardless.
- When `optional` is not specified for a step, it defaults to `false`. When `dependencyType` is not specified, it defaults to `"preferred"`.
- There is no uniqueness constraint on path names within a job. Multiple paths can share the same name, though this is not recommended for clarity.
- Creating a path does not automatically create any serial numbers. You must explicitly create serials via the [Serials API](/api-docs/serials) after the path exists.
- The `goalQuantity` on a path is independent of the parent job's `goalQuantity`. Path-level goals do not need to sum to the job-level goal.

## Related Endpoints

- [Get Path](/api-docs/paths/get) — Retrieve a path with step distribution data
- [Update Path](/api-docs/paths/update) — Modify a path's name, goal, mode, or steps
- [Delete Path](/api-docs/paths/delete) — Remove a path
- [Get Job](/api-docs/jobs/get) — Retrieve the parent job with all paths and progress
- [Create Serials](/api-docs/serials/batch-create) — Create serial numbers against this path
- [Apply Template](/api-docs/templates/apply) — Create a path from a saved route template

::
