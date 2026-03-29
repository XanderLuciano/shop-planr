---
title: "List Serials"
description: "Retrieve all serial numbers with enriched job, path, step, and assignment data"
method: "GET"
endpoint: "/api/serials"
service: "serialService"
category: "Serials"
responseType: "EnrichedSerial[]"
errorCodes: [400, 500]
navigation:
  order: 1
---

# List Serials

::endpoint-card{method="GET" path="/api/serials"}

Returns every serial number in the system as a flat array of enriched objects. Each serial is augmented with its parent job name, path name, current step name, and operator assignment — eliminating the need for separate lookups when building serial listing pages, search results, or dashboard views.

The enrichment process resolves job and path references server-side, so the response contains human-readable names alongside the raw IDs. Serial status is normalized to a display-friendly format: `"in-progress"`, `"completed"`, or `"scrapped"` (note the hyphen in `in-progress` — this differs from the stored `in_progress` format).

This endpoint does not accept any query parameters or support pagination — it always returns the complete list. For a single serial with certificate data, use [Get Serial](/api-docs/serials/get) instead.

## Request

This endpoint accepts no path parameters, query parameters, or request body.

## Response

### 200 OK

Returned when the request is successful. The response is always an array, even if no serials exist (in which case an empty array `[]` is returned).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique serial identifier (e.g. `"SN-00001"`) |
| `jobId` | `string` | ID of the parent job |
| `jobName` | `string` | Human-readable name of the parent job (e.g. `"JOB-2024-001"`) |
| `pathId` | `string` | ID of the manufacturing path this serial follows |
| `pathName` | `string` | Human-readable name of the path (e.g. `"Main Route"`) |
| `currentStepIndex` | `number` | Zero-based index of the serial's current step. `-1` when completed. |
| `currentStepName` | `string` | Display name of the current step (e.g. `"Welding"`). Shows `"Completed"` for completed serials and `"Scrapped"` for scrapped serials. |
| `assignedTo` | `string \| undefined` | User ID of the operator assigned to the serial's current step, if any |
| `status` | `"in-progress" \| "completed" \| "scrapped"` | Display-friendly status. Note: uses hyphen (`in-progress`) not underscore. |
| `scrapReason` | `string \| undefined` | Scrap reason code, present only for scrapped serials |
| `forceCompleted` | `boolean \| undefined` | `true` if the serial was force-completed, omitted otherwise |
| `createdAt` | `string` | ISO 8601 timestamp of when the serial was created |

### 400 Bad Request

Returned if an unexpected validation error occurs during the request.

| Condition | Message |
|-----------|---------|
| Internal validation failure | Varies — describes the specific validation issue |

### 500 Internal Server Error

Returned if an unhandled error occurs while fetching or enriching serial data.

| Condition | Message |
|-----------|---------|
| Database connection failure | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request

```bash
curl -X GET http://localhost:3000/api/serials \
  -H "Accept: application/json"
```

### Response

```json
[
  {
    "id": "SN-00001",
    "jobId": "job_abc123",
    "jobName": "JOB-2024-001",
    "pathId": "path_xyz789",
    "pathName": "Main Route",
    "currentStepIndex": 1,
    "currentStepName": "Welding",
    "assignedTo": "user_op1",
    "status": "in-progress",
    "createdAt": "2024-01-15T11:00:00.000Z"
  },
  {
    "id": "SN-00002",
    "jobId": "job_abc123",
    "jobName": "JOB-2024-001",
    "pathId": "path_xyz789",
    "pathName": "Main Route",
    "currentStepIndex": -1,
    "currentStepName": "Completed",
    "status": "completed",
    "createdAt": "2024-01-15T11:00:00.000Z"
  },
  {
    "id": "SN-00003",
    "jobId": "job_def456",
    "jobName": "JOB-2024-002",
    "pathId": "path_abc111",
    "pathName": "Rework Path",
    "currentStepIndex": 0,
    "currentStepName": "Scrapped",
    "status": "scrapped",
    "scrapReason": "process_defect",
    "createdAt": "2024-01-16T09:30:00.000Z"
  },
  {
    "id": "SN-00004",
    "jobId": "job_def456",
    "jobName": "JOB-2024-002",
    "pathId": "path_abc111",
    "pathName": "Rework Path",
    "currentStepIndex": -1,
    "currentStepName": "Completed",
    "status": "completed",
    "forceCompleted": true,
    "createdAt": "2024-01-16T09:30:00.000Z"
  }
]
```

## Notes

- The `status` field uses **hyphenated** format (`"in-progress"`) for display purposes, which differs from the stored domain format (`"in_progress"`). Client code should handle both formats or normalize on receipt.
- The `currentStepName` is resolved by matching the serial's `currentStepIndex` against the path's step array. If the path or step cannot be found (e.g. data inconsistency), the step name defaults to an empty string `""`.
- The `assignedTo` field reflects the operator assigned to the serial's **current** step, not the serial itself. If the current step has no assignment, this field is omitted.
- Job and path names are resolved via in-memory lookup maps built during the request. If a job or path has been deleted but serials still reference it, the name fields will be empty strings.
- This endpoint returns **all** serials with no filtering or pagination. For large production environments, consider implementing client-side filtering or using the serial browser page which provides search and filter capabilities.

## Related Endpoints

- [Get Serial](/api-docs/serials/get) — Retrieve a single serial with certificate data
- [Batch Create Serials](/api-docs/serials/create) — Create new serial numbers for a job path
- [List Jobs](/api-docs/jobs/list) — Retrieve all production jobs

::
