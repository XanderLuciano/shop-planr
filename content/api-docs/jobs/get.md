---
title: 'Get Job'
description: 'Retrieve a single job with its paths and computed progress statistics'
method: 'GET'
endpoint: '/api/jobs/:id'
service: 'jobService'
category: 'Jobs'
responseType: 'Job & { paths: Path[], progress: JobProgress }'
errorCodes: [400, 404, 500]
navigation:
  order: 2
---

# Get Job

::endpoint-card{method="GET" path="/api/jobs/:id"}

Retrieves a single production job by its unique identifier, enriched with the full list of associated paths and real-time computed progress statistics. This is the primary endpoint for building job detail views, as it aggregates data from three service calls: the job record itself, all paths belonging to the job, and the computed progress across every path and serial number.

Use this endpoint when you need the complete picture of a job — its configuration, its manufacturing routes, and how far along production has progressed. For a lightweight listing without paths or progress, use [List Jobs](/api-docs/jobs/list) instead.

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                                        |
| --------- | -------- | -------- | ------------------------------------------------------------------ |
| `id`      | `string` | Yes      | The unique identifier of the job to retrieve (e.g. `"job_abc123"`) |

## Response

### 200 OK

Returned when the job is found. The response is a single object containing all `Job` fields plus two additional nested objects: `paths` and `progress`.

#### Job Fields

| Field               | Type                    | Description                                            |
| ------------------- | ----------------------- | ------------------------------------------------------ |
| `id`                | `string`                | Unique identifier for the job                          |
| `name`              | `string`                | Human-readable job name, typically a work order number |
| `goalQuantity`      | `number`                | Target number of units to produce                      |
| `jiraTicketKey`     | `string \| undefined`   | Jira issue key if linked (e.g. `"PI-42"`)              |
| `jiraTicketSummary` | `string \| undefined`   | Summary text from the linked Jira ticket               |
| `jiraPartNumber`    | `string \| undefined`   | Part number from the Jira ticket's custom fields       |
| `jiraPriority`      | `string \| undefined`   | Priority level from Jira (e.g. `"High"`)               |
| `jiraEpicLink`      | `string \| undefined`   | Epic link key from Jira                                |
| `jiraLabels`        | `string[] \| undefined` | Labels from the Jira ticket                            |
| `createdAt`         | `string`                | ISO 8601 timestamp of when the job was created         |
| `updatedAt`         | `string`                | ISO 8601 timestamp of the last modification            |

#### `paths` — Array of Path objects

Each element in the `paths` array represents a manufacturing route defined for this job.

| Field             | Type                                   | Description                                                     |
| ----------------- | -------------------------------------- | --------------------------------------------------------------- |
| `id`              | `string`                               | Unique identifier for the path                                  |
| `jobId`           | `string`                               | The parent job's ID (matches the top-level `id`)                |
| `name`            | `string`                               | Human-readable path name (e.g. `"Main Route"`, `"Rework Path"`) |
| `goalQuantity`    | `number`                               | Target number of units to produce on this specific path         |
| `advancementMode` | `"strict" \| "flexible" \| "per_step"` | How serial numbers advance through steps on this path           |
| `steps`           | `ProcessStep[]`                        | Ordered array of process steps in this path (see below)         |
| `createdAt`       | `string`                               | ISO 8601 timestamp of path creation                             |
| `updatedAt`       | `string`                               | ISO 8601 timestamp of last path modification                    |

#### `paths[].steps[]` — Process Step objects

| Field            | Type                                             | Description                                                   |
| ---------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| `id`             | `string`                                         | Unique identifier for the step                                |
| `name`           | `string`                                         | Step name (e.g. `"CNC Machining"`, `"QC Inspection"`)         |
| `order`          | `number`                                         | Zero-based position of this step in the path sequence         |
| `location`       | `string \| undefined`                            | Physical location or workstation where this step is performed |
| `assignedTo`     | `string \| undefined`                            | User ID of the operator assigned to this step                 |
| `optional`       | `boolean`                                        | Whether this step can be skipped without blocking advancement |
| `dependencyType` | `"physical" \| "preferred" \| "completion_gate"` | How strictly this step's completion is enforced               |

#### `progress` — Computed JobProgress object

Progress is computed in real time from the current state of all serial numbers across all paths. It is not stored — it is recalculated on every request.

