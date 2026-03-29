---
title: 'Get Step View'
description: 'Retrieve the operator step view data for a specific step instance'
method: 'GET'
endpoint: '/api/operator/step/:stepId'
service: 'jobService, pathService, serialService, noteService'
category: 'Operator'
responseType: 'StepViewResponse'
errorCodes: [400, 404, 500]
navigation:
  order: 1
---

# Get Step View

::endpoint-card{method="GET" path="/api/operator/step/:stepId"}

Retrieves the complete operator step view data for a specific process step instance. This is the primary data source for the Step View page (`/parts/step/[stepId]`), providing everything needed to render the advancement panel, serial list, notes, and navigation controls in a single request.

The endpoint scans all jobs and paths to locate the step by ID, then assembles an aggregated response containing:

- **Job context** — The `WorkQueueJob` object with job/path names, serial IDs at the step, navigation to previous/next steps, and whether this is the final step.
- **Notes** — All step notes attached to this step (same data as `GET /api/notes/step/:id`).
- **Previous step WIP** — For non-first steps with zero serials at the current step, the count of serials at the previous step is included. This helps the UI show "X parts coming soon" context.

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                                                                  |
| --------- | -------- | -------- | -------------------------------------------------------------------------------------------- |
| `stepId`  | `string` | Yes      | The unique process step ID (e.g. `"step_001"`). This is the step's `id` field, not its name. |

## Response

### 200 OK

Returns a `StepViewResponse` object.

| Field                  | Type                  | Description                                                                                                           |
| ---------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `job`                  | `WorkQueueJob`        | Aggregated job/path/step data with serial list                                                                        |
| `notes`                | `StepNote[]`          | All notes attached to this step                                                                                       |
| `previousStepWipCount` | `number \| undefined` | Count of serials at the previous step, included only when the current step has zero serials and is not the first step |

#### WorkQueueJob Fields

| Field              | Type                  | Description                                        |
| ------------------ | --------------------- | -------------------------------------------------- |
| `jobId`            | `string`              | Job ID                                             |
| `jobName`          | `string`              | Job name                                           |
| `pathId`           | `string`              | Path ID                                            |
| `pathName`         | `string`              | Path name                                          |
| `stepId`           | `string`              | Step ID (matches the queried parameter)            |
| `stepName`         | `string`              | Step name (e.g. `"Assembly"`)                      |
| `stepOrder`        | `number`              | Zero-based step index within the path              |
| `stepLocation`     | `string \| undefined` | Physical location of the step                      |
| `totalSteps`       | `number`              | Total number of steps in the path                  |
| `serialIds`        | `string[]`            | IDs of serials currently at this step              |
| `partCount`        | `number`              | Count of serials at this step (`serialIds.length`) |
| `previousStepId`   | `string \| undefined` | ID of the previous step (absent for first step)    |
| `previousStepName` | `string \| undefined` | Name of the previous step                          |
| `nextStepId`       | `string \| undefined` | ID of the next step (absent for final step)        |
| `nextStepName`     | `string \| undefined` | Name of the next step                              |
| `nextStepLocation` | `string \| undefined` | Location of the next step                          |
| `isFinalStep`      | `boolean`             | `true` if this is the last step in the path        |

### 400 Bad Request

| Condition           | Message                |
| ------------------- | ---------------------- |
| `stepId` is missing | `"stepId is required"` |

### 404 Not Found

| Condition                                           | Message                             |
| --------------------------------------------------- | ----------------------------------- |
| No step found with the given ID across any job/path | `"ProcessStep not found: {stepId}"` |

### 500 Internal Server Error

| Condition                | Message                   |
| ------------------------ | ------------------------- |
| Unexpected runtime error | `"Internal server error"` |

## Examples

### Request

```bash
curl http://localhost:3000/api/operator/step/step_001
```

### Response — Step with serials and notes

```json
{
  "job": {
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
    "nextStepId": "step_002",
    "nextStepName": "Deburring",
    "nextStepLocation": "Bay 2",
    "isFinalStep": false
  },
  "notes": [
    {
      "id": "note_a1b2c3",
      "jobId": "job_abc123",
      "pathId": "path_xyz789",
      "stepId": "step_001",
      "serialIds": ["sn_00001"],
      "text": "Tool wear noted, replaced insert.",
      "createdBy": "user_a1b2c3",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "pushedToJira": false
    }
  ]
}
```

### Response — Empty step with previous WIP count

```json
{
  "job": {
    "jobId": "job_abc123",
    "jobName": "JOB-2024-001",
    "pathId": "path_xyz789",
    "pathName": "Main Route",
    "stepId": "step_002",
    "stepName": "Deburring",
    "stepOrder": 1,
    "stepLocation": "Bay 2",
    "totalSteps": 4,
    "serialIds": [],
    "partCount": 0,
    "previousStepId": "step_001",
    "previousStepName": "CNC Machining",
    "nextStepId": "step_003",
    "nextStepName": "Inspection",
    "nextStepLocation": "QC Lab",
    "isFinalStep": false
  },
  "notes": [],
  "previousStepWipCount": 5
}
```

### Response — Final step

```json
{
  "job": {
    "jobId": "job_abc123",
    "jobName": "JOB-2024-001",
    "pathId": "path_xyz789",
    "pathName": "Main Route",
    "stepId": "step_004",
    "stepName": "Packaging",
    "stepOrder": 3,
    "totalSteps": 4,
    "serialIds": ["sn_00010"],
    "partCount": 1,
    "previousStepId": "step_003",
    "previousStepName": "Inspection",
    "isFinalStep": true
  },
  "notes": []
}
```

## Notes

- The endpoint performs a full scan of all jobs → paths → steps to locate the step by ID. This is acceptable for the expected data volumes but could become slow with thousands of jobs.
- The `previousStepWipCount` field is only included when the current step has zero serials and is not the first step. This provides "coming soon" context for empty downstream steps.
- First steps (order 0) do not have `previousStepId` or `previousStepName` fields.
- Final steps have `isFinalStep: true` and do not have `nextStepId`, `nextStepName`, or `nextStepLocation` fields.
- The `serialIds` array contains the IDs of serials whose `currentStepIndex` matches this step's order within the path. Completed and scrapped serials are not included.

## Related Endpoints

- [Get by Step Name](/api-docs/operator/by-step-name) — Parts view grouped by step name across all jobs
- [Get Work Queue](/api-docs/operator/work-queue) — Overview of all active work grouped by operator
- [Get Notes by Step](/api-docs/notes/by-step) — Same notes data, standalone endpoint

::
