---
title: "Update Step Config"
description: "Update the optional flag and dependency type for a process step"
method: "PATCH"
endpoint: "/api/steps/:id/config"
service: "pathService"
category: "Steps"
requestBody: "{ optional?, dependencyType? }"
responseType: "ProcessStep"
errorCodes: [400, 404, 500]
navigation:
  order: 2
---

# Update Step Config

::endpoint-card{method="PATCH" path="/api/steps/:id/config"}

Updates configuration properties for a process step. Two properties can be modified:

- **`optional`** — Whether the step can be skipped during serial advancement
- **`dependencyType`** — How the step interacts with the advancement system

At least one valid field must be provided. The endpoint validates the `dependencyType` value against the allowed enum and ignores any unrecognized fields. If neither `optional` nor a valid `dependencyType` is provided, a `400` error is returned.

The `optional` field must be a boolean (not a truthy/falsy value). The `dependencyType` must be one of the three allowed values.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The process step ID to configure (e.g. `"step_001"`). |

### Request Body

At least one field must be provided.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `optional` | `boolean` | No | Set to `true` to allow the step to be skipped/deferred/waived during advancement. Set to `false` to make it mandatory. Must be a strict boolean. |
| `dependencyType` | `string` | No | The dependency classification. Must be one of: `"physical"` (hard dependency, cannot be skipped), `"preferred"` (default, should be done in order but can be bypassed), or `"completion_gate"` (all prior steps must complete first). |

## Response

### 200 OK

Returns the updated `ProcessStep` object.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Step ID (unchanged) |
| `name` | `string` | Step name (unchanged) |
| `order` | `number` | Zero-based position in the path (unchanged) |
| `location` | `string \| undefined` | Physical location (unchanged) |
| `assignedTo` | `string \| undefined` | Assigned operator (unchanged) |
| `optional` | `boolean` | Updated optional flag |
| `dependencyType` | `string` | Updated dependency type |

### 400 Bad Request

| Condition | Message |
|-----------|---------|
| Step ID is missing from the URL | `"Step ID is required"` |
| No valid fields provided in the body | `"No valid fields to update"` |
| `dependencyType` is not one of the allowed values | Field is silently ignored; if no other valid field is present, `"No valid fields to update"` |

### 404 Not Found

| Condition | Message |
|-----------|---------|
| No step found with the given ID | `"ProcessStep not found: {id}"` |

### 500 Internal Server Error

| Condition | Message |
|-----------|---------|
| Database write failure | `"Internal Server Error"` |

## Examples

### Request — Make step optional

```bash
curl -X PATCH http://localhost:3000/api/steps/step_001/config \
  -H "Content-Type: application/json" \
  -d '{
    "optional": true
  }'
```

### Response — Step made optional

```json
{
  "id": "step_001",
  "name": "Deburring",
  "order": 1,
  "location": "Bay 2",
  "assignedTo": "user_a1b2c3",
  "optional": true,
  "dependencyType": "preferred"
}
```

### Request — Change dependency type

```bash
curl -X PATCH http://localhost:3000/api/steps/step_003/config \
  -H "Content-Type: application/json" \
  -d '{
    "dependencyType": "completion_gate"
  }'
```

### Response — Dependency type updated

```json
{
  "id": "step_003",
  "name": "Final Inspection",
  "order": 3,
  "location": "QC Lab",
  "optional": false,
  "dependencyType": "completion_gate"
}
```

### Request — Update both fields

```bash
curl -X PATCH http://localhost:3000/api/steps/step_002/config \
  -H "Content-Type: application/json" \
  -d '{
    "optional": true,
    "dependencyType": "preferred"
  }'
```

### Response — Both fields updated

```json
{
  "id": "step_002",
  "name": "Surface Treatment",
  "order": 2,
  "optional": true,
  "dependencyType": "preferred"
}
```

### Error — No valid fields

```bash
curl -X PATCH http://localhost:3000/api/steps/step_001/config \
  -H "Content-Type: application/json" \
  -d '{
    "dependencyType": "invalid_value"
  }'
# 400: { "message": "No valid fields to update" }
```

## Notes

- The `dependencyType` validation is strict: only `"physical"`, `"preferred"`, and `"completion_gate"` are accepted. Invalid values are silently ignored (not included in the update). If the only field provided has an invalid value, the request fails with "No valid fields to update".
- The `optional` field uses strict boolean checking (`typeof body.optional === 'boolean'`). Truthy values like `1` or `"true"` are not accepted.
- Changing a step to `optional: true` does not retroactively affect serials that have already passed or are currently at the step. It only affects future advancement decisions.
- Setting `dependencyType: "physical"` on a step that is also `optional: true` creates a contradictory configuration. The system does not prevent this, but the advancement logic treats physical dependencies as non-skippable regardless of the optional flag.
- Configuration changes do not update the parent path's `updatedAt` timestamp.
- Unrecognized fields in the request body are silently ignored.

## Related Endpoints

- [Assign Step](/api-docs/steps/assign) — Assign an operator to this step
- [Create Path](/api-docs/paths/create) — Steps are initially configured when creating a path
- [Update Path](/api-docs/paths/update) — Replace all steps on a path (recreates step IDs)

::
