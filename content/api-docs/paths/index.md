---
title: "Paths API"
description: "Manufacturing route management — define ordered process steps, configure advancement modes, and track serial number distribution across production stages"
icon: "i-lucide-route"
navigation:
  order: 2
---

# Paths API

The Paths API manages manufacturing routes within production jobs. A **path** defines the specific sequence of process steps that serial numbers travel through on their way to completion. Every job has at least one path, and complex jobs can have multiple paths to support parallel routing strategies such as primary production, rework loops, or alternate manufacturing methods.

## Domain Concepts

### Paths and Jobs

A path always belongs to a single job (referenced by `jobId`). While the job defines *what* is being produced and *how many*, the path defines *how* — the ordered sequence of operations that each unit must pass through. A job with a goal quantity of 100 might split production across two paths: a "Main Route" handling 80 units and a "Rework Path" handling 20 units that failed initial QC.

Each path carries its own `goalQuantity`, which represents the number of units expected to travel that specific route. Path-level goal quantities do not need to sum to the job-level goal — they are independent targets used for per-path progress tracking.

### Process Steps

Every path contains an ordered array of **process steps**. Steps represent discrete manufacturing operations — things like "CNC Machining", "Deburring", "QC Inspection", or "Final Assembly". Steps are ordered by their `order` field (zero-based) and serial numbers advance through them sequentially.

Each step can optionally specify:

- **`location`** — The physical workstation or bay where the operation is performed (e.g. `"Bay 3"`, `"QC Lab"`).
- **`assignedTo`** — A user ID indicating which operator is responsible for this step.
- **`optional`** — Whether the step can be skipped without blocking serial advancement.
- **`dependencyType`** — How strictly the step's completion is enforced. One of:
  - `physical` — The step represents a physical operation that must be performed (e.g. machining, welding).
  - `preferred` — The step should be completed but can be bypassed under certain conditions.
  - `completion_gate` — The step is a hard gate that must be completed before any downstream steps can begin (e.g. QC inspection, certification check).

### Advancement Modes

The `advancementMode` field on a path controls how serial numbers move through its steps. This is one of the most important configuration decisions when setting up a manufacturing route:

- **`strict`** (default) — Serial numbers must complete every step in exact order. No steps can be skipped or deferred. This is the safest mode for regulated manufacturing where every operation must be verified.
- **`flexible`** — Serial numbers advance sequentially, but optional steps can be skipped and preferred-dependency steps can be deferred for later completion. This mode is useful for production lines where some operations are conditional.
- **`per_step`** — Each step's advancement behavior is determined by its individual `dependencyType` and `optional` settings. This gives the most granular control, allowing a mix of hard gates and flexible steps within the same path.

### Step Distribution

When retrieving a path via `GET /api/paths/:id`, the response includes a `distribution` array alongside the path data. This distribution provides a real-time snapshot of where serial numbers are currently positioned across the path's steps — how many units are at each step, how many have completed, and which step is the current bottleneck. This data powers the production dashboard's step-level progress views.

## Common Use Cases

- **Defining a manufacturing route**: After creating a job, call `POST /api/paths` with the job ID, a descriptive name, goal quantity, and an ordered list of process steps. The path is immediately ready for serial number creation.
- **Viewing production flow**: Call `GET /api/paths/:id` to see the full path configuration along with real-time step distribution data showing where units are in the pipeline.
- **Adjusting mid-production**: Call `PUT /api/paths/:id` to rename a path, change its goal quantity, update its advancement mode, or replace its step sequence entirely.
- **Switching advancement strategy**: Call `PATCH /api/paths/:id/advancement-mode` to change only the advancement mode without touching any other path properties. Useful when production conditions change and you need to relax or tighten step enforcement.
- **Removing unused routes**: Call `DELETE /api/paths/:id` to remove a path that is no longer needed. Paths with attached serial numbers cannot be deleted.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | [`/api/paths/:id`](/api-docs/paths/get) | Get a path with step distribution |
| `POST` | [`/api/paths`](/api-docs/paths/create) | Create a new path with process steps |
| `PUT` | [`/api/paths/:id`](/api-docs/paths/update) | Update a path's name, goal, mode, or steps |
| `DELETE` | [`/api/paths/:id`](/api-docs/paths/delete) | Delete a path |
| `PATCH` | [`/api/paths/:id/advancement-mode`](/api-docs/paths/advancement-mode) | Update only the advancement mode |

## Related APIs

- [Jobs API](/api-docs/jobs) — Create and manage the production orders that paths belong to
- [Serials API](/api-docs/serials) — Create serial numbers against a path and advance them through steps
- [Templates API](/api-docs/templates) — Save and reuse common step sequences as reusable route templates
