---
title: "Get Path"
description: "Retrieve a single path with its process steps and real-time step distribution"
method: "GET"
endpoint: "/api/paths/:id"
service: "pathService"
category: "Paths"
responseType: "Path & { distribution: StepDistribution[]; completedCount: number }"
errorCodes: [404, 500]
navigation:
  order: 2
---

# Get Path

::endpoint-card{method="GET" path="/api/paths/:id"}

Retrieves a single manufacturing path by its unique identifier, enriched with real-time step distribution data. This endpoint combines three service calls — `pathService.getPath(id)` to fetch the path record, `pathService.getStepDistribution(id)` to compute where serial numbers are currently positioned across the path's steps, and `pathService.getPathCompletedCount(id)` to count parts that have finished all steps.

The response includes the full path object (name, goal quantity, advancement mode, and ordered process steps) merged with a `distribution` array that provides a per-step breakdown of serial counts and bottleneck detection, plus a top-level `completedCount` integer representing parts that have completed the entire path. This is the primary endpoint for building path detail views and production flow dashboards.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The unique identifier of the path to retrieve (e.g. `"path_xyz789"`) |

## Response

### 200 OK

Returned when the path is found. The response is a single object containing all `Path` fields, a `distribution` array with real-time serial number positioning data, and a top-level `completedCount` integer.

#### Path Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the path |
| `jobId` | `string` | The parent job's unique identifier |
| `name` | `string` | Human-readable path name (e.g. `"Main Route"`, `"Rework Path"`) |
| `goalQuantity` | `number` | Target number of units to produce on this path |
| `advancementMode` | `"strict" \| "flexible" \| "per_step"` | How serial numbers advance through steps on this path |
| `steps` | `ProcessStep[]` | Ordered array of process steps (see below) |
| `createdAt` | `string` | ISO 8601 timestamp of when the path was created |
| `updatedAt` | `string` | ISO 8601 timestamp of the last modification |

#### `steps[]` — Process Step objects

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the step |
| `name` | `string` | Step name describing the operation (e.g. `"CNC Machining"`, `"QC Inspection"`) |
| `order` | `number` | Zero-based position of this step in the path sequence |
| `location` | `string \| undefined` | Physical workstation or bay where this step is performed |
| `assignedTo` | `string \| undefined` | User ID of the operator assigned to this step |
| `optional` | `boolean` | Whether this step can be skipped without blocking advancement |
| `dependencyType` | `"physical" \| "preferred" \| "completion_gate"` | How strictly this step's completion is enforced |

#### `distribution[]` — Step Distribution objects

The distribution array contains one entry per step, computed in real time from the current state of all serial numbers on this path. It is not stored — it is recalculated on every request.

| Field | Type | Description |
|-------|------|-------------|
| `stepId` | `string` | The step's unique identifier (matches a `steps[].id` value) |
| `stepName` | `string` | Human-readable step name |
| `stepOrder` | `number` | Zero-based position in the step sequence |
| `location` | `string \| undefined` | Physical location of the step, if set |
| `serialCount` | `number` | Number of serial numbers currently at this step (work-in-progress) |
| `completedCount` | `number` | Always `0` — per-step completion is not independently tracked. Path-level completion is returned as a top-level `completedCount` field. |
| `isBottleneck` | `boolean` | `true` if this step has the highest `serialCount` among all steps — indicates a production bottleneck |

#### Top-level `completedCount`

| Field | Type | Description |
|-------|------|-------------|
| `completedCount` | `number` | Count of parts that have completed all steps in this path (i.e., `currentStepIndex === -1`). This is the value displayed in the "Done" card. |

### 404 Not Found

Returned when no path exists with the given ID. The path lookup happens before the distribution computation, so a missing path short-circuits immediately.

| Condition | Message |
|-----------|---------|
| Path does not exist | `"Path not found: {id}"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while fetching the path or computing the step distribution.

| Condition | Message |
|-----------|---------|
| Database read failure | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request

```bash
curl -X GET http://localhost:3000/api/paths/path_xyz789 \
  -H "Accept: application/json"
```

### Response — Path with active production

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
  "updatedAt": "2024-01-15T11:00:00.000Z",
  "distribution": [
    {
      "stepId": "step_001",
      "stepName": "CNC Machining",
      "stepOrder": 0,
      "location": "Bay 3",
      "serialCount": 12,
      "completedCount": 0,
      "isBottleneck": true
    },
    {
      "stepId": "step_002",
      "stepName": "Deburring",
      "stepOrder": 1,
      "location": "Bay 3",
      "serialCount": 5,
      "completedCount": 0,
      "isBottleneck": false
    },
    {
      "stepId": "step_003",
      "stepName": "QC Inspection",
      "stepOrder": 2,
      "location": "QC Lab",
      "serialCount": 3,
      "completedCount": 0,
      "isBottleneck": false
    }
  ],
  "completedCount": 8
}
```

### Response — Path with no serial numbers yet

```json
{
  "id": "path_new001",
  "jobId": "job_abc123",
  "name": "Alternate Route",
  "goalQuantity": 10,
  "advancementMode": "flexible",
  "steps": [
    {
      "id": "step_a01",
      "name": "Assembly",
      "order": 0,
      "location": "Bay 1",
      "optional": false,
      "dependencyType": "physical"
    },
    {
      "id": "step_a02",
      "name": "Testing",
      "order": 1,
      "optional": true,
      "dependencyType": "preferred"
    }
  ],
  "createdAt": "2024-01-20T09:00:00.000Z",
  "updatedAt": "2024-01-20T09:00:00.000Z",
  "distribution": [
    {
      "stepId": "step_a01",
      "stepName": "Assembly",
      "stepOrder": 0,
      "location": "Bay 1",
      "serialCount": 0,
      "completedCount": 0,
      "isBottleneck": false
    },
    {
      "stepId": "step_a02",
      "stepName": "Testing",
      "stepOrder": 1,
      "serialCount": 0,
      "completedCount": 0,
      "isBottleneck": false
    }
  ],
  "completedCount": 0
}
```

## Notes

- The `distribution` array is **computed on every request** from the current state of all serial numbers on this path. It is not cached or stored. For paths with many serial numbers, this computation may take slightly longer.
- The `completedCount` at the top level represents the total number of serials that have finished the entire path (i.e., `currentStepIndex === -1`). Each distribution entry's `completedCount` is always `0` — per-step completion is not independently tracked since parts advance sequentially through all steps.
- The `isBottleneck` flag is set on the step(s) with the highest `serialCount`. If multiple steps are tied for the highest count, all of them are flagged as bottlenecks. If no serials are in progress, no step is flagged.
- The `steps` array is ordered by the `order` field. Always use `order` to determine step sequence rather than array index.
- The `assignedTo` field on steps contains a user ID, not a display name. Use the Users API to resolve display names if needed.

## Related Endpoints

- [Create Path](/api-docs/paths/create) — Define a new manufacturing route for a job
- [Update Path](/api-docs/paths/update) — Modify a path's name, goal, mode, or steps
- [Delete Path](/api-docs/paths/delete) — Remove a path
- [Get Job](/api-docs/jobs/get) — Retrieve the parent job with all paths and progress
- [Create Serials](/api-docs/serials/batch-create) — Create serial numbers against this path

::
