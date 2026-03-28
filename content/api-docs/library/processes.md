---
title: "List & Create Processes"
description: "Retrieve all process library entries or create a new one"
method: "GET"
endpoint: "/api/library/processes"
service: "libraryService"
category: "Library"
responseType: "ProcessLibraryEntry[]"
errorCodes: [400]
navigation:
  order: 1
---

# List & Create Processes

## List Processes

::endpoint-card{method="GET" path="/api/library/processes"}

Retrieves all entries in the process library. Process library entries are reusable process step names.

### Response

Returns an array of `ProcessLibraryEntry` objects:

```json
[
  {
    "id": "proc_001",
    "name": "Assembly",
    "createdAt": "2024-01-10T08:00:00Z"
  },
  {
    "id": "proc_002",
    "name": "Inspection",
    "createdAt": "2024-01-10T08:00:00Z"
  }
]
```

### Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error |

::

## Create Process

::endpoint-card{method="POST" path="/api/library/processes"}

Creates a new entry in the process library.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Process name |

### Example Request

```json
{
  "name": "Powder Coating"
}
```

### Response

Returns the created `ProcessLibraryEntry` object:

```json
{
  "id": "proc_003",
  "name": "Powder Coating",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Errors

| Code | Condition |
|------|-----------|
| `400` | Missing `name` or duplicate entry |

::
