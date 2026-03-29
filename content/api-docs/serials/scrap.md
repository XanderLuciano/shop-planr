---
title: 'Scrap Serial'
description: 'Mark a serial number as scrapped with a mandatory reason code and optional explanation'
method: 'POST'
endpoint: '/api/serials/:id/scrap'
service: 'lifecycleService'
category: 'Serials'
requestBody: 'ScrapSerialInput'
responseType: 'SerialNumber'
errorCodes: [400, 404, 500]
navigation:
  order: 6
---

# Scrap Serial

::endpoint-card{method="POST" path="/api/serials/:id/scrap"}

Marks a serial number as scrapped, permanently removing it from active production. The serial's status changes to `scrapped` and it can no longer be advanced, force-completed, or otherwise modified. Scrapping is an irreversible terminal state.

Every scrap operation requires a reason code from a predefined set of categories, enabling defect tracking and quality analysis. When the reason is `"other"`, a free-text explanation is also required. The system records which step the serial was at when it was scrapped, who scrapped it, and when — all of which are persisted on the serial record and in the audit trail.

Scrapped serials are excluded from progress calculations (the denominator adjusts) but remain visible in serial listings for traceability.

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                                             |
| --------- | -------- | -------- | ----------------------------------------------------------------------- |
| `id`      | `string` | Yes      | The unique identifier of the serial number to scrap (e.g. `"SN-00001"`) |

### Request Body

| Field         | Type     | Required    | Description                                                                                                              |
| ------------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `reason`      | `string` | Yes         | Scrap reason code. Must be one of: `"out_of_tolerance"`, `"process_defect"`, `"damaged"`, `"operator_error"`, `"other"`. |
| `explanation` | `string` | Conditional | Free-text explanation for the scrap. **Required** when `reason` is `"other"`. Optional for all other reason codes.       |
| `userId`      | `string` | Yes         | ID of the user performing the scrap operation. Used for audit trail attribution.                                         |

### Scrap Reason Codes

| Code               | Meaning                                                       |
| ------------------ | ------------------------------------------------------------- |
| `out_of_tolerance` | Part measurements fall outside acceptable tolerances          |
| `process_defect`   | Defect introduced during a manufacturing process              |
| `damaged`          | Part was physically damaged (handling, transport, etc.)       |
| `operator_error`   | Scrap caused by operator mistake                              |
| `other`            | Reason not covered by standard codes — requires `explanation` |

## Response

### 200 OK

Returned when the serial is successfully scrapped. The response contains the updated `SerialNumber` object with all scrap metadata populated.

| Field              | Type                  | Description                                                            |
| ------------------ | --------------------- | ---------------------------------------------------------------------- |
| `id`               | `string`              | Serial identifier                                                      |
| `jobId`            | `string`              | ID of the parent job                                                   |
| `pathId`           | `string`              | ID of the manufacturing path                                           |
| `currentStepIndex` | `number`              | Step index where the serial was scrapped (unchanged from before scrap) |
| `status`           | `"scrapped"`          | Always `"scrapped"` after this operation                               |
| `scrapReason`      | `string`              | The reason code provided in the request                                |
| `scrapExplanation` | `string \| undefined` | The explanation text, if provided                                      |
| `scrapStepId`      | `string \| undefined` | ID of the process step where the serial was at the time of scrapping   |
| `scrappedAt`       | `string`              | ISO 8601 timestamp of when the scrap occurred                          |
| `scrappedBy`       | `string`              | User ID of who performed the scrap                                     |
| `forceCompleted`   | `boolean`             | Always `false` for scrapped serials                                    |
| `createdAt`        | `string`              | ISO 8601 timestamp of serial creation                                  |
| `updatedAt`        | `string`              | ISO 8601 timestamp — updated to reflect the scrap time                 |

### 400 Bad Request

Returned when the serial cannot be scrapped due to its current state or invalid input.

| Condition                                          | Message                                                    |
| -------------------------------------------------- | ---------------------------------------------------------- |
| Serial is already scrapped                         | `"Serial is already scrapped"`                             |
| Serial is already completed                        | `"Cannot scrap a completed serial"`                        |
| `reason` is missing                                | `"Scrap reason is required"`                               |
| `reason` is `"other"` but `explanation` is missing | `"Explanation is required when scrap reason is \"other\""` |

### 404 Not Found

Returned when the serial or its path does not exist.

| Condition                                | Message                      |
| ---------------------------------------- | ---------------------------- |
| Serial does not exist                    | `"Serial not found: {id}"`   |
| Path referenced by serial does not exist | `"Path not found: {pathId}"` |

### 500 Internal Server Error

Returned if an unhandled error occurs during the scrap operation.

| Condition                    | Message                   |
| ---------------------------- | ------------------------- |
| Database write failure       | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request — Scrap with standard reason

```bash
curl -X POST http://localhost:3000/api/serials/SN-00001/scrap \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "process_defect",
    "userId": "user_qc1"
  }'
```

### Response — Standard scrap

```json
{
  "id": "SN-00001",
  "jobId": "job_abc123",
  "pathId": "path_xyz789",
  "currentStepIndex": 1,
  "status": "scrapped",
  "scrapReason": "process_defect",
  "scrapStepId": "step_002",
  "scrappedAt": "2024-01-15T16:00:00.000Z",
  "scrappedBy": "user_qc1",
  "forceCompleted": false,
  "createdAt": "2024-01-15T11:00:00.000Z",
  "updatedAt": "2024-01-15T16:00:00.000Z"
}
```

### Request — Scrap with "other" reason (explanation required)

```bash
curl -X POST http://localhost:3000/api/serials/SN-00003/scrap \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "other",
    "explanation": "Customer requested cancellation of this specific unit",
    "userId": "user_supervisor"
  }'
```

### Response — Scrap with explanation

```json
{
  "id": "SN-00003",
  "jobId": "job_def456",
  "pathId": "path_abc111",
  "currentStepIndex": 0,
  "status": "scrapped",
  "scrapReason": "other",
  "scrapExplanation": "Customer requested cancellation of this specific unit",
  "scrapStepId": "step_r01",
  "scrappedAt": "2024-01-16T10:30:00.000Z",
  "scrappedBy": "user_supervisor",
  "forceCompleted": false,
  "createdAt": "2024-01-16T09:30:00.000Z",
  "updatedAt": "2024-01-16T10:30:00.000Z"
}
```

## Notes

- Scrapping is **irreversible**. Once a serial is scrapped, it cannot be un-scrapped, advanced, or force-completed. If a serial was scrapped in error, a new serial must be created to replace it.
- The `scrapStepId` is automatically determined from the serial's current position in the path at the time of scrapping. If the serial's `currentStepIndex` maps to a valid step, that step's ID is recorded.
- An audit trail entry of type `serial_scrapped` is created, capturing the user, serial, job, path, step, reason, and explanation. This entry is immutable and cannot be deleted.
- Scrapped serials affect the job's progress calculation. The `progressPercent` formula adjusts: `completedCount / (goalQuantity - scrappedCount) * 100`. This means scrapping a serial increases the progress percentage of remaining serials.
- The `explanation` field is only **required** when `reason` is `"other"`, but it can be provided with any reason code for additional context.

## Related Endpoints

- [Get Serial](/api-docs/serials/get) — View the scrapped serial's full record
- [Force Complete Serial](/api-docs/serials/force-complete) — Alternative terminal state for incomplete serials
- [List Serials](/api-docs/serials/list) — View all serials including scrapped ones
- [Advance Serial](/api-docs/serials/advance) — Normal advancement (not available for scrapped serials)

::
