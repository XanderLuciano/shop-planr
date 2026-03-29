---
title: 'Get User Queue'
description: 'Retrieve queue items for a specific operator'
method: 'GET'
endpoint: '/api/operator/queue/:userId'
service: 'jobService, pathService, serialService'
category: 'Operator'
responseType: 'WorkQueueResponse'
errorCodes: [400, 500]
navigation:
  order: 4
---

# Get User Queue

::endpoint-card{method="GET" path="/api/operator/queue/:userId"}

Retrieves all queue items across all jobs and paths, filtered to show work relevant to a specific operator. This endpoint powers the operator kiosk view where an individual operator sees only their assigned work.

Unlike the `_all` queue endpoint, this endpoint only includes steps that have at least one in-progress serial — first steps with zero serials are not included. The response shape is identical to the `_all` endpoint but with the `operatorId` set to the queried user ID.

Note that this endpoint currently returns **all** queue items regardless of assignment, not just those assigned to the specified user. The `userId` parameter is recorded in the response's `operatorId` field for client-side filtering. The frontend uses this to filter the displayed items by the selected operator.

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                                 |
| --------- | -------- | -------- | ----------------------------------------------------------- |
| `userId`  | `string` | Yes      | The user ID to filter the queue for (e.g. `"user_a1b2c3"`). |

## Response

### 200 OK

Returns a `WorkQueueResponse` object.

| Field        | Type             | Description                      |
| ------------ | ---------------- | -------------------------------- |
| `operatorId` | `string`         | The queried user ID              |
| `jobs`       | `WorkQueueJob[]` | Array of queue items             |
| `totalParts` | `number`         | Total count of in-progress parts |

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

### 400 Bad Request

| Condition           | Message                |
| ------------------- | ---------------------- |
| `userId` is missing | `"userId is required"` |

### 500 Internal Server Error

| Condition                | Message                   |
| ------------------------ | ------------------------- |
| Unexpected runtime error | `"Internal Server Error"` |

## Examples

### Request

```bash
curl http://localhost:3000/api/operator/queue/user_a1b2c3
```

### Response — Operator has active work

```json
{
  "operatorId": "user_a1b2c3",
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
      "serialIds": ["sn_00020"],
      "partCount": 1,
      "nextStepName": "Final Check",
      "isFinalStep": false
    }
  ],
  "totalParts": 4
}
```

### Response — No active work

```json
{
  "operatorId": "user_a1b2c3",
  "jobs": [],
  "totalParts": 0
}
```

## Notes

- The endpoint does **not** validate that the `userId` corresponds to an existing user. Any string is accepted and echoed back in the `operatorId` field.
- Currently, the server returns all queue items regardless of assignment. Client-side filtering by `assignedTo` is expected. This may change in a future version to filter server-side.
- Steps with zero serials are excluded (unlike the `_all` endpoint which includes first steps with zero serials).
- Items are deduplicated by the composite key `jobId|pathId|stepOrder`.
- This endpoint does not include `previousStepId`/`previousStepName` fields.

## Related Endpoints

- [Get All Queue Items](/api-docs/operator/queue-all) — Unfiltered flat list including empty first steps
- [Get Work Queue](/api-docs/operator/work-queue) — Queue grouped by operator
- [List Users](/api-docs/users/list) — Get available user IDs for the `:userId` parameter

::
