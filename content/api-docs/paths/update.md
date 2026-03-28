---
title: "Update Path"
description: "Update an existing path's name, goal quantity, advancement mode, or process steps"
method: "PUT"
endpoint: "/api/paths/:id"
service: "pathService"
category: "Paths"
requestBody: "UpdatePathInput"
responseType: "Path"
errorCodes: [400, 404, 500]
navigation:
  order: 4
---

# Update Path

::endpoint-card{method="PUT" path="/api/paths/:id"}

Updates an existing manufacturing path. This endpoint supports partial updates — only the fields included in the request body are modified; omitted fields retain their current values. You can update any combination of `name`, `goalQuantity`, `advancementMode`, and `steps` in a single request.

When `steps` is included in the request body, the entire step sequence is replaced. Existing step IDs are discarded and new IDs are generated for every step in the replacement array. This is a full replacement, not a merge — if you want to add a step to an existing sequence, you must include all existing steps plus the new one in the `steps` array. Step `order` values are reassigned based on array index, just like during creation.

This endpoint is useful for adjusting production routes mid-run — renaming a path, changing the target quantity, switching advancement modes, or restructuring the step sequence when manufacturing requirements change.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The unique identifier of the path to update (e.g. `"path_xyz789"`) |

### Request Body

All fields are optional. Include only the fields you want to change. An empty body `{}` is technically valid but results in only the `updatedAt` timestamp being refreshed.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | No | The new name for the path. Must be a non-empty string if provided. Leading and trailing whitespace is trimmed. |
| `goalQuantity` | `number` | No | The new target quantity for this path. Must be a positive integer greater than zero if provided. |
| `advancementMode` | `"strict" \| "flexible" \| "per_step"` | No | The new advancement mode. Changes how serial numbers advance through steps on this path. |
| `steps` | `object[]` | No | A complete replacement for the path's step sequence. Must contain at least one step if provided. Replaces all existing steps — new IDs are generated and order values are reassigned from array index. |

#### `steps[]` — Step Definition objects (when replacing steps)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `string` | Yes | — | The name of the process step (e.g. `"CNC Machining"`, `"QC Inspection"`) |
| `location` | `string` | No | `undefined` | Physical workstation or bay where this step is performed |
| `optional` | `boolean` | No | `false` | Whether this step can be skipped without blocking advancement |
| `dependencyType` | `"physical" \| "preferred" \| "completion_gate"` | No | `"preferred"` | How strictly this step's completion is enforced |

## Response

### 200 OK

Returned when the path is successfully updated. The response contains the complete `Path` object with all fields reflecting the current state after the update. The `updatedAt` timestamp is refreshed to the current time.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the path (unchanged) |
| `jobId` | `string` | The parent job's ID (unchanged) |
| `name` | `string` | The path name — updated if provided in the request, otherwise unchanged |
| `goalQuantity` | `number` | The goal quantity — updated if provided, otherwise unchanged |
| `advancementMode` | `"strict" \| "flexible" \| "per_step"` | The advancement mode — updated if provided, otherwise unchanged |
| `steps` | `ProcessStep[]` | The process steps — fully replaced if provided, otherwise unchanged |
| `createdAt` | `string` | ISO 8601 timestamp of original creation (unchanged) |
| `updatedAt` | `string` | ISO 8601 timestamp — refreshed to the current time on successful update |

#### `steps[]` — Process Step objects (in response)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the step — new IDs if steps were replaced, existing IDs if steps were not updated |
| `name` | `string` | Step name |
| `order` | `number` | Zero-based position in the step sequence |
| `location` | `string \| undefined` | Physical location, if set |
| `assignedTo` | `string \| undefined` | Assigned operator user ID, if set (cleared when steps are replaced) |
| `optional` | `boolean` | Whether the step is optional |
| `dependencyType` | `"physical" \| "preferred" \| "completion_gate"` | Dependency enforcement type |

### 400 Bad Request

Returned when the request body contains invalid values. Validation is only applied to fields that are present in the request.

| Condition | Message |
|-----------|---------|
| `name` is provided but empty | `"name is required"` |
| `goalQuantity` is provided but zero or negative | `"goalQuantity must be greater than 0"` |
| `steps` is provided but empty array | `"steps is required"` |

### 404 Not Found

Returned when no path exists with the given ID. The path is looked up before any validation or update logic runs.

| Condition | Message |
|-----------|---------|
| Path does not exist | `"Path not found: {id}"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while persisting the update to the database.

| Condition | Message |
|-----------|---------|
| Database write failure | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request — Update name and goal quantity

```bash
curl -X PUT http://localhost:3000/api/paths/path_xyz789 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Primary Production Route",
    "goalQuantity": 60
  }'
