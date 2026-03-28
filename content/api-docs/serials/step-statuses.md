---
title: "Get Step Statuses"
description: "Retrieve per-step status tracking for a serial number"
method: "GET"
endpoint: "/api/serials/:id/step-statuses"
service: "lifecycleService"
category: "Serials"
responseType: "SnStepStatusView[]"
errorCodes: [400, 404]
navigation:
  order: 10
---

# Get Step Statuses

::endpoint-card{method="GET" path="/api/serials/:id/step-statuses"}

Retrieves the per-step status for a serial number, showing the status of each process step (pending, in_progress, completed, skipped, deferred, waived) along with step metadata and override information.

## Response

Returns an array of `SnStepStatusView` objects:

```json
[
  {
    "stepId": "step_001",
    "stepName": "Cutting",
    "stepOrder": 0,
    "status": "completed",
    "optional": false,
    "dependencyType": "physical",
    "hasOverride": false
  },
  {
    "stepId": "step_002",
    "stepName": "Welding",
    "stepOrder": 1,
    "status": "in_progress",
    "optional": false,
    "dependencyType": "preferred",
    "hasOverride": false
  },
  {
    "stepId": "step_003",
    "stepName": "Inspection",
    "stepOrder": 2,
    "status": "pending",
    "optional": true,
    "dependencyType": "preferred",
    "hasOverride": true
  }
]
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Serial ID is required |
| `404` | Serial not found |

::
