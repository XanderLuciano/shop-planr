---
title: 'Library API'
description: 'Reusable process name and location libraries for template building'
icon: 'i-lucide-library'
navigation:
  order: 14
---

# Library API

The Library API manages two reusable lookup libraries: process names and locations. These libraries provide consistent, standardized naming for process steps and their physical locations across the shop floor. Library entries are surfaced as dropdown options in the template editor and path creation forms, reducing typos and ensuring naming consistency.

## Concepts

### Two Libraries

The system maintains two independent libraries:

1. **Process Library** — Reusable process step names (e.g. "CNC Machining", "Deburring", "Anodizing", "Final Inspection"). When creating a path or template, operators select from these names rather than typing free-text.

2. **Location Library** — Reusable physical location names (e.g. "Bay 1", "QC Lab", "Paint Booth", "Vendor - Plating Co."). Locations are assigned to process steps to indicate where the work is performed.

### Uniqueness

Both libraries enforce **name uniqueness**. Attempting to create a duplicate entry (exact string match after trimming) returns a `400` error. This prevents the dropdown lists from accumulating redundant entries.

### Independence from Steps

Library entries are reference data only. They are not linked to existing paths or steps by foreign key. Deleting a library entry does **not** affect any existing paths, steps, or templates that use that name. The library is a convenience for future data entry, not a constraint on existing data.

### Naming Convention

Library entry names are trimmed of leading and trailing whitespace before storage. Beyond that, no formatting rules are enforced — names can contain spaces, special characters, and mixed case.

## Common Use Cases

- **Standardize step names** — Add all standard process names to the library so operators select from a consistent list when building templates.
- **Add a new workstation** — When a new bay or lab is set up, add it to the location library so it appears in dropdowns.
- **Clean up unused entries** — Delete obsolete process or location names that are no longer relevant.
- **Seed initial data** — Populate both libraries during initial deployment to match the shop's existing process flow.

## Endpoints

| Method   | Path                                                              | Description                         |
| -------- | ----------------------------------------------------------------- | ----------------------------------- |
| `GET`    | [`/api/library/processes`](/api-docs/library/processes)           | List all process library entries    |
| `POST`   | [`/api/library/processes`](/api-docs/library/processes)           | Create a new process library entry  |
| `DELETE` | [`/api/library/processes/:id`](/api-docs/library/process-delete)  | Delete a process library entry      |
| `GET`    | [`/api/library/locations`](/api-docs/library/locations)           | List all location library entries   |
| `POST`   | [`/api/library/locations`](/api-docs/library/locations)           | Create a new location library entry |
| `DELETE` | [`/api/library/locations/:id`](/api-docs/library/location-delete) | Delete a location library entry     |

## Related

- [Paths API](/api-docs/paths) — Paths use process names and locations from the library
- [Templates API](/api-docs/templates) — Templates use library entries for step name and location dropdowns
- [Settings API](/api-docs/settings) — Library management is accessed from the Settings page
