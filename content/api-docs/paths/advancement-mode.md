---
title: 'Update Advancement Mode'
description: "Change a path's advancement mode without modifying any other properties"
method: 'PATCH'
endpoint: '/api/paths/:id/advancement-mode'
service: 'pathService'
category: 'Paths'
requestBody: 'UpdateAdvancementModeInput'
responseType: 'Path'
errorCodes: [400, 404, 500]
navigation:
  order: 6
---

# Update Advancement Mode

::endpoint-card{method="PATCH" path="/api/paths/:id/advancement-mode"}

Updates only the advancement mode of an existing manufacturing path. This is a focused endpoint that changes how serial numbers advance through the path's steps without modifying the path's name, goal quantity, or step sequence. It delegates to the same `pathService.updatePath()` method as the general [Update Path](/api-docs/paths/update) endpoint, but accepts only the `advancementMode` field.

Use this endpoint when production conditions change and you need to relax or tighten step enforcement on a path. For example, switching from `"strict"` to `"flexible"` mid-production allows operators to skip optional steps that are causing bottlenecks, without requiring a full path update.

### Advancement Mode Reference

| Mode       | Behavior                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `strict`   | Serial numbers must complete every step in exact sequential order. No steps can be skipped or deferred. This is the safest mode for regulated manufacturing. |
| `flexible` | Serial numbers advance sequentially, but optional steps can be skipped and preferred-dependency steps can be deferred for later completion.                  |
| `per_step` | Each step's advancement behavior is determined by its individual `dependencyType` and `optional` settings. Provides the most granular control.               |

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                                        |
| --------- | -------- | -------- | ------------------------------------------------------------------ |
| `id`      | `string` | Yes      | The unique identifier of the path to update (e.g. `"path_xyz789"`) |

### Request Body

| Field             | Type                                   | Required | Description                                                                         |
| ----------------- | -------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `advancementMode` | `"strict" \| "flexible" \| "per_step"` | Yes      | The new advancement mode for the path. Must be one of the three valid mode strings. |

## Response

### 200 OK

Returned when the advancement mode is successfully updated. The response contains the complete `Path` object with all fields reflecting the current state after the update. The `updatedAt` timestamp is refreshed to the current time.

| Field             | Type                                   | Description                                                             |
| ----------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| `id`              | `string`                               | Unique identifier for the path (unchanged)                              |
| `jobId`           | `string`                               | The parent job's ID (unchanged)                                         |
| `name`            | `string`                               | The path name (unchanged)                                               |
| `goalQuantity`    | `number`                               | The goal quantity (unchanged)                                           |
| `advancementMode` | `"strict" \| "flexible" \| "per_step"` | The newly applied advancement mode                                      |
| `steps`           | `ProcessStep[]`                        | The process steps (unchanged)                                           |
| `createdAt`       | `string`                               | ISO 8601 timestamp of original creation (unchanged)                     |
| `updatedAt`       | `string`                               | ISO 8601 timestamp — refreshed to the current time on successful update |

#### `steps[]` — Process Step objects (unchanged)

| Field            | Type                                             | Description                              |
| ---------------- | ------------------------------------------------ | ---------------------------------------- |
| `id`             | `string`                                         | Unique identifier for the step           |
| `name`           | `string`                                         | Step name                                |
| `order`          | `number`                                         | Zero-based position in the step sequence |
| `location`       | `string \| undefined`                            | Physical location, if set                |
| `assignedTo`     | `string \| undefined`                            | Assigned operator user ID, if set        |
| `optional`       | `boolean`                                        | Whether the step is optional             |
| `dependencyType` | `"physical" \| "preferred" \| "completion_gate"` | Dependency enforcement type              |

### 400 Bad Request

Returned when the request body contains an invalid advancement mode value.

| Condition                                   | Message                                       |
| ------------------------------------------- | --------------------------------------------- |
| `advancementMode` is missing                | Validation error describing the missing field |
| `advancementMode` is not a valid enum value | Validation error describing the invalid value |

### 404 Not Found

Returned when no path exists with the given ID.

| Condition           | Message                  |
| ------------------- | ------------------------ |
| Path does not exist | `"Path not found: {id}"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while persisting the update to the database.

| Condition                    | Message                   |
| ---------------------------- | ------------------------- |
| Database write failure       | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request — Switch from strict to flexible

```bash
curl -X PATCH http://localhost:3000/api/paths/path_xyz789/advancement-mode \
  -H "Content-Type: application/json" \
  -d '{
    "advancementMode": "flexible"
  }'
```

### Response — Switch from strict to flexible

```json
{
  "id": "path_xyz789",
  "jobId": "job_abc123",
  "name": "Main Route",
  "goalQuantity": 40,
  "advancementMode": "flexible",
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
  "updatedAt": "2024-01-25T14:30:00.000Z"
}
```

### Request — Switch to per_step mode

```bash
curl -X PATCH http://localhost:3000/api/paths/path_xyz789/advancement-mode \
  -H "Content-Type: application/json" \
  -d '{
    "advancementMode": "per_step"
  }'
```

### Response — Switch to per_step mode

```json
{
  "id": "path_xyz789",
  "jobId": "job_abc123",
  "name": "Main Route",
  "goalQuantity": 40,
  "advancementMode": "per_step",
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
  "updatedAt": "2024-01-25T15:00:00.000Z"
}
```

### Request — Revert to strict mode

```bash
curl -X PATCH http://localhost:3000/api/paths/path_xyz789/advancement-mode \
  -H "Content-Type: application/json" \
  -d '{
    "advancementMode": "strict"
  }'
```

### Response — Revert to strict mode

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
  "updatedAt": "2024-01-25T15:30:00.000Z"
}
```

## Notes

- Changing the advancement mode does **not** retroactively affect serial numbers that have already advanced past steps. It only affects future advancement operations. Serials that skipped steps under `"flexible"` mode will not be forced back to those steps if you switch to `"strict"`.
- This endpoint modifies **only** the `advancementMode` field and the `updatedAt` timestamp. The path name, goal quantity, and step sequence are never touched. For broader updates, use the general [Update Path](/api-docs/paths/update) endpoint.
- Setting the mode to `"strict"` on a path with optional steps effectively disables the optional behavior — all steps must be completed in order regardless of their `optional` flag.
- Setting the mode to `"per_step"` gives the most granular control. In this mode, each step's `optional` and `dependencyType` fields determine whether it can be skipped, deferred, or must be completed as a gate.
- The `updatedAt` timestamp is refreshed even if the new mode is the same as the current mode.
- There is no optimistic concurrency control. If two clients update the advancement mode simultaneously, the last write wins.

## Related Endpoints

- [Get Path](/api-docs/paths/get) — Retrieve the current path state to check the existing advancement mode
- [Update Path](/api-docs/paths/update) — Update multiple path properties at once, including advancement mode
- [Create Path](/api-docs/paths/create) — Create a new path with a specific advancement mode

::
