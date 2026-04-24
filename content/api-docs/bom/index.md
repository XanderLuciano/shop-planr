---
title: "BOM API"
description: "Bill of materials management — job-based entries, versioned editing, and production tracking"
icon: "i-lucide-layers"
navigation:
  order: 6
---

# BOM API

The BOM (Bill of Materials) API manages material requirements for production builds. A BOM defines which jobs are needed, how many units each must produce, and tracks real-time production progress. The API supports full CRUD operations, versioned editing with change tracking, and real-time production summary roll-ups.

## Domain Concepts

### BOMs and Entries

A BOM is a named collection of **entries**. Each entry references a single job and specifies:

- **`jobId`** — The ID of the job this entry tracks (e.g., `"job_001"`). Each job can only appear once per BOM.
- **`requiredQuantity`** — How many units are needed per build. Defaults to 1 if omitted during creation or editing.

### Versioned Editing

The BOM API distinguishes between two types of modifications:

- **Simple update** (`PUT /api/bom/:id`) — Directly modifies the BOM's name or entries without creating a version record. Use this for corrections or non-significant changes.
- **Versioned edit** (`POST /api/bom/:id/edit`) — Updates the BOM entries and simultaneously creates an immutable `BomVersion` snapshot of the **previous** state. Each version records the entries as they were before the edit, a change description, the user who made the change, and an auto-incrementing version number. This provides a full audit trail of BOM modifications over time.

Versioned edits also generate a `bom_edited` entry in the [Audit API](/api-docs/audit), linking the change to the user and recording the version number and description.

### BOM Summary

The `GET /api/bom/:id` endpoint returns a `summary` object alongside the BOM data. The summary computes real-time production statistics for each entry by querying serial number counts for the referenced job:

- **`jobId`** / **`jobName`** — The job reference and its human-readable name.
- **`totalCompleted`** — How many serials for this job have reached `completed` status.
- **`totalInProgress`** — How many serials are still in progress.
- **`totalOutstanding`** — How many more completed units are needed to meet the `requiredQuantity` target.

## Common Use Cases

- **Defining material requirements**: Create a BOM with entries for each job needed, specifying the required quantity for each.
- **Tracking production against requirements**: Fetch a BOM by ID to see real-time summary data showing how many parts have been completed vs. how many are still needed.
- **Recording engineering changes**: Use the versioned edit endpoint to update BOM entries while preserving a history of what changed, when, and why.
- **Reviewing change history**: Fetch the version history for a BOM to see every past state of its entries, with change descriptions and user attribution.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | [`/api/bom`](/api-docs/bom/list) | List all BOMs |
| `GET` | [`/api/bom/:id`](/api-docs/bom/get) | Get a BOM by ID with production summary |
| `POST` | [`/api/bom`](/api-docs/bom/create) | Create a new BOM |
| `PUT` | [`/api/bom/:id`](/api-docs/bom/update) | Update a BOM (simple, no version) |
| `POST` | [`/api/bom/:id/edit`](/api-docs/bom/edit) | Edit a BOM (versioned, with change tracking) |
| `GET` | [`/api/bom/:id/versions`](/api-docs/bom/versions) | Get the version history of a BOM |

## Related APIs

- [Jobs API](/api-docs/jobs) — The jobs referenced by BOM entry `jobId`
- [Serials API](/api-docs/serials) — Serial numbers whose completion drives BOM summary statistics
- [Audit API](/api-docs/audit) — Query `bom_edited` audit entries for change traceability
