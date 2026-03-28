---
title: "Delete Process"
description: "Delete a process library entry by ID"
method: "DELETE"
endpoint: "/api/library/processes/:id"
service: "libraryService"
category: "Library"
responseType: "{ success: true }"
errorCodes: [404, 500]
navigation:
  order: 2
---

# Delete Process

::endpoint-card{method="DELETE" path="/api/library/processes/:id"}

Deletes a process library entry by its ID. The entry is permanently removed from the library and will no longer appear in dropdown lists for template and path creation.

Deleting a library entry does **not** affect any existing paths, steps, or templates that use the same process name. Library entries are reference data for future data entry — they have no foreign key relationship to steps. A step named "CNC Machining" will continue to function normally even if the "CNC Machining" library entry is deleted.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The process library entry ID to delete (e.g. `"plib_a1b2c3"`). |

## Response

### 200 OK

Returns a success confirmation.

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Always `true` on successful deletion |

### 404 Not Found

| Condition | Message |
|-----------|---------|
| No process library entry exists with the given ID | `"ProcessLibraryEntry not found: {id}"` |

### 500 Internal Server Error

| Condition | Message |
|-----------|---------|
| Database delete failure | `"Internal Server Error"` |

## Examples

### Request

```bash
curl -X DELETE http://localhost:3000/api/library/processes/plib_a1b2c3
```

### Response — Deleted successfully

```json
{
  "success": true
}
```

### Error — Not found

```bash
curl -X DELETE http://localhost:3000/api/library/processes/plib_nonexistent
# 404: { "message": "ProcessLibraryEntry not found: plib_nonexistent" }
```

## Notes

- Deletion is permanent. There is no soft delete or undo mechanism for library entries.
- The deleted entry's name can be re-created later via `POST /api/library/processes`.
- Existing paths and templates are unaffected by library deletions. The library is a convenience for dropdown population, not a constraint.
- No audit trail entry is created for library deletions.

## Related Endpoints

- [List & Create Processes](/api-docs/library/processes) — List all entries or create a new one
- [Delete Location](/api-docs/library/location-delete) — Delete a location library entry

::
