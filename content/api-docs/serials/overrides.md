---
title: "List & Create Overrides"
description: "Retrieve existing step overrides or create new ones for serial numbers"
method: "GET"
endpoint: "/api/serials/:id/overrides"
service: "lifecycleService"
category: "Serials"
responseType: "SnStepOverride[]"
errorCodes: [400, 404, 500]
navigation:
  order: 11
---

# List & Create Overrides

This page documents two endpoints that share the same base path but use different HTTP methods: `GET` to list existing overrides and `POST` to create new ones.

## List Overrides

::endpoint-card{method="GET" path="/api/serials/:id/overrides"}

Retrieves all step overrides for a serial number, including both active and inactive (reversed) overrides. Overrides allow specific steps to be treated as optional for individual serial numbers, enabling them to be skipped during advancement even if the step is normally required.

### Request

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The unique identifier of the serial number (e.g. `"SN-00001"`) |

### Response

#### 200 OK

Returned when the request is successful. The response is always an array, even if no overrides exist (empty array `[]`).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the override record |
| `serialId` | `string` | ID of the serial number this override applies to |
| `stepId` | `string` | ID of the process step being overridden |
| `active` | `boolean` | Whether the override is currently active. `false` means it was reversed. |
| `reason` | `string \| undefined` | Reason for creating the override |
| `createdBy` | `string` | User ID of who created the override |
| `createdAt` | `string` | ISO 8601 timestamp of when the override was created |

#### 400 Bad Request

| Condition | Message |
|-----------|---------|
| Serial ID is missing from the URL | `"Serial ID is required"` |

#### 500 Internal Server Error

| Condition | Message |
|-----------|---------|
| Database connection failure | `"Internal Server Error"` |

### Examples

#### Request

```bash
curl -X GET http://localhost:3000/api/serials/SN-00001/overrides \
  -H "Accept: application/json"
```

#### Response — Active and reversed overrides

```json
[
  {
    "id": "snso_001",
    "serialId": "SN-00001",
    "stepId": "step_003",
    "active": true,
    "reason": "Customer waived inspection requirement",
    "createdBy": "user_supervisor",
    "createdAt": "2024-01-15T14:00:00.000Z"
  },
  {
    "id": "snso_002",
    "serialId": "SN-00001",
    "stepId": "step_002",
    "active": false,
    "reason": "Temporary bypass for tooling change",
    "createdBy": "user_supervisor",
    "createdAt": "2024-01-14T10:00:00.000Z"
  }
]
```

#### Response — No overrides

```json
[]
```

### Notes

- Both active and inactive (reversed) overrides are returned. Filter by `active: true` client-side if you only need current overrides.
- This endpoint queries the override repository directly and does not validate that the serial exists. If the serial ID is invalid, an empty array is returned.

::

## Create Override

::endpoint-card{method="POST" path="/api/serials/:id/overrides"}

Creates a step override for one or more serial numbers. The override marks a specific step as effectively optional for the targeted serials, allowing it to be skipped during advancement even if it would normally be required.

Overrides are applied in batch — you provide an array of `serialIds` and a single `stepId`, and the override is created for each serial. If an active override already exists for a given serial-step combination, it is silently skipped (no duplicate created, no error raised).

### Request

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The serial number ID in the URL path. Note: the actual serial IDs to override are specified in the request body's `serialIds` array. |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `serialIds` | `string[]` | Yes | Array of serial number IDs to apply the override to. Each serial must exist. |
| `stepId` | `string` | Yes | ID of the process step to override. The step must not already be completed for any of the targeted serials. |
| `reason` | `string` | Yes | Reason for creating the override. Recorded for audit trail purposes. |
| `userId` | `string` | Yes | ID of the user creating the override. Used for audit trail attribution. |

### Response

#### 200 OK

