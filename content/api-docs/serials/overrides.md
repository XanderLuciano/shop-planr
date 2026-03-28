---
title: "List & Create Overrides"
description: "Get or create step overrides for a serial number"
method: "GET"
endpoint: "/api/serials/:id/overrides"
service: "lifecycleService"
category: "Serials"
responseType: "SnStepOverride[]"
errorCodes: [400, 404]
navigation:
  order: 11
---

# List & Create Overrides

## List Overrides

::endpoint-card{method="GET" path="/api/serials/:id/overrides"}

Retrieves all step overrides for a serial number. Overrides allow specific steps to be fast-tracked or modified for individual serials.

### Response

Returns an array of `SnStepOverride` objects:

```json
[
  {
    "id": "ovr_001",
    "serialId": "sn_00001",
    "stepId": "step_003",
    "active": true,
    "reason": "Customer waived inspection requirement",
    "createdBy": "user_01",
    "createdAt": "2024-01-15T14:00:00Z"
  }
]
```

### Errors

| Code | Condition |
|------|-----------|
| `400` | Serial ID is required |

::

## Create Override

::endpoint-card{method="POST" path="/api/serials/:id/overrides"}

Creates a step override for one or more serial numbers. The override marks a specific step as overridden, allowing it to be bypassed during advancement.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `serialIds` | `string[]` | Yes | IDs of serials to apply the override to |
| `stepId` | `string` | Yes | ID of the step to override |
| `reason` | `string` | Yes | Reason for the override |
| `userId` | `string` | Yes | ID of the user creating the override |

### Example Request

```json
{
  "serialIds": ["sn_00001", "sn_00002"],
  "stepId": "step_003",
  "reason": "Customer waived inspection requirement",
  "userId": "user_01"
}
```

### Response

Returns the created `SnStepOverride` object:

```json
{
  "id": "ovr_001",
  "serialId": "sn_00001",
  "stepId": "step_003",
  "active": true,
  "reason": "Customer waived inspection requirement",
  "createdBy": "user_01",
  "createdAt": "2024-01-15T14:00:00Z"
}
```

### Errors

| Code | Condition |
|------|-----------|
| `400` | Missing required fields or invalid step ID |
| `404` | Serial or step not found |

::
