---
title: 'Get All Queue Items'
description: 'Retrieve all items in the operator queue as a flat list'
method: 'GET'
endpoint: '/api/operator/queue/_all'
service: 'jobService, pathService, serialService'
category: 'Operator'
responseType: 'WorkQueueResponse'
errorCodes: [500]
navigation:
  order: 3
---

# Get All Queue Items

::endpoint-card{method="GET" path="/api/operator/queue/\_all"}

Retrieves all items in the operator queue as a flat (ungrouped) list. Unlike the grouped work queue endpoint, this returns every active step/job/path combination without operator grouping, making it suitable for the "All" tab in the Parts View page.

A key difference from other queue endpoints: **first steps (order 0) are always included**, even when they have zero serials. This ensures the serial creation panel is accessible for paths that haven't had any serials created yet. Non-first steps are only included when they have at least one serial.

Each item is keyed by the combination of `jobId|pathId|stepOrder` to prevent duplicates.

## Request

No request body or query parameters.

## Response

### 200 OK

Returns a `WorkQueueResponse` object.

| Field        | Type             | Description                                       |
| ------------ | ---------------- | ------------------------------------------------- |
| `operatorId` | `string`         | Always `"_all"` for this endpoint                 |
| `jobs`       | `WorkQueueJob[]` | Array of all queue items                          |
| `totalParts` | `number`         | Total count of in-progress parts across all items |

#### WorkQueueJob Fields

| Field              | Type                  | Description                                            |
| ------------------ | --------------------- | ------------------------------------------------------ |
| `jobId`            | `string`              | Job ID                                                 |
| `jobName`          | `string`              | Job name                                               |
| `pathId`           | `string`              | Path ID                                                |
| `pathName`         | `string`              | Path name                                              |
| `stepId`           | `string`              | Step ID                                                |
| `stepName`         | `string`              | Step name                                              |
| `stepOrder`        | `number`              | Zero-based step index                                  |
| `stepLocation`     | `string \| undefined` | Physical location                                      |
| `totalSteps`       | `number`              | Total steps in the path                                |
| `serialIds`        | `string[]`            | Serial IDs at this step (may be empty for first steps) |
| `partCount`        | `number`              | Count of serials at this step                          |
| `nextStepName`     | `string \| undefined` | Name of the next step                                  |
| `nextStepLocation` | `string \| undefined` | Location of the next step                              |
| `isFinalStep`      | `boolean`             | Whether this is the last step                          |

### 500 Internal Server Error

| Condition                | Message                   |
| ------------------------ | ------------------------- |
| Unexpected runtime error | `"Internal server error"` |

## Examples

### Request

```bash
curl http://localhost:3000/api/operator/queue/_all
```

### Response — Mixed items including empty first step

```json
{
  "operatorId": "_all",
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
      "serialIds": ["sn_00001", "sn_00002"],
      "partCount": 2,
      "nextStepName": "Deburring",
      "nextStepLocation": "Bay 2",
      "isFinalStep": false
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
      "serialIds": ["sn_00010"],
      "partCount": 1,
      "nextStepName": "Packaging",
      "isFinalStep": false
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
      "serialIds": [],
      "partCount": 0,
      "nextStepName": "Final Check",
      "isFinalStep": false
    }
  ],
  "totalParts": 3
}
```

### Response — No active work

```json
{
  "operatorId": "_all",
  "jobs": [],
  "totalParts": 0
}
```

## Notes

- The `operatorId` field is always the literal string `"_all"` for this endpoint. It does not represent an actual user.
- First steps (order 0) are included even with zero serials. This is the "step 1 always visible" behavior that ensures the serial creation panel is accessible in the Parts View.
- Non-first steps with zero serials are excluded to keep the queue focused on active work.
- Items are deduplicated by the composite key `jobId|pathId|stepOrder`. Each unique step instance appears at most once.
- The `totalParts` count only includes serials that are actually at a step (not the zero-serial first steps).
- This endpoint does not include `previousStepId`/`previousStepName` fields.

## Related Endpoints

- [Get Work Queue](/api-docs/operator/work-queue) — Same data grouped by operator
- [Get User Queue](/api-docs/operator/queue-user) — Queue filtered to a single operator
- [Get Step View](/api-docs/operator/step-view) — Detailed view for a specific step

::