Returned when the overrides are successfully created. The response is an array of newly created `SnStepOverride` objects. Serials that already had an active override for the same step are excluded from the response (no duplicate created).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the override record |
| `serialId` | `string` | ID of the serial number this override applies to |
| `stepId` | `string` | ID of the overridden process step |
| `active` | `boolean` | Always `true` for newly created overrides |
| `reason` | `string` | The reason provided in the request |
| `createdBy` | `string` | User ID of who created the override |
| `createdAt` | `string` | ISO 8601 timestamp of when the override was created |

#### 400 Bad Request

| Condition | Message |
|-----------|---------|
| `serialIds` is missing or empty | Varies — validation error |
| `stepId` is missing | Varies — validation error |
| `reason` is missing | Varies — validation error |
| Step is already completed for a serial | `"Cannot override a step that has already been completed"` |

#### 404 Not Found

| Condition | Message |
|-----------|---------|
| Any serial in `serialIds` does not exist | `"Serial not found: {serialId}"` |

#### 500 Internal Server Error

| Condition | Message |
|-----------|---------|
| Database write failure | `"Internal Server Error"` |

### Examples

#### Request — Override for multiple serials

```bash
curl -X POST http://localhost:3000/api/serials/SN-00001/overrides \
  -H "Content-Type: application/json" \
  -d '{
    "serialIds": ["SN-00001", "SN-00002", "SN-00003"],
    "stepId": "step_003",
    "reason": "Customer waived final inspection for this batch",
    "userId": "user_supervisor"
  }'
```

#### Response — Overrides created

```json
[
  {
    "id": "snso_010",
    "serialId": "SN-00001",
    "stepId": "step_003",
    "active": true,
    "reason": "Customer waived final inspection for this batch",
    "createdBy": "user_supervisor",
    "createdAt": "2024-01-15T14:00:00.000Z"
  },
  {
    "id": "snso_011",
    "serialId": "SN-00002",
    "stepId": "step_003",
    "active": true,
    "reason": "Customer waived final inspection for this batch",
    "createdBy": "user_supervisor",
    "createdAt": "2024-01-15T14:00:00.000Z"
  },
  {
    "id": "snso_012",
    "serialId": "SN-00003",
    "stepId": "step_003",
    "active": true,
    "reason": "Customer waived final inspection for this batch",
    "createdBy": "user_supervisor",
    "createdAt": "2024-01-15T14:00:00.000Z"
  }
]
```

#### Request — Single serial override

```bash
curl -X POST http://localhost:3000/api/serials/SN-00005/overrides \
  -H "Content-Type: application/json" \
  -d '{
    "serialIds": ["SN-00005"],
    "stepId": "step_002",
    "reason": "Tooling unavailable — bypass coating step",
    "userId": "user_lead"
  }'
```

### Notes

- The `id` parameter in the URL path is present for routing consistency but the actual serial IDs are taken from the `serialIds` array in the request body. This allows batch override creation across multiple serials in a single call.
- **Idempotent for existing overrides**: If a serial already has an active override for the specified step, it is silently skipped. The response only includes newly created overrides.
- **Cannot override completed steps**: If the step has already been completed for any serial in the batch, the entire request fails with a 400 error. Check step statuses before creating overrides.
- An audit trail entry of type `step_override_created` is recorded for each new override, capturing the user, serial, job, path, step, and reason.
- Overrides affect advancement behavior: during [Advance to Step](/api-docs/serials/advance-to), steps with active overrides are classified as `skipped` instead of `deferred`, since the override effectively makes them optional.
- To reverse an override, use the [Delete Override](/api-docs/serials/override-delete) endpoint.

## Related Endpoints

- [Delete Override](/api-docs/serials/override-delete) — Reverse (deactivate) a step override
- [Get Step Statuses](/api-docs/serials/step-statuses) — View the `hasOverride` flag per step
- [Advance to Step](/api-docs/serials/advance-to) — Advancement affected by active overrides
- [Waive Step](/api-docs/serials/waive-step) — Alternative: formally waive a deferred step

::
