---
title: "Scrap Serial"
description: "Mark a serial number as scrapped with a reason"
method: "POST"
endpoint: "/api/serials/:id/scrap"
service: "lifecycleService"
category: "Serials"
requestBody: "ScrapSerialInput"
responseType: "SerialNumber"
errorCodes: [400, 404]
navigation:
  order: 6
---

# Scrap Serial

::endpoint-card{method="POST" path="/api/serials/:id/scrap"}

Marks a serial number as scrapped. The serial's status changes to `scrapped` and it can no longer be advanced. An audit trail entry is created.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | `string` | Yes | One of: `"out_of_tolerance"`, `"process_defect"`, `"damaged"`, `"operator_error"`, `"other"` |
| `explanation` | `string` | Conditional | Required when reason is `"other"` |
| `userId` | `string` | Yes | ID of the user performing the scrap |

## Example Request

```json
{
  "reason": "process_defect",
  "userId": "user_01"
}
```

## Response

Returns the updated `SerialNumber` object:

```json
{
  "id": "sn_00001",
  "jobId": "job_abc123",
  "pathId": "path_xyz",
  "currentStepIndex": 1,
  "status": "scrapped",
  "scrapReason": "process_defect",
  "scrapStepId": "step_002",
  "scrappedAt": "2024-01-15T16:00:00Z",
  "scrappedBy": "user_01",
  "forceCompleted": false,
  "createdAt": "2024-01-15T11:00:00Z",
  "updatedAt": "2024-01-15T16:00:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Serial already scrapped/completed, invalid reason, or missing explanation for `"other"` |
| `404` | Serial not found |

::
