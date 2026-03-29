---
title: "List BOM Versions"
description: "Retrieve the version history of a bill of materials"
method: "GET"
endpoint: "/api/bom/:id/versions"
service: "bomService"
category: "BOM"
responseType: "BomVersion[]"
errorCodes: [404, 500]
navigation:
  order: 6
---

# List BOM Versions

::endpoint-card{method="GET" path="/api/bom/:id/versions"}

Retrieves the full version history of a bill of materials. Each version is an immutable snapshot created by the [Edit BOM](/api-docs/bom/edit) endpoint, capturing the BOM's entries as they were **before** the edit was applied. Versions are ordered by version number and include the change description, the user who made the change, and a timestamp.

Use this endpoint to display a BOM change log, compare versions side-by-side, or audit who changed what and when.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The unique identifier of the BOM (e.g. `"bom_abc123"`) |

## Response

### 200 OK

Returns an array of `BomVersion` objects ordered by version number. If the BOM exists but has never been edited via the versioned edit endpoint, returns an empty array `[]`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the version record (prefixed with `bomv_`) |
| `bomId` | `string` | The parent BOM ID |
| `versionNumber` | `number` | Auto-incrementing version number (starts at 1) |
| `entriesSnapshot` | `BomEntry[]` | The BOM entries as they were **before** the edit that created this version |
| `entriesSnapshot[].partType` | `string` | Part type name |
| `entriesSnapshot[].requiredQuantityPerBuild` | `number` | Required quantity at that point in time |
| `entriesSnapshot[].contributingJobIds` | `string[]` | Contributing job IDs at that point in time |
| `changeDescription` | `string \| undefined` | The change description provided when the edit was made |
| `changedBy` | `string` | The user ID who made the edit |
| `createdAt` | `string` | ISO 8601 timestamp of when the version was created |

### 404 Not Found

Returned when no BOM exists with the given ID.

| Condition | Message |
|-----------|---------|
| BOM does not exist | `"BOM not found: bom_abc123"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while querying the database.

| Condition | Message |
|-----------|---------|
| Database read failure | `"Internal Server Error"` |

## Examples

### Request

```bash
curl http://localhost:3000/api/bom/bom_abc123/versions
```

### Response — Multiple versions

```json
[
  {
    "id": "bomv_001",
    "bomId": "bom_abc123",
    "versionNumber": 1,
    "entriesSnapshot": [
      {
        "partType": "Steel Plate",
        "requiredQuantityPerBuild": 4,
        "contributingJobIds": ["job_001"]
      },
      {
        "partType": "Bolt M8",
        "requiredQuantityPerBuild": 12,
        "contributingJobIds": ["job_003"]
      }
    ],
    "changeDescription": "Added second contributing job for steel plates",
    "changedBy": "user_xyz",
    "createdAt": "2024-01-18T10:00:00.000Z"
  },
  {
    "id": "bomv_002",
    "bomId": "bom_abc123",
    "versionNumber": 2,
    "entriesSnapshot": [
      {
        "partType": "Steel Plate",
        "requiredQuantityPerBuild": 4,
        "contributingJobIds": ["job_001", "job_002"]
      },
      {
        "partType": "Bolt M8",
        "requiredQuantityPerBuild": 12,
        "contributingJobIds": ["job_003"]
      }
    ],
    "changeDescription": "Increased bolt quantity from 12 to 16 per engineering review",
    "changedBy": "user_abc",
    "createdAt": "2024-01-20T14:00:00.000Z"
  }
]
```

### Response — No versions (BOM never edited via versioned endpoint)

```json
[]
```

## Notes

- Versions are created only by the [Edit BOM](/api-docs/bom/edit) endpoint. Simple updates via `PUT /api/bom/:id` do not create version records.
- Each version's `entriesSnapshot` captures the state of the BOM **before** the corresponding edit was applied. To see the current state, use [Get BOM](/api-docs/bom/get).
- Version numbers are sequential and start at 1. They auto-increment with each versioned edit.
- Versions are immutable — once created, they cannot be modified or deleted. This ensures the audit trail remains intact.
- The `changeDescription` field comes from the `changeDescription` provided in the edit request. It may be `undefined` if the field was somehow omitted (though the edit endpoint validates it as required).
- To reconstruct the BOM at any point in time, walk the version history forward from version 1. Each version shows what the BOM looked like before the next change was applied.
- A newly created BOM has no versions. The first version is created when the first versioned edit is made.

## Related Endpoints

- [Edit BOM](/api-docs/bom/edit) — Create a new version by editing the BOM
- [Get BOM](/api-docs/bom/get) — Retrieve the current state of the BOM
- [List Audit Entries](/api-docs/audit/list) — Query `bom_edited` audit events for additional context

::
