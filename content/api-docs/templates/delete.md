---
title: 'Delete Template'
description: 'Permanently delete a route template'
method: 'DELETE'
endpoint: '/api/templates/:id'
service: 'templateService'
category: 'Templates'
responseType: '{ success: true }'
errorCodes: [404, 500]
navigation:
  order: 5
---

# Delete Template

::endpoint-card{method="DELETE" path="/api/templates/:id"}

Permanently deletes a route template by its ID. Once deleted, the template cannot be recovered or applied to new jobs.

Deleting a template does **not** affect any paths that were previously created from it. Paths are deep-cloned from templates at application time, so they are fully independent entities. Existing paths, their steps, and any serial numbers routing through them will continue to function normally after the source template is deleted.

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                                            |
| --------- | -------- | -------- | ---------------------------------------------------------------------- |
| `id`      | `string` | Yes      | The unique identifier of the template to delete (e.g. `"tmpl_abc123"`) |

No request body is required.

## Response

### 200 OK

Returned when the template is successfully deleted.

| Field     | Type      | Description                          |
| --------- | --------- | ------------------------------------ |
| `success` | `boolean` | Always `true` on successful deletion |

### 404 Not Found

Returned when no template exists with the given ID.

| Condition               | Message                                  |
| ----------------------- | ---------------------------------------- |
| Template does not exist | `"TemplateRoute not found: tmpl_abc123"` |

### 500 Internal Server Error

Returned if an unhandled error occurs while deleting the template.

| Condition              | Message                   |
| ---------------------- | ------------------------- |
| Database write failure | `"Internal Server Error"` |

## Examples

### Request

```bash
curl -X DELETE http://localhost:3000/api/templates/tmpl_abc123
```

### Response — Successful deletion

```json
{
  "success": true
}
```

### Request — Non-existent template

```bash
curl -X DELETE http://localhost:3000/api/templates/tmpl_nonexistent
```

### Response — 404

```json
{
  "statusCode": 404,
  "message": "TemplateRoute not found: tmpl_nonexistent"
}
```

## Notes

- This operation is **irreversible**. There is no soft-delete or recycle bin. Once a template is deleted, it is permanently removed from the database.
- Deletion does not cascade to any other entities. Paths created from this template remain intact and fully functional.
- There is no audit trail entry for template deletion. If you need to track who deleted a template and when, consider implementing a soft-delete pattern or logging externally.
- The endpoint returns `{ success: true }` rather than the deleted template object. If you need the template data before deletion, fetch it first with [Get Template](/api-docs/templates/get).

## Related Endpoints

- [Get Template](/api-docs/templates/get) — Retrieve a template before deleting it
- [List Templates](/api-docs/templates/list) — Browse all remaining templates
- [Create Template](/api-docs/templates/create) — Create a replacement template

::
