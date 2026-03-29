---
title: "Get Serial"
description: "Retrieve a single serial number by ID with its associated certificate data"
method: "GET"
endpoint: "/api/serials/:id"
service: "serialService"
category: "Serials"
responseType: "SerialNumber & { certs: Certificate[] }"
errorCodes: [400, 404, 500]
navigation:
  order: 2
---

# Get Serial

::endpoint-card{method="GET" path="/api/serials/:id"}

Retrieves a single serial number by its unique identifier, enriched with the full list of certificates that have been attached to it. This is the primary endpoint for building serial detail views, as it combines the core serial record with its certificate chain in a single response.

The response includes all serial fields — including scrap metadata, force-completion metadata, and timestamps — plus a `certs` array containing the full `Certificate` objects (not just attachment records). Use the [Get Cert Attachments](/api-docs/serials/cert-attachments) endpoint if you need the attachment-level detail (which step each cert was attached at, who attached it, and when).

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The unique identifier of the serial number to retrieve (e.g. `"SN-00001"`) |

## Response

### 200 OK

Returned when the serial is found. The response is a single object containing all `SerialNumber` fields plus a `certs` array.

#### Serial Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique serial identifier (e.g. `"SN-00001"`) |
| `jobId` | `string` | ID of the parent job |
| `pathId` | `string` | ID of the manufacturing path |
| `currentStepIndex` | `number` | Zero-based index of the current step. `-1` when completed. |
| `status` | `"in_progress" \| "completed" \| "scrapped"` | Current lifecycle status (underscore format) |
| `scrapReason` | `string \| undefined` | Scrap reason code. One of: `"out_of_tolerance"`, `"process_defect"`, `"damaged"`, `"operator_error"`, `"other"`. Present only when `status` is `"scrapped"`. |
| `scrapExplanation` | `string \| undefined` | Free-text explanation for the scrap. Required when `scrapReason` is `"other"`. |
| `scrapStepId` | `string \| undefined` | ID of the step where the serial was scrapped |
| `scrappedAt` | `string \| undefined` | ISO 8601 timestamp of when the serial was scrapped |
| `scrappedBy` | `string \| undefined` | User ID of who scrapped the serial |
| `forceCompleted` | `boolean` | Whether the serial was force-completed (bypassing remaining steps) |
| `forceCompletedBy` | `string \| undefined` | User ID of who force-completed the serial |
| `forceCompletedAt` | `string \| undefined` | ISO 8601 timestamp of when the serial was force-completed |
| `forceCompletedReason` | `string \| undefined` | Reason provided for force-completing |
| `createdAt` | `string` | ISO 8601 timestamp of when the serial was created |
| `updatedAt` | `string` | ISO 8601 timestamp of the last modification |

#### `certs` — Array of Certificate objects

Each element represents a certificate that has been attached to this serial at some point during production.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the certificate |
| `type` | `"material" \| "process"` | Certificate type — material certs cover raw materials, process certs cover manufacturing processes |
| `name` | `string` | Human-readable certificate name (e.g. `"Steel Grade A Cert"`) |
| `metadata` | `object \| undefined` | Arbitrary key-value metadata stored on the certificate |
| `createdAt` | `string` | ISO 8601 timestamp of when the certificate was created |

### 400 Bad Request

Returned if a validation error occurs during the request.

| Condition | Message |
|-----------|---------|
| Malformed or invalid `id` parameter | Varies — describes the specific validation issue |

### 404 Not Found

Returned when no serial number exists with the given ID.

| Condition | Message |
|-----------|---------|
| Serial does not exist | `"SerialNumber not found: {id}"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while fetching the serial or its certificates.

| Condition | Message |
|-----------|---------|
| Database connection failure | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request

```bash
curl -X GET http://localhost:3000/api/serials/SN-00001 \
  -H "Accept: application/json"
```

### Response — In-progress serial with certificates

```json
{
  "id": "SN-00001",
  "jobId": "job_abc123",
  "pathId": "path_xyz789",
  "currentStepIndex": 1,
  "status": "in_progress",
  "forceCompleted": false,
  "createdAt": "2024-01-15T11:00:00.000Z",
  "updatedAt": "2024-01-15T14:00:00.000Z",
  "certs": [
    {
      "id": "cert_mat01",
      "type": "material",
      "name": "Steel Grade A Cert",
      "metadata": { "grade": "A36", "supplier": "MetalCo" },
      "createdAt": "2024-01-10T08:00:00.000Z"
    },
    {
      "id": "cert_proc01",
      "type": "process",
      "name": "Heat Treatment Cert",
      "createdAt": "2024-01-12T10:00:00.000Z"
    }
  ]
}
```

### Response — Scrapped serial

```json
{
  "id": "SN-00005",
  "jobId": "job_abc123",
  "pathId": "path_xyz789",
  "currentStepIndex": 2,
  "status": "scrapped",
  "scrapReason": "out_of_tolerance",
  "scrapStepId": "step_003",
  "scrappedAt": "2024-01-16T15:30:00.000Z",
  "scrappedBy": "user_qc1",
  "forceCompleted": false,
  "createdAt": "2024-01-15T11:00:00.000Z",
  "updatedAt": "2024-01-16T15:30:00.000Z",
  "certs": []
}
```

### Response — Force-completed serial

```json
{
  "id": "SN-00010",
  "jobId": "job_def456",
  "pathId": "path_abc111",
  "currentStepIndex": -1,
  "status": "completed",
  "forceCompleted": true,
  "forceCompletedBy": "user_supervisor",
  "forceCompletedAt": "2024-01-17T17:00:00.000Z",
  "forceCompletedReason": "Customer accepted partial completion",
  "createdAt": "2024-01-16T09:30:00.000Z",
  "updatedAt": "2024-01-17T17:00:00.000Z",
  "certs": [
    {
      "id": "cert_mat02",
      "type": "material",
      "name": "Aluminum 7075 Cert",
      "createdAt": "2024-01-14T08:00:00.000Z"
    }
  ]
}
```

## Notes

- The `status` field uses **underscore** format (`"in_progress"`) — this is the raw domain format, unlike the [List Serials](/api-docs/serials/list) endpoint which normalizes to hyphenated format (`"in-progress"`).
- The `certs` array contains full `Certificate` objects, not `CertAttachment` records. To see which step each certificate was attached at, use the [Get Cert Attachments](/api-docs/serials/cert-attachments) endpoint.
- A completed serial has `currentStepIndex: -1` regardless of whether it completed normally or was force-completed. Check the `forceCompleted` boolean to distinguish between the two.
- Scrap-related fields (`scrapReason`, `scrapExplanation`, `scrapStepId`, `scrappedAt`, `scrappedBy`) are only present when `status` is `"scrapped"`. They are `undefined` (omitted from JSON) otherwise.
- Force-completion fields (`forceCompletedBy`, `forceCompletedAt`, `forceCompletedReason`) are only present when `forceCompleted` is `true`.

## Related Endpoints

- [List Serials](/api-docs/serials/list) — Retrieve all serials with enriched display data
- [Get Cert Attachments](/api-docs/serials/cert-attachments) — Get attachment-level certificate detail for a serial
- [Get Step Statuses](/api-docs/serials/step-statuses) — Get per-step status tracking for a serial
- [Scrap Serial](/api-docs/serials/scrap) — Mark this serial as scrapped
- [Force Complete Serial](/api-docs/serials/force-complete) — Force-complete this serial

::