| Field             | Type             | Description                                                        |
| ----------------- | ---------------- | ------------------------------------------------------------------ |
| `totalGoal`       | `number`         | Sum of goal quantities across all paths                            |
| `totalCompleted`  | `number`         | Total number of serial numbers that have completed all steps       |
| `percentComplete` | `number`         | Overall completion percentage (`totalCompleted / totalGoal * 100`) |
| `pathProgress`    | `PathProgress[]` | Per-path breakdown of progress (see below)                         |

#### `progress.pathProgress[]` — Per-path progress

| Field             | Type     | Description                                            |
| ----------------- | -------- | ------------------------------------------------------ |
| `pathId`          | `string` | The path's unique identifier                           |
| `pathName`        | `string` | Human-readable name of the path                        |
| `goal`            | `number` | Goal quantity for this specific path                   |
| `completed`       | `number` | Number of serial numbers that have completed this path |
| `percentComplete` | `number` | Completion percentage for this path                    |

### 400 Bad Request

Returned if a validation error occurs during the request.

| Condition                           | Message                                          |
| ----------------------------------- | ------------------------------------------------ |
| Malformed or invalid `id` parameter | Varies — describes the specific validation issue |

### 404 Not Found

Returned when no job exists with the given ID.

| Condition          | Message                 |
| ------------------ | ----------------------- |
| Job does not exist | `"Job not found: {id}"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while fetching the job, paths, or computing progress.

| Condition                    | Message                   |
| ---------------------------- | ------------------------- |
| Database connection failure  | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request

```bash
curl -X GET http://localhost:3000/api/jobs/job_abc123 \
  -H "Accept: application/json"
```

### Response

```json
{
  "id": "job_abc123",
  "name": "JOB-2024-001",
  "goalQuantity": 50,
  "jiraTicketKey": "PI-42",
  "jiraTicketSummary": "Build 50 aluminum housings",
  "jiraPartNumber": "ALU-HOUSING-7075",
  "jiraPriority": "High",
  "jiraEpicLink": "PI-10",
  "jiraLabels": ["Q1-2024", "rush"],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "paths": [
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
      "updatedAt": "2024-01-15T11:00:00.000Z"
    },
    {
      "id": "path_rework01",
      "jobId": "job_abc123",
      "name": "Rework Path",
      "goalQuantity": 10,
      "advancementMode": "flexible",
      "steps": [
        {
          "id": "step_r01",
          "name": "Rework Station",
          "order": 0,
          "location": "Bay 5",
          "optional": false,
          "dependencyType": "physical"
        },
        {
          "id": "step_r02",
          "name": "Re-Inspection",
          "order": 1,
          "location": "QC Lab",
          "optional": false,
          "dependencyType": "completion_gate"
        }
      ],
      "createdAt": "2024-01-16T09:00:00.000Z",
      "updatedAt": "2024-01-16T09:00:00.000Z"
    }
  ],
  "progress": {
    "totalGoal": 50,
    "totalCompleted": 18,
    "percentComplete": 36.0,
    "pathProgress": [
      {
        "pathId": "path_xyz789",
        "pathName": "Main Route",
        "goal": 40,
        "completed": 15,
        "percentComplete": 37.5
      },
      {
        "pathId": "path_rework01",
        "pathName": "Rework Path",
        "goal": 10,
        "completed": 3,
        "percentComplete": 30.0
      }
    ]
  }
}
```

## Notes

- The `progress` object is **computed on every request** — it is not cached or stored. For jobs with many serial numbers, this computation may take slightly longer.
- If a job has no paths yet, `paths` will be an empty array `[]` and `progress` will reflect zero completion.
- The `steps` array within each path is ordered by the `order` field. Always use `order` to determine step sequence rather than array index.
- The `assignedTo` field on steps contains a user ID, not a display name. Use the Users API to resolve display names if needed.
- `advancementMode` controls how serials move through steps: `strict` requires sequential completion, `flexible` allows skipping optional steps, and `per_step` allows per-step override configuration.

## Related Endpoints

- [List Jobs](/api-docs/jobs/list) — Retrieve all jobs (without paths or progress)
- [Create Job](/api-docs/jobs/create) — Create a new production job
- [Update Job](/api-docs/jobs/update) — Modify an existing job's name or goal quantity
- [Create Path](/api-docs/paths/create) — Add a manufacturing route to a job
- [List Paths by Job](/api-docs/paths/list) — Retrieve all paths for a specific job

::
