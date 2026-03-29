---
title: 'Get by Step Name'
description: 'Retrieve parts view data for a named process step across all jobs'
method: 'GET'
endpoint: '/api/operator/:stepName'
service: 'jobService, pathService, serialService'
category: 'Operator'
responseType: 'OperatorStepView'
errorCodes: [500]
navigation:
  order: 5
---

# Get by Step Name

::endpoint-card{method="GET" path="/api/operator/:stepName"}

Retrieves the parts view data for a named process step across all jobs and paths. This endpoint powers the Parts View page, showing all parts that are at, approaching, or queued for a specific step name (e.g. "Assembly", "Inspection"). Parts are grouped into three buckets based on their proximity to the target step.

The endpoint scans all jobs and paths looking for steps whose `name` matches the given parameter. Since the same step name can appear in multiple paths across different jobs, the response aggregates data from all matching instances.

## Request

### Path Parameters

| Parameter  | Type     | Required | Description                                                                                                                              |
| ---------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `stepName` | `string` | Yes      | The process step name to query (e.g. `"Assembly"`, `"Inspection"`, `"CNC Machining"`). Case-sensitive, must match the step name exactly. |

## Response

### 200 OK

Returns an aggregated parts view object.

| Field              | Type                  | Description                                                                         |
| ------------------ | --------------------- | ----------------------------------------------------------------------------------- |
| `stepName`         | `string`              | The queried step name (echoed back)                                                 |
| `location`         | `string \| undefined` | The physical location of the first matching step that has a location set            |
| `currentParts`     | `PartInfo[]`          | Serials currently at this step (step index matches)                                 |
| `comingSoon`       | `PartInfo[]`          | Serials one step before this step (will arrive next)                                |
| `backlog`          | `PartInfo[]`          | Serials two or more steps before this step                                          |
| `vendorPartsCount` | `number`              | Count of current parts at steps whose location contains "vendor" (case-insensitive) |
| `stepIds`          | `string[]`            | All unique step IDs that match the given step name across all paths                 |

#### PartInfo Fields

| Field              | Type                  | Description                                                     |
| ------------------ | --------------------- | --------------------------------------------------------------- |
| `serialId`         | `string`              | Serial number ID                                                |
| `jobId`            | `string`              | Job ID the serial belongs to                                    |
| `jobName`          | `string`              | Job name                                                        |
| `pathId`           | `string`              | Path ID the serial belongs to                                   |
| `pathName`         | `string`              | Path name                                                       |
| `nextStepName`     | `string \| undefined` | Name of the step after the target step (only on `currentParts`) |
| `nextStepLocation` | `string \| undefined` | Location of the next step (only on `currentParts`)              |

### 500 Internal Server Error

| Condition                | Message                   |
| ------------------------ | ------------------------- |
| Unexpected runtime error | `"Internal Server Error"` |

## Examples

### Request

```bash
curl http://localhost:3000/api/operator/Assembly
```

### Response — Parts at various stages

```json
{
  "stepName": "Assembly",
  "location": "Bay 3",
  "currentParts": [
    {
      "serialId": "sn_00001",
      "jobId": "job_abc123",
      "jobName": "JOB-2024-001",
      "pathId": "path_xyz789",
      "pathName": "Main Route",
      "nextStepName": "Inspection",
      "nextStepLocation": "QC Lab"
    },
    {
      "serialId": "sn_00002",
      "jobId": "job_abc123",
      "jobName": "JOB-2024-001",
      "pathId": "path_xyz789",
      "pathName": "Main Route",
      "nextStepName": "Inspection",
      "nextStepLocation": "QC Lab"
    }
  ],
  "comingSoon": [
    {
      "serialId": "sn_00005",
      "jobId": "job_abc123",
      "jobName": "JOB-2024-001",
      "pathId": "path_xyz789",
      "pathName": "Main Route"
    }
  ],
  "backlog": [
    {
      "serialId": "sn_00010",
      "jobId": "job_def456",
      "jobName": "JOB-2024-002",
      "pathId": "path_uvw321",
      "pathName": "Express Route"
    }
  ],
  "vendorPartsCount": 0,
  "stepIds": ["step_003", "step_015"]
}
```

### Response — No matching steps

```json
{
  "stepName": "Nonexistent Step",
  "currentParts": [],
  "comingSoon": [],
  "backlog": [],
  "vendorPartsCount": 0,
  "stepIds": []
}
```

## Notes

- The step name match is **case-sensitive**. `"Assembly"` and `"assembly"` are treated as different step names.
- The `location` field returns the location from the first matching step that has one set. If no matching steps have a location, this field is `undefined`.
- The `vendorPartsCount` counts serials at steps whose `location` field contains the substring `"vendor"` (case-insensitive check). This is a heuristic for identifying parts at external vendors.
- The `stepIds` array contains all unique step IDs across all paths that match the given name. This is useful for creating notes or navigating to specific step instances.
- `comingSoon` includes serials exactly one step before the target. `backlog` includes serials two or more steps before. Serials past the target step are not included.
- `nextStepName` and `nextStepLocation` are only populated on `currentParts` items, showing where the part will go after the target step.
- If no paths contain a step with the given name, the response is valid but empty (all arrays are empty, `stepIds` is empty). No 404 is returned.

## Related Endpoints

- [Get Step View](/api-docs/operator/step-view) — Detailed view for a specific step instance (by ID, not name)
- [Get Work Queue](/api-docs/operator/work-queue) — Overview of all work grouped by operator
- [Assign Step](/api-docs/steps/assign) — Assign an operator to a step

::
