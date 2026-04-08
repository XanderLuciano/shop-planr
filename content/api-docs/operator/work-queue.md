---
title: "Get Work Queue"
description: "Retrieve the work queue grouped by user, location, or step"
method: "GET"
endpoint: "/api/operator/work-queue"
service: "jobService, pathService, serialService, userService"
category: "Operator"
responseType: "WorkQueueGroupedResponse"
errorCodes: [500]
navigation:
  order: 2
---

# Get Work Queue

::endpoint-card{method="GET" path="/api/operator/work-queue"}

Retrieves the work queue overview with all active steps grouped by a configurable dimension. This is the primary data source for the Work Queue page (`/queue`), providing a supervisor-level view of workload distribution across the shop floor.

The endpoint scans all jobs, paths, and steps, counts the in-progress parts at each step, and groups the results by the requested dimension (`user`, `location`, or `step`). Each group includes a label, its work items, and a total part count.

### First-Step Behavior

The **first active step** in each path (the first non-soft-deleted step) is always included when `completedCount < goalQuantity`, even if it has zero parts currently present. This ensures operators can see paths that still need initial part fabrication. Once `completedCount >= goalQuantity`, the step follows normal inclusion rules (only shown if it has parts). Soft-deleted steps (`removedAt` set) are always excluded.

First-active-step entries include `goalQuantity` and `completedCount` fields so the frontend can display progress (e.g., "12 / 50 completed"). Non-first-active-step entries with zero parts are excluded.

When grouped by `user`, unassigned steps are grouped under a special entry with `groupKey: null` and `groupLabel: "Unassigned"`.

## Request

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `groupBy` | `string` | `"location"` | Grouping dimension: `"user"`, `"location"`, or `"step"` |

## Response

### 200 OK

Returns a `WorkQueueGroupedResponse` object.

| Field | Type | Description |
|-------|------|-------------|
| `groups` | `WorkQueueGroup[]` | Array of groups, each containing work items for that grouping key |
| `totalParts` | `number` | Total count of in-progress parts across all groups |

#### WorkQueueGroup Fields

| Field | Type | Description |
|-------|------|-------------|
| `groupKey` | `string \| null` | Grouping key (user ID, location name, or step name), or `null` for unassigned/unknown |
| `groupLabel` | `string` | Human-readable label for the group (e.g. operator name, location, step name) |
| `groupType` | `GroupByDimension` | The dimension used: `"user"`, `"location"`, or `"step"` |
| `jobs` | `WorkQueueJob[]` | Array of work items in this group |
| `totalParts` | `number` | Total part count for this group |

#### WorkQueueJob Fields

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | `string` | Job ID |
| `jobName` | `string` | Job name |
| `pathId` | `string` | Path ID |
| `pathName` | `string` | Path name |
| `stepId` | `string` | Step ID |
| `stepName` | `string` | Step name |
| `stepOrder` | `number` | Zero-based step index |
| `stepLocation` | `string \| undefined` | Physical location |
| `totalSteps` | `number` | Total steps in the path |
| `partIds` | `string[]` | Part IDs at this step |
| `partCount` | `number` | Count of parts at this step |
| `previousStepId` | `string \| undefined` | ID of the previous step |
| `previousStepName` | `string \| undefined` | Name of the previous step |
| `nextStepId` | `string \| undefined` | ID of the next step |
| `nextStepName` | `string \| undefined` | Name of the next step |
| `nextStepLocation` | `string \| undefined` | Location of the next step |
| `isFinalStep` | `boolean` | Whether this is the last step |
| `stepOptional` | `boolean \| undefined` | Whether the step is optional |
| `assignedTo` | `string \| undefined` | Assigned operator user ID |
| `jobPriority` | `number` | Job priority (lower = higher priority) |
| `goalQuantity` | `number \| undefined` | Path goal quantity — only set on first-active-step entries |
| `completedCount` | `number \| undefined` | Parts that have advanced past this step — only set on first-active-step entries |

### 500 Internal Server Error

| Condition | Message |
|-----------|---------|
| Unexpected runtime error | `"Internal server error"` |

## Examples

### Request — Group by location (default)

```bash
curl http://localhost:3000/api/operator/work-queue
```

### Request — Group by user

```bash
curl http://localhost:3000/api/operator/work-queue?groupBy=user
```

### Response — Multiple groups (grouped by user)

```json
{
  "groups": [
    {
      "groupKey": "user_a1b2c3",
      "groupLabel": "Jane Smith",
      "groupType": "user",
      "jobs": [
        {
          "jobId": "job_abc123",
          "jobName": "JOB-2024-001",
          "pathId": "path_xyz789",
          "pathName": "Main Route",
          "stepId": "step_001",
          "stepName": "CNC Machining",
          "stepOrder": 0,
          "stepLocation": "Bay 1",
          "totalSteps": 4,
          "partIds": ["sn_00001", "sn_00002", "sn_00003"],
          "partCount": 3,
          "nextStepId": "step_002",
          "nextStepName": "Deburring",
          "nextStepLocation": "Bay 2",
          "isFinalStep": false,
          "jobPriority": 1
        }
      ],
      "totalParts": 3
    },
    {
      "groupKey": null,
      "groupLabel": "Unassigned",
      "groupType": "user",
      "jobs": [
        {
          "jobId": "job_abc123",
          "jobName": "JOB-2024-001",
          "pathId": "path_xyz789",
          "pathName": "Main Route",
          "stepId": "step_003",
          "stepName": "Inspection",
          "stepOrder": 2,
          "stepLocation": "QC Lab",
          "totalSteps": 4,
          "partIds": ["sn_00010", "sn_00011"],
          "partCount": 2,
          "nextStepId": "step_004",
          "nextStepName": "Packaging",
          "isFinalStep": false,
          "jobPriority": 1
        }
      ],
      "totalParts": 2
    }
  ],
  "totalParts": 5
}
```

### Response — No active work

```json
{
  "groups": [],
  "totalParts": 0
}
```

## Notes

- The **first active step** (first non-soft-deleted step) in each path is included even with zero parts, as long as `completedCount < goalQuantity`. Once `completedCount >= goalQuantity`, the step follows normal inclusion rules.
- First-active-step entries include `goalQuantity` and `completedCount` fields so the frontend can display progress. Non-first-active-step entries do not include these fields.
- Soft-deleted steps (`removedAt` set) are always excluded and are never considered as the first active step.
- When grouped by `user`, operator names are resolved from the user service. If a step is assigned to a user ID that no longer exists in the user table, the raw user ID is used as the label.
- When grouped by `location`, the grouping key is the step's `location` field. Steps without a location are grouped under `groupKey: null` with label `"No Location"`.
- When grouped by `step`, the grouping key is the step name.
- The `totalParts` at the response level is the sum of all `partCount` values across all groups.

## Related Endpoints

- [Get All Queue Items](/api-docs/operator/queue-all) — Flat list without grouping
- [Get Step View](/api-docs/operator/step-view) — Detailed view for a specific step

::
