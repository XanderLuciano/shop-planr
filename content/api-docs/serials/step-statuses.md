---
title: 'Get Step Statuses'
description: 'Retrieve per-step status tracking for a serial number with step metadata and override information'
method: 'GET'
endpoint: '/api/serials/:id/step-statuses'
service: 'lifecycleService'
category: 'Serials'
responseType: 'SnStepStatusView[]'
errorCodes: [400, 404, 500]
navigation:
  order: 10
---

# Get Step Statuses

::endpoint-card{method="GET" path="/api/serials/:id/step-statuses"}

Retrieves the per-step status for every process step in a serial number's path. Each entry shows the step's current status (`pending`, `in_progress`, `completed`, `skipped`, `deferred`, or `waived`), along with step metadata (name, order, optional flag, dependency type) and whether an active override exists.

This is the primary endpoint for building step tracker visualizations, deferred step lists, and completion readiness checks. It provides a complete picture of where a serial stands relative to every step in its manufacturing route.

The response is enriched server-side by joining step status records with the path's step definitions and active override data.

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                                    |
| --------- | -------- | -------- | -------------------------------------------------------------- |
| `id`      | `string` | Yes      | The unique identifier of the serial number (e.g. `"SN-00001"`) |

## Response

### 200 OK

Returned when the request is successful. The response is an array of `SnStepStatusView` objects, one per step in the serial's path, ordered by step index.

| Field            | Type      | Description                                                                                                                             |
| ---------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `stepId`         | `string`  | Unique identifier of the process step                                                                                                   |
| `stepName`       | `string`  | Human-readable step name (e.g. `"CNC Machining"`)                                                                                       |
| `stepOrder`      | `number`  | Zero-based position of this step in the path sequence                                                                                   |
| `status`         | `string`  | Current status of this step for this serial. One of: `"pending"`, `"in_progress"`, `"completed"`, `"skipped"`, `"deferred"`, `"waived"` |
| `optional`       | `boolean` | Whether this step is configured as optional in the path                                                                                 |
| `dependencyType` | `string`  | Step dependency type. One of: `"physical"`, `"preferred"`, `"completion_gate"`                                                          |
| `hasOverride`    | `boolean` | Whether an active step override exists for this serial at this step                                                                     |

### Step Status Values

| Status        | Meaning                                            | How it's set                                                          |
| ------------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| `pending`     | Step has not been reached yet                      | Initialized at serial creation for all steps after the first          |
| `in_progress` | Serial is currently at this step                   | Set when the serial advances to this step, or at creation for step 0  |
| `completed`   | Step was completed normally                        | Set when the serial advances past this step, or via complete-deferred |
| `skipped`     | Optional step was bypassed                         | Set during advance-to when an optional/overridden step is bypassed    |
| `deferred`    | Required step was bypassed, must be resolved later | Set during advance-to when a required step is bypassed                |
| `waived`      | Deferred step was formally waived                  | Set via the waive-step endpoint with approver authorization           |

### 400 Bad Request

Returned if the serial ID parameter is missing.

| Condition                         | Message                   |
| --------------------------------- | ------------------------- |
| Serial ID is missing from the URL | `"Serial ID is required"` |

### 404 Not Found

Returned when the serial does not exist.

| Condition             | Message              |
| --------------------- | -------------------- |
| Serial does not exist | `"Serial not found"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while fetching or enriching step status data.

| Condition                    | Message                   |
| ---------------------------- | ------------------------- |
| Database connection failure  | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request

```bash
curl -X GET http://localhost:3000/api/serials/SN-00001/step-statuses \
  -H "Accept: application/json"
```

### Response — Serial mid-path with mixed statuses

```json
[
  {
    "stepId": "step_001",
    "stepName": "CNC Machining",
    "stepOrder": 0,
    "status": "completed",
    "optional": false,
    "dependencyType": "physical",
    "hasOverride": false
  },
  {
    "stepId": "step_002",
    "stepName": "Deburring",
    "stepOrder": 1,
    "status": "skipped",
    "optional": true,
    "dependencyType": "preferred",
    "hasOverride": false
  },
  {
    "stepId": "step_003",
    "stepName": "Heat Treatment",
    "stepOrder": 2,
    "status": "deferred",
    "optional": false,
    "dependencyType": "preferred",
    "hasOverride": false
  },
  {
    "stepId": "step_004",
    "stepName": "Coating",
    "stepOrder": 3,
    "status": "in_progress",
    "optional": false,
    "dependencyType": "physical",
    "hasOverride": false
  },
  {
    "stepId": "step_005",
    "stepName": "Final Inspection",
    "stepOrder": 4,
    "status": "pending",
    "optional": false,
    "dependencyType": "completion_gate",
    "hasOverride": true
  }
]
```

### Response — Newly created serial (all pending except first)

```json
[
  {
    "stepId": "step_001",
    "stepName": "Cutting",
    "stepOrder": 0,
    "status": "in_progress",
    "optional": false,
    "dependencyType": "physical",
    "hasOverride": false
  },
  {
    "stepId": "step_002",
    "stepName": "Welding",
    "stepOrder": 1,
    "status": "pending",
    "optional": false,
    "dependencyType": "preferred",
    "hasOverride": false
  },
  {
    "stepId": "step_003",
    "stepName": "QC Inspection",
    "stepOrder": 2,
    "status": "pending",
    "optional": true,
    "dependencyType": "preferred",
    "hasOverride": false
  }
]
```

## Notes

- The response is **enriched server-side** by joining three data sources: `SnStepStatus` records (for status), the path's `ProcessStep` definitions (for name, order, optional, dependencyType), and `SnStepOverride` records (for hasOverride).
- If the serial's path cannot be found (data inconsistency), the response falls back to raw step status data with empty step names, order 0, `optional: false`, `dependencyType: "preferred"`, and `hasOverride: false`.
- The `hasOverride` field reflects whether an **active** override exists. Reversed (deactivated) overrides are not counted.
- Step statuses are initialized when serials are created via [Batch Create Serials](/api-docs/serials/create). If a serial was created before step status tracking was implemented, it may have no status records.
- Use the `deferred` status to build "deferred steps" lists in the UI. Deferred steps can be resolved via [Complete Deferred Step](/api-docs/serials/complete-deferred) or [Waive Step](/api-docs/serials/waive-step).
- The `dependencyType` field affects advancement behavior: `physical` dependencies cannot be skipped (unless optional or overridden), `preferred` dependencies can be deferred, and `completion_gate` dependencies block final completion.

## Related Endpoints

- [Advance to Step](/api-docs/serials/advance-to) — Advancement that creates skipped/deferred statuses
- [Complete Deferred Step](/api-docs/serials/complete-deferred) — Resolve a deferred step
- [Waive Step](/api-docs/serials/waive-step) — Formally waive a deferred step
- [List & Create Overrides](/api-docs/serials/overrides) — Manage overrides that affect the `hasOverride` flag
- [Get Serial](/api-docs/serials/get) — View the serial's overall status

::
