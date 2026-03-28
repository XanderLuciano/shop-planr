---
title: "List & Create Locations"
description: "Retrieve all location library entries or create a new one"
method: "GET"
endpoint: "/api/library/locations"
service: "libraryService"
category: "Library"
responseType: "LocationLibraryEntry[]"
errorCodes: [400]
navigation:
  order: 3
---

# List & Create Locations

## List Locations

::endpoint-card{method="GET" path="/api/library/locations"}

Retrieves all entries in the location library. Location library entries are reusable location names for process steps.

### Response

Returns an array of `LocationLibraryEntry` objects:

```json
[
  {
    "id": "loc_001",
    "name": "Bay 3",
    "createdAt": "2024-01-10T08:00:00Z"
  },
  {
    "id": "loc_002",
    "name": "QC Lab",
    "createdAt": "2024-01-10T08:00:00Z"
  }
]
```

### Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error |

::

## Create Location

::endpoint-card{method="POST" path="/api/library/locations"}

Creates a new entry in the location library.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Location name |

### Example Request

```json
{
  "name": "Paint Booth"
}
```

### Response

Returns the created `LocationLibraryEntry` object:

```json
{
  "id": "loc_003",
  "name": "Paint Booth",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Errors

| Code | Condition |
|------|-----------|
| `400` | Missing `name` or duplicate entry |

::
