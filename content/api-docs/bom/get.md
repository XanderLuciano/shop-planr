---
title: 'Get BOM'
description: 'Retrieve a single bill of materials by ID with production summary'
method: 'GET'
endpoint: '/api/bom/:id'
service: 'bomService'
category: 'BOM'
responseType: 'BOM & { summary: BomSummary }'
errorCodes: [404, 500]
navigation:
  order: 2
---

# Get BOM

::endpoint-card{method="GET" path="/api/bom/:id"}

Retrieves a single bill of materials by its unique identifier. Unlike the list endpoint, this response includes a computed `summary` object with real-time production statistics for each BOM entry. The summary is calculated by querying serial number completion data across all contributing jobs.

Use this endpoint to display a BOM detail view with progress tracking, showing how many parts have been completed vs. how many are still outstanding for each entry.

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                            |
| --------- | -------- | -------- | ------------------------------------------------------ |
| `id`      | `string` | Yes      | The unique identifier of the BOM (e.g. `"bom_abc123"`) |

## Response

### 200 OK

Returns the `BOM` object merged with a `summary` field containing production statistics.

| Field                                        | Type                  | Description                                             |
| -------------------------------------------- | --------------------- | ------------------------------------------------------- |
| `id`                                         | `string`              | Unique identifier for the BOM                           |
| `name`                                       | `string`              | Human-readable BOM name                                 |
| `entries`                                    | `BomEntry[]`          | Array of part entries                                   |
| `entries[].id`                               | `string \| undefined` | Entry ID, if assigned                                   |
| `entries[].bomId`                            | `string \| undefined` | Parent BOM ID reference                                 |
| `entries[].partType`                         | `string`              | Part type name                                          |
| `entries[].requiredQuantityPerBuild`         | `number`              | Quantity needed per build                               |
| `entries[].contributingJobIds`               | `string[]`            | Job IDs that supply this part                           |
| `createdAt`                                  | `string`              | ISO 8601 timestamp of creation                          |
| `updatedAt`                                  | `string`              | ISO 8601 timestamp of last modification                 |
| `summary`                                    | `BomSummary`          | Computed production statistics                          |
| `summary.bomId`                              | `string`              | The BOM ID (same as top-level `id`)                     |
| `summary.bomName`                            | `string`              | The BOM name (same as top-level `name`)                 |
| `summary.entries`                            | `BomEntrySummary[]`   | Per-entry production statistics                         |
| `summary.entries[].partType`                 | `string`              | Part type name                                          |
| `summary.entries[].requiredQuantityPerBuild` | `number`              | Required quantity                                       |
| `summary.entries[].totalCompleted`           | `number`              | Total completed serials across contributing jobs        |
| `summary.entries[].totalInProgress`          | `number`              | Total in-progress serials across contributing jobs      |
| `summary.entries[].totalOutstanding`         | `number`              | Remaining units needed (`max(0, required - completed)`) |

### 404 Not Found

Returned when no BOM exists with the given ID.

| Condition          | Message                       |
| ------------------ | ----------------------------- |
| BOM does not exist | `"BOM not found: bom_abc123"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while querying the database.

| Condition             | Message                   |
| --------------------- | ------------------------- |
| Database read failure | `"Internal Server Error"` |

## Examples

### Request

```bash
curl http://localhost:3000/api/bom/bom_abc123
```

### Response — BOM with summary

```json
{
  "id": "bom_abc123",
  "name": "Widget Assembly BOM",
  "entries": [
    {
      "id": "entry_001",
      "bomId": "bom_abc123",
      "partType": "Steel Plate",
      "requiredQuantityPerBuild": 4,
      "contributingJobIds": ["job_001", "job_002"]
    },
    {
      "id": "entry_002",
      "bomId": "bom_abc123",
      "partType": "Bolt M8",
      "requiredQuantityPerBuild": 12,
      "contributingJobIds": ["job_003"]
    }
  ],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "summary": {
    "bomId": "bom_abc123",
    "bomName": "Widget Assembly BOM",
    "entries": [
      {
        "partType": "Steel Plate",
        "requiredQuantityPerBuild": 4,
        "totalCompleted": 3,
        "totalInProgress": 5,
        "totalOutstanding": 1
      },
      {
        "partType": "Bolt M8",
        "requiredQuantityPerBuild": 12,
        "totalCompleted": 12,
        "totalInProgress": 0,
        "totalOutstanding": 0
      }
    ]
  }
}
```

### Response — BOM with no contributing job progress

```json
{
  "id": "bom_def456",
  "name": "New Product BOM",
  "entries": [
    {
      "id": "entry_003",
      "bomId": "bom_def456",
      "partType": "Custom Bracket",
      "requiredQuantityPerBuild": 2,
      "contributingJobIds": []
    }
  ],
  "createdAt": "2024-01-20T09:00:00.000Z",
  "updatedAt": "2024-01-20T09:00:00.000Z",
  "summary": {
    "bomId": "bom_def456",
    "bomName": "New Product BOM",
    "entries": [
      {
        "partType": "Custom Bracket",
        "requiredQuantityPerBuild": 2,
        "totalCompleted": 0,
        "totalInProgress": 0,
        "totalOutstanding": 0
      }
    ]
  }
}
```

## Notes

- The `summary` field is computed in real time on every request. It is not cached or stored — it reflects the current state of serial number completion across all contributing jobs.
- The `totalOutstanding` value is calculated as `max(0, requiredQuantityPerBuild - totalCompleted)`. It will never be negative, even if more serials have been completed than required.
- If a BOM entry has an empty `contributingJobIds` array, all summary values for that entry will be `0`.
- The summary counts serials across **all** contributing jobs for each entry. If two jobs both contribute to the same part type, their serial counts are summed.
- Scrapped serials are excluded from `totalCompleted` but included in the total count used to compute `totalInProgress`.

## Related Endpoints

- [List BOMs](/api-docs/bom/list) — Retrieve all BOMs (without summary)
- [Edit BOM](/api-docs/bom/edit) — Make a versioned edit to this BOM
- [List BOM Versions](/api-docs/bom/versions) — View the change history
- [Update BOM](/api-docs/bom/update) — Simple update without version tracking

::
