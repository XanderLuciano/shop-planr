---
title: 'Get Work Queue'
description: 'Retrieve the work queue grouped by assigned operator'
method: 'GET'
endpoint: '/api/operator/work-queue'
service: 'jobService, pathService, serialService, userService'
category: 'Operator'
responseType: 'WorkQueueGroupedResponse'
errorCodes: [500]
navigation:
  order: 2
---

# Get Work Queue

::endpoint-card{method="GET" path="/api/operator/work-queue"}

Retrieves the work queue overview with all active steps grouped by assigned operator. This is the primary data source for the Work Queue page (`/queue`), providing a supervisor-level view of workload distribution across the shop floor.

The endpoint scans all jobs, paths, and steps, counts the in-progress serials at each step, and groups the results by the step's `assignedTo` user ID. Steps with zero serials are excluded. Each group includes the operator's name (resolved from the user service), their assigned work items, and a total part count.

Unassigned steps (where `assignedTo` is `null` or undefined) are grouped under a special entry with `operatorId: null` and `operatorName: "Unassigned"`.

## Request

No request body or query parameters.

## Response

### 200 OK

Returns a `WorkQueueGroupedResponse` object.

| Field        | Type              | Description                                                   |
| ------------ | ----------------- | ------------------------------------------------------------- |
| `groups`     | `OperatorGroup[]` | Array of operator groups, each containing their assigned work |
| `totalParts` | `number`          | Total count of in-progress parts across all groups            |

#### OperatorGroup Fields

| Field          | Type             | Description                                            |
| -------------- | ---------------- | ------------------------------------------------------ |
| `operatorId`   | `string \| null` | User ID of the operator, or `null` for unassigned work |
| `operatorName` | `string`         | Display name of the operator, or `"Unassigned"`        |
| `jobs`         | `WorkQueueJob[]` | Array of work items assigned to this operator          |
| `totalParts`   | `number`         | Total part count for this operator                     |

#### WorkQueueJob Fields

| Field              | Type                  | Description                   |
| ------------------ | --------------------- | ----------------------------- |
| `jobId`            | `string`              | Job ID                        |
| `jobName`          | `string`              | Job name                      |
| `pathId`           | `string`              | Path ID                       |
| `pathName`         | `string`              | Path name                     |
| `stepId`           | `string`              | Step ID                       |
| `stepName`         | `string`              | Step name                     |
| `stepOrder`        | `number`              | Zero-based step index         |
| `stepLocation`     | `string \| undefined` | Physical location             |
| `totalSteps`       | `number`              | Total steps in the path       |
| `serialIds`        | `string[]`            | Serial IDs at this step       |
| `partCount`        | `number`              | Count of serials at this step |
| `nextStepName`     | `string \| undefined` | Name of the next step         |
| `nextStepLocation` | `string \| undefined` | Location of the next step     |
| `isFinalStep`      | `boolean`             | Whether this is the last step |

### 500 Internal Server Error

| Condition                | Message                   |
| ------------------------ | ------------------------- |
| Unexpected runtime error | `"Internal server error"` |

## Examples

### Request

```bash
curl http://localhost:3000/api/operator/work-queue
```

### Response — Multiple operators with work

```json
{
  "groups": [
    {
      "operatorId": "user_a1b2c3",
      "operatorName": "Jane Smith",
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
          "serialIds": ["sn_00001", "sn_00002", "sn_00003"],
          "partCount": 3,
          "nextStepName": "Deburring",
          "nextStepLocation": "Bay 2",
          "isFinalStep": false
        }
      ],
      "totalParts": 3
    },
    {
      "operatorId": null,
      "operatorName": "Unassigned",
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
          "serialIds": ["sn_00010", "sn_00011"],
          "partCount": 2,
          "nextStepName": "Packaging",
          "isFinalStep": false
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

- Only steps with at least one in-progress serial are included. Empty steps are excluded from the work queue.
- The `operatorName` is resolved from the user service. If a step is assigned to a user ID that no longer exists in the user table, the raw user ID is used as the name.
- The grouping key is the step's `assignedTo` field. If multiple steps across different jobs are assigned to the same operator, they all appear in that operator's group.
- The `totalParts` at the response level is the sum of all `partCount` values across all groups.
- This endpoint does not include `previousStepId`/`previousStepName` fields in the `WorkQueueJob` objects (unlike the step view endpoint).

## Related Endpoints

- [Get All Queue Items](/api-docs/operator/queue-all) — Flat list without operator grouping
- [Get User Queue](/api-docs/operator/queue-user) — Queue filtered to a single operator
- [Get Step View](/api-docs/operator/step-view) — Detailed view for a specific step

::
