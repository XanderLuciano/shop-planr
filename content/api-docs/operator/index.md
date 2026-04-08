---
title: "Operator API"
description: "Workstation views — step data, work queues, and operator assignments"
icon: "i-lucide-hard-hat"
navigation:
  order: 12
---

# Operator API

The Operator API provides aggregated, read-only views designed for shop floor workstations. These endpoints combine data from jobs, paths, serials, users, and notes to power the Parts View, Step View, and Operator Work Queue pages. They are optimized for display — computing serial counts, grouping work by operator, and providing navigation context (previous/next step) in a single response.

## Concepts

### Parts View vs. Step View

The operator experience is split into two complementary views:

- **Parts View** (`GET /api/operator/:stepName`) — Shows all parts across all jobs that are at a named process step (e.g. "Assembly"). Groups parts into three buckets: current (at the step), coming soon (one step before), and backlog (two+ steps before). This is the entry point for operators who work at a specific station.

- **Step View** (`GET /api/operator/step/:stepId`) — Shows detailed data for a single step instance within a specific job/path. Includes the serial list, notes, and navigation to previous/next steps. This is the detail page operators land on when they click into a specific step from the Parts View.

### Work Queue

The work queue provides a higher-level view of all active work across the shop:

- **Grouped queue** (`GET /api/operator/work-queue`) — Groups all active steps by a configurable dimension (user, location, or step), showing workload distribution with part counts. Unassigned work is grouped under "Unassigned". Includes first-step entries for paths that still need parts fabricated.

- **All queue items** (`GET /api/operator/queue/_all`) — Flat list of all active step/job/path combinations with part counts. Includes first-step entries (the first non-soft-deleted step in a path) when `completedCount < goalQuantity`, even with zero parts currently present.

### WorkQueueJob Shape

All queue and step view endpoints return data using the `WorkQueueJob` type, which provides a denormalized view of a step within a job/path context:

- Job and path identifiers and names
- Step details (ID, name, order, location)
- Serial IDs and count at the step
- Navigation context (previous/next step names and locations)
- Whether this is the final step in the path

### Zero-Serial Steps

The `_all` queue endpoint and the grouped `work-queue` endpoint include the **first active step** (the first non-soft-deleted step in a path) even when it has zero parts currently present, as long as `completedCount < goalQuantity`. This ensures the serial creation panel is accessible for paths that still need parts fabricated. Once `completedCount >= goalQuantity`, the step follows normal inclusion rules (only shown if it has parts). Soft-deleted steps are always excluded.

## Common Use Cases

- **Supervisor dashboard** — View the grouped work queue to see workload distribution across operators, locations, or steps, and identify unassigned work.
- **Station monitor** — Display the Parts View for a specific step name on a wall-mounted screen to show real-time part flow.
- **First-step tracking** — See which paths still need initial part fabrication, with progress indicators showing `completedCount / goalQuantity`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | [`/api/operator/step/:stepId`](/api-docs/operator/step-view) | Get step view data for a specific step instance |
| `GET` | [`/api/operator/work-queue`](/api-docs/operator/work-queue) | Get work queue grouped by dimension |
| `GET` | [`/api/operator/queue/_all`](/api-docs/operator/queue-all) | Get all queue items (flat list) |
| `GET` | [`/api/operator/:stepName`](/api-docs/operator/by-step-name) | Get parts view data by step name |

## Related

- [Steps API](/api-docs/steps) — Assign operators to steps and configure step properties
- [Users API](/api-docs/users) — Manage operator profiles
- [Serials API](/api-docs/serials) — Serial numbers displayed in operator views
- [Notes API](/api-docs/notes) — Notes included in the step view response
