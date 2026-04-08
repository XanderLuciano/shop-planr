---
title: "Get All Queue Items"
description: "Retrieve all items in the operator queue as a flat list"
method: "GET"
endpoint: "/api/operator/queue/_all"
service: "jobService, pathService, serialService"
category: "Operator"
responseType: "WorkQueueResponse"
errorCodes: [500]
navigation:
  order: 3
---

# Get All Queue Items

::endpoint-card{method="GET" path="/api/operator/queue/_all"}

Retrieves all items in the operator queue as a flat (ungrouped) list. Unlike the grouped work queue endpoint, this returns every active step/job/path combination without grouping, making it suitable for the "All" tab in the Parts View page.

### First-Step Behavior

The **first active step** in each path (the first non-soft-deleted step) is always included in the response when `completedCount < goalQuantity`, even if it has zero parts currently present. This ensures the serial creation panel is accessible for paths that still need parts fabricated. Once `completedCount >= goalQuantity`, the step follows normal inclusion rules (only shown if it has parts). Soft-deleted steps (`removedAt` set) are always excluded.

Each item is keyed by the combination of `jobId|pathId|stepOrder` to prevent duplicates.

## Request

No request body or query parameters.

## Response

### 200 OK

Returns a `WorkQueueResponse` object.

| Field | Type | Description |
|-------|------|-------------|
| `jobs` | `WorkQueueJob[]` | Array of all queue items |
| `totalParts` | `number` | Total count of in-progress parts across all items |

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
| `partIds` | `string[]` | Part IDs at this step (may be empty for first-step entries) |
| `partCount` | `number` | Count of parts at this step |
| `assignedTo` | `string \| undefined` | Assigned operator user ID |
| `nextStepName` | `string \| undefined` | Name of the next step |
| `nextStepLocation` | `string \| undefined` | Location of the next step |
| `isFinalStep` | `boolean` | Whether this is the last step |
| `jobPriority` | `number` | Job priority (lower = higher priority) |
| `goalQuantity` | `number \| undefined` | Path goal quantity — only set on first-active-step entries |
| `completedCount` | `number \| undefined` | Parts that have advanced past this step — only set on first-active-step entries |

### 500 Internal Server Error

| Condition | Message |
|-----------|---------|
| Unexpected runtime error | `"Internal server error"` |

## Examples

### Request

```bash
curl http://localhost:3000/api/operator/queue/_all
```

### Response — Mixed items including first-step entry

```json
{
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
      "partIds": ["sn_00001", "sn_00002"],
      "partCount": 2,
      "nextStepName": "Deburring",
      "nextStepLocation": "Bay 2",
      "isFinalStep": false,
      "jobPriority": 1
    },
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
      "partIds": ["sn_00010"],
      "partCount": 1,
      "nextStepName": "Packaging",
      "isFinalStep": false,
      "jobPriority": 1
    },
    {
      "jobId": "job_def456",
      "jobName": "JOB-2024-002",
      "pathId": "path_uvw321",
      "pathName": "Express Route",
      "stepId": "step_010",
      "stepName": "Assembly",
      "stepOrder": 0,
      "totalSteps": 2,
      "partIds": [],
      "partCount": 0,
      "nextStepName": "Final Check",
      "isFinalStep": false,
      "jobPriority": 2,
      "goalQuantity": 50,
      "completedCount": 12
    }
  ],
  "totalParts": 3
}
```

### Response — No active work

```json
{
  "jobs": [],
  "totalParts": 0
}
```

## Notes

- The **first active step** (first non-soft-deleted step) in each path is included even with zero parts, as long as `completedCount < goalQuantity`. Once `completedCount >= goalQuantity`, the step follows normal inclusion rules.
- First-active-step entries include `goalQuantity` and `completedCount` fields so the frontend can display progress (e.g., "12 / 50 completed"). Non-first-active-step entries do not include these fields.
- Soft-deleted steps (`removedAt` set) are always excluded and are never considered as the first active step.
- Non-first-active steps with zero parts are excluded to keep the queue focused on active work.
- Items are deduplicated by the composite key `jobId|pathId|stepOrder`. Each unique step instance appears at most once.
- The `totalParts` count only includes parts that are actually at a step (not the zero-part first-step entries).
- This endpoint does not include `previousStepId`/`previousStepName` fields.

## Related Endpoints

- [Get Work Queue](/api-docs/operator/work-queue) — Same data grouped by dimension (user, location, or step)
- [Get Step View](/api-docs/operator/step-view) — Detailed view for a specific step

::
