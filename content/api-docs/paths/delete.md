---
title: "Delete Path"
description: "Delete a manufacturing path that has no attached serial numbers"
method: "DELETE"
endpoint: "/api/paths/:id"
service: "pathService"
category: "Paths"
responseType: "{ success: boolean }"
errorCodes: [400, 404, 500]
navigation:
  order: 5
---

# Delete Path

::endpoint-card{method="DELETE" path="/api/paths/:id"}

Deletes a manufacturing path by its unique identifier. This operation permanently removes the path and all of its process step definitions from the system. Deletion is only allowed if the path has no serial numbers attached — if any serial numbers exist on the path (regardless of their status), the request is rejected with a `400 Bad Request` error.

This safety check prevents accidental data loss. Serial numbers reference their path for step tracking, audit trails, and completion records. Deleting a path with active or completed serials would orphan those records and break production history. If you need to remove a path that has serials, you must first delete or reassign the serial numbers.

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | The unique identifier of the path to delete (e.g. `"path_xyz789"`) |

## Response

### 200 OK

Returned when the path is successfully deleted. The response is a simple confirmation object.

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Always `true` when the deletion succeeds |

### 400 Bad Request

Returned when the path cannot be deleted because it has serial numbers attached. This check runs after the path existence check — a 404 takes priority over a 400 if the path does not exist.

| Condition | Message |
|-----------|---------|
| Path has serial numbers attached | `"Cannot delete path with serial numbers attached"` |

### 404 Not Found

Returned when no path exists with the given ID. The existence check runs before the serial number check.

| Condition | Message |
|-----------|---------|
| Path does not exist | `"Path not found: {id}"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while deleting the path from the database.

| Condition | Message |
|-----------|---------|
| Database write failure | `"Internal Server Error"` |
| Unexpected runtime exception | `"Internal Server Error"` |

## Examples

### Request — Delete an empty path

```bash
curl -X DELETE http://localhost:3000/api/paths/path_unused01
```

### Response — Successful deletion

```json
{
  "success": true
}
```

### Request — Attempt to delete a path with serials

```bash
curl -X DELETE http://localhost:3000/api/paths/path_xyz789
```

### Response — 400 error (serials attached)

```json
{
  "statusCode": 400,
  "message": "Cannot delete path with serial numbers attached"
}
```

### Request — Attempt to delete a non-existent path

```bash
curl -X DELETE http://localhost:3000/api/paths/path_doesnotexist
```

### Response — 404 error

```json
{
  "statusCode": 404,
  "message": "Path not found: path_doesnotexist"
}
```

## Notes

- Deletion is **permanent and irreversible**. There is no soft-delete or trash mechanism. Once a path is deleted, its ID cannot be reused or recovered.
- The serial number check considers **all** serial statuses — `in_progress`, `completed`, and `scrapped`. Even if all serials on a path are completed or scrapped, the path still cannot be deleted while those records exist.
- Deleting a path removes all of its process step definitions. Any step assignments (`assignedTo`) are lost.
- This endpoint does **not** cascade to the parent job. Deleting a path does not affect the job or any other paths belonging to the same job.
- If a job has only one path and you delete it, the job will have zero paths. The job itself remains valid — it simply has no manufacturing routes defined until a new path is created.
- There is no request body for this endpoint. Any body content sent with the request is ignored.

## Related Endpoints

- [Get Path](/api-docs/paths/get) — Retrieve a path to check its current state before deleting
- [Create Path](/api-docs/paths/create) — Create a new manufacturing path to replace a deleted one
- [Update Path](/api-docs/paths/update) — Modify a path instead of deleting it
- [Get Job](/api-docs/jobs/get) — Retrieve the parent job to see remaining paths after deletion

::
