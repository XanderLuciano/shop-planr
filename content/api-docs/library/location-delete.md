---
title: "Delete Location"
description: "Delete a location library entry by ID"
method: "DELETE"
endpoint: "/api/library/locations/:id"
service: "libraryService"
category: "Library"
responseType: "{ success: true }"
errorCodes: [404, 500]
navigation:
  order: 4
---

# Delete Location

::endpoint-card{method="DELETE" path="/api/library/locations/:id"}

Deletes a location library entry by its ID. The entry is permanently removed from the library and will no longer appear in dropdown lists for step location configuration.

Deleting a library entry does **not** affect any existing steps that use the same location name. Library entries are reference data for future data entry — they have no foreign key relationship to steps. A step with location "Bay 1" will continue to display that location even if the "Bay 1" library entry is deleted.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The location library entry ID to delete (e.g. `"lloc_a1b2c3"`). |

## Response

### 200 OK

Returns a success confirmation.

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Always `true` on successful deletion |

### 404 Not Found

| Condition | Message |
|-----------|---------|
| No location library entry exists with the given ID | `"LocationLibraryEntry not found: {id}"` |

### 500 Internal Server Error

| Condition | Message |
|-----------|---------|
| Database delete failure | `"Internal Server Error"` |

## Examples

### Request

```bash
curl -X DELETE http://localhost:3000/api/library/locations/lloc_a1b2c3
```

### Response — Deleted successfully

```json
{
  "success": true
}
```

### Error — Not found

```bash
curl -X DELETE http://localhost:3000/api/library/locations/lloc_nonexistent
# 404: { "message": "LocationLibraryEntry not found: lloc_nonexistent" }
```

## Notes

- Deletion is permanent. There is no soft delete or undo mechanism for library entries.
- The deleted entry's name can be re-created later via `POST /api/library/locations`.
- Existing steps with the deleted location name are unaffected. The library is a convenience for dropdown population, not a constraint.
- No audit trail entry is created for library deletions.
- If the deleted location contained the substring "vendor", the `vendorPartsCount` in the [Parts View](/api-docs/operator/by-step-name) endpoint is unaffected because that metric reads from the step's `location` field, not the library.

## Related Endpoints

- [List & Create Locations](/api-docs/library/locations) — List all entries or create a new one
- [Delete Process](/api-docs/library/process-delete) — Delete a process library entry

::
