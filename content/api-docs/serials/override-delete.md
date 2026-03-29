---
title: 'Delete Override'
description: 'Reverse (deactivate) a step override for a serial number'
method: 'DELETE'
endpoint: '/api/serials/:id/overrides/:stepId'
service: 'lifecycleService'
category: 'Serials'
requestBody: '{ userId: string }'
responseType: '{ success: true }'
errorCodes: [400, 404, 500]
navigation:
  order: 12
---

# Delete Override

::endpoint-card{method="DELETE" path="/api/serials/:id/overrides/:stepId"}

Reverses (deactivates) a step override for a serial number. The override is marked as `active: false` rather than physically deleted, preserving the full audit trail of when the override was created and when it was reversed.

Reversing an override restores the step to its original required/optional status for this serial. However, if the step has already been skipped or completed while the override was active, the reversal is blocked — you cannot undo the effect of an override that has already been acted upon.

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                                                                     |
| --------- | -------- | -------- | ----------------------------------------------------------------------------------------------- |
| `id`      | `string` | Yes      | The unique identifier of the serial number (e.g. `"SN-00001"`)                                  |
| `stepId`  | `string` | Yes      | The unique identifier of the process step whose override should be reversed (e.g. `"step_003"`) |

### Request Body

| Field    | Type     | Required | Description                                                              |
| -------- | -------- | -------- | ------------------------------------------------------------------------ |
| `userId` | `string` | Yes      | ID of the user reversing the override. Used for audit trail attribution. |

## Response

### 200 OK

Returned when the override is successfully reversed.

| Field     | Type      | Description                               |
| --------- | --------- | ----------------------------------------- |
| `success` | `boolean` | Always `true` when the operation succeeds |

### 400 Bad Request

Returned when the override cannot be reversed due to its current state.

| Condition                                                  | Message                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| No active override exists for this serial-step combination | `"No active override found for this step"`                    |
| Step has already been skipped (override was acted upon)    | `"Cannot reverse override — step has already been skipped"`   |
| Step has already been completed                            | `"Cannot reverse override — step has already been completed"` |

### 404 Not Found

Returned when the serial does not exist.

| Condition             | Message                    |
| --------------------- | -------------------------- |
| Serial does not exist | `"Serial not found: {id}"` |

### 500 Internal Server Error

Returned if an unhandled error occurs during the reversal.

| Condition                    | Message                   |
| ---------------------------- | ------------------------- |
| Database write failure       | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request — Reverse an override

```bash
curl -X DELETE http://localhost:3000/api/serials/SN-00001/overrides/step_003 \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_supervisor"
  }'
```

### Response — Success

```json
{
  "success": true
}
```

### Error — Override already acted upon

```bash
curl -X DELETE http://localhost:3000/api/serials/SN-00002/overrides/step_003 \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_supervisor"
  }'
```

```json
{
  "statusCode": 400,
  "message": "Cannot reverse override — step has already been skipped"
}
```

## Notes

- The override is **soft-deleted** (marked `active: false`), not physically removed from the database. This preserves the audit trail showing when the override was created and when it was reversed.
- An audit trail entry of type `step_override_reversed` is recorded, capturing the user, serial, job, path, and step.
- **Timing matters**: An override can only be reversed if the step has not yet been skipped or completed. Once the serial advances past the overridden step (causing it to be classified as `skipped`), the override cannot be reversed because the skip has already been recorded.
- After reversing an override, the step returns to its original required/optional status. If the serial has not yet advanced past this step, future advancement will treat it according to its original configuration.
- To check whether an override is still active before attempting reversal, use the [List Overrides](/api-docs/serials/overrides) endpoint and filter by `active: true`.
- The `userId` is required in the request body even though this is a DELETE request. This is necessary for audit trail attribution.

## Related Endpoints

- [List & Create Overrides](/api-docs/serials/overrides) — View all overrides for a serial
- [Get Step Statuses](/api-docs/serials/step-statuses) — Check step status before reversing
- [Advance to Step](/api-docs/serials/advance-to) — Advancement affected by override presence

::