```

### Response — Update name and goal quantity

```json
{
  "id": "path_xyz789",
  "jobId": "job_abc123",
  "name": "Primary Production Route",
  "goalQuantity": 60,
  "advancementMode": "strict",
  "steps": [
    {
      "id": "step_001",
      "name": "CNC Machining",
      "order": 0,
      "location": "Bay 3",
      "assignedTo": "user_op1",
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
      "assignedTo": "user_qc1",
      "optional": false,
      "dependencyType": "completion_gate"
    }
  ],
  "createdAt": "2024-01-15T11:00:00.000Z",
  "updatedAt": "2024-01-22T08:15:00.000Z"
}
```

### Request — Replace step sequence

```bash
curl -X PUT http://localhost:3000/api/paths/path_xyz789 \
  -H "Content-Type: application/json" \
  -d '{
    "steps": [
      {
        "name": "Laser Cutting",
        "location": "Bay 1",
        "dependencyType": "physical"
      },
      {
        "name": "Deburring",
        "location": "Bay 3",
        "dependencyType": "preferred"
      },
      {
        "name": "Surface Treatment",
        "location": "Bay 4",
        "optional": true,
        "dependencyType": "preferred"
      },
      {
        "name": "Final Inspection",
        "location": "QC Lab",
        "dependencyType": "completion_gate"
      }
    ]
  }'
```

### Response — Replace step sequence

```json
{
  "id": "path_xyz789",
  "jobId": "job_abc123",
  "name": "Primary Production Route",
  "goalQuantity": 60,
  "advancementMode": "strict",
  "steps": [
    {
      "id": "step_new01",
      "name": "Laser Cutting",
      "order": 0,
      "location": "Bay 1",
      "optional": false,
      "dependencyType": "physical"
    },
    {
      "id": "step_new02",
      "name": "Deburring",
      "order": 1,
      "location": "Bay 3",
      "optional": false,
      "dependencyType": "preferred"
    },
    {
      "id": "step_new03",
      "name": "Surface Treatment",
      "order": 2,
      "location": "Bay 4",
      "optional": true,
      "dependencyType": "preferred"
    },
    {
      "id": "step_new04",
      "name": "Final Inspection",
      "order": 3,
      "location": "QC Lab",
      "optional": false,
      "dependencyType": "completion_gate"
    }
  ],
  "createdAt": "2024-01-15T11:00:00.000Z",
  "updatedAt": "2024-01-22T10:30:00.000Z"
}
```

### Request — Switch advancement mode only

```bash
curl -X PUT http://localhost:3000/api/paths/path_xyz789 \
  -H "Content-Type: application/json" \
  -d '{
    "advancementMode": "flexible"
  }'
```

### Response — Switch advancement mode only

```json
{
  "id": "path_xyz789",
  "jobId": "job_abc123",
  "name": "Primary Production Route",
  "goalQuantity": 60,
  "advancementMode": "flexible",
  "steps": [
    {
      "id": "step_new01",
      "name": "Laser Cutting",
      "order": 0,
      "location": "Bay 1",
      "optional": false,
      "dependencyType": "physical"
    },
    {
      "id": "step_new02",
      "name": "Deburring",
      "order": 1,
      "location": "Bay 3",
      "optional": false,
      "dependencyType": "preferred"
    },
    {
      "id": "step_new03",
      "name": "Surface Treatment",
      "order": 2,
      "location": "Bay 4",
      "optional": true,
      "dependencyType": "preferred"
    },
    {
      "id": "step_new04",
      "name": "Final Inspection",
      "order": 3,
      "location": "QC Lab",
      "optional": false,
      "dependencyType": "completion_gate"
    }
  ],
  "createdAt": "2024-01-15T11:00:00.000Z",
  "updatedAt": "2024-01-22T11:00:00.000Z"
}
```

## Notes

- This is a **partial update** endpoint. You do not need to send the full path object — only the fields you want to change. Fields not included in the request body are left untouched.
- When `steps` is provided, the **entire step array is replaced**. All existing step IDs are discarded, new IDs are generated, and `order` values are reassigned from array index. Any `assignedTo` values on the old steps are lost. If you need to preserve step assignments, read the current path first and include the assignments in your update.
- The `jobId` field is **immutable** — it cannot be changed after creation. To move a path to a different job, you must delete it and create a new one.
- Changing `advancementMode` does **not** retroactively affect serial numbers that have already advanced past steps. It only affects future advancement operations.
- Changing `goalQuantity` does **not** affect existing serial numbers. If you reduce the goal below the number of already-created serials, the path will appear over-allocated.
- The `updatedAt` timestamp is refreshed on every successful update, even if the provided values are identical to the current values.
- There is no optimistic concurrency control (e.g., ETags). If two clients update the same path simultaneously, the last write wins.
- To update only the advancement mode, consider using the dedicated [Update Advancement Mode](/api-docs/paths/advancement-mode) endpoint instead.

## Related Endpoints

- [Get Path](/api-docs/paths/get) — Retrieve the current state of a path with step distribution
- [Create Path](/api-docs/paths/create) — Create a new manufacturing path
- [Delete Path](/api-docs/paths/delete) — Remove a path
- [Update Advancement Mode](/api-docs/paths/advancement-mode) — Change only the advancement mode
- [Get Job](/api-docs/jobs/get) — Retrieve the parent job with all paths and progress

::
