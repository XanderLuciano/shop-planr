---
title: "Get BOM"
description: "Retrieve a single bill of materials by ID with production summary"
method: "GET"
endpoint: "/api/bom/:id"
service: "bomService"
category: "BOM"
responseType: "BOM & { summary: BomSummary }"
errorCodes: [404, 500]
navigation:
  order: 2
---

# Get BOM

::endpoint-card{method="GET" path="/api/bom/:id"}

Retrieves a single bill of materials by its unique identifier. Unlike the list endpoint, this response includes a computed `summary` object with real-time production statistics for each BOM entry. The summary is calculated by querying serial number completion data for each entry's referenced job.

Use this endpoint to display a BOM detail view with progress tracking, showing how many parts have been completed vs. how many are still outstanding for each entry.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The unique identifier of the BOM (e.g. `"bom_abc123"`) |

## Response

### 200 OK

Returns the `BOM` object merged with a `summary` field containing production statistics.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the BOM |
| `name` | `string` | Human-readable BOM name |
| `entries` | `BomEntry[]` | Array of job entries |
| `entries[].id` | `string \| undefined` | Entry ID, if assigned |
| `entries[].bomId` | `string \| undefined` | Parent BOM ID reference |
| `entries[].jobId` | `string` | Referenced job ID |
| `entries[].requiredQuantity` | `number` | Quantity needed per build |
| `createdAt` | `string` | ISO 8601 timestamp of creation |
| `updatedAt` | `string` | ISO 8601 timestamp of last modification |
| `summary` | `BomSummary` | Computed production statistics |
| `summary.bomId` | `string` | The BOM ID (same as top-level `id`) |
| `summary.bomName` | `string` | The BOM name (same as top-level `name`) |
| `summary.entries` | `BomEntrySummary[]` | Per-entry production statistics |
| `summary.entries[].jobId` | `string` | The job ID for this entry |
| `summary.entries[].jobName` | `string` | The human-readable name of the referenced job |
| `summary.entries[].requiredQuantity` | `number` | Required quantity per build |
| `summary.entries[].totalCompleted` | `number` | Total completed serials for this job |
| `summary.entries[].totalInProgress` | `number` | Total in-progress serials for this job |
| `summary.entries[].totalOutstanding` | `number` | Remaining units needed (`max(0, required - completed)`) |

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
      "jobId": "job_001",
      "requiredQuantity": 4
    },
    {
      "id": "entry_002",
      "bomId": "bom_abc123",
      "jobId": "job_003",
      "requiredQuantity": 12
    }
  ],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "summary": {
    "bomId": "bom_abc123",
    "bomName": "Widget Assembly BOM",
    "entries": [
      {
        "jobId": "job_001",
        "jobName": "Steel Plate Production",
        "requiredQuantity": 4,
        "totalCompleted": 3,
        "totalInProgress": 5,
        "totalOutstanding": 1
      },
      {
        "jobId": "job_003",
        "jobName": "Bolt M8 Assembly",
        "requiredQuantity": 12,
        "totalCompleted": 12,
        "totalInProgress": 0,
        "totalOutstanding": 0
      }
    ]
  }
}
```

### Response — BOM with no job progress

```json
{
  "id": "bom_def456",
  "name": "New Product BOM",
  "entries": [
    {
      "id": "entry_003",
      "bomId": "bom_def456",
      "jobId": "job_005",
      "requiredQuantity": 2
    }
  ],
  "createdAt": "2024-01-20T09:00:00.000Z",
  "updatedAt": "2024-01-20T09:00:00.000Z",
  "summary": {
    "bomId": "bom_def456",
    "bomName": "New Product BOM",
    "entries": [
      {
        "jobId": "job_005",
        "jobName": "Custom Bracket Run",
        "requiredQuantity": 2,
        "totalCompleted": 0,
        "totalInProgress": 0,
        "totalOutstanding": 0
      }
    ]
  }
}
```

## Notes

- The `summary` field is computed in real time on every request. It is not cached or stored — it reflects the current state of serial number completion for each referenced job.
- The `totalOutstanding` value is calculated as `max(0, requiredQuantity - totalCompleted)`. It will never be negative, even if more serials have been completed than required.
- The `jobName` in each summary entry is resolved from the referenced job at query time. If the job has been renamed since the BOM was created, the summary reflects the current name.
- Scrapped serials are excluded from `totalCompleted` but included in the total count used to compute `totalInProgress`.

## Related Endpoints

- [List BOMs](/api-docs/bom/list) — Retrieve all BOMs (without summary)
- [Edit BOM](/api-docs/bom/edit) — Make a versioned edit to this BOM
- [List BOM Versions](/api-docs/bom/versions) — View the change history
- [Update BOM](/api-docs/bom/update) — Simple update without version tracking

::
