---
title: "Steps API"
description: "Process step assignment and configuration — optional flags, dependency types"
icon: "i-lucide-list-checks"
navigation:
  order: 13
---

# Steps API

The Steps API provides endpoints for configuring individual process steps within a path. While steps are created as part of a path (via the [Paths API](/api-docs/paths)), their assignment and configuration properties can be modified independently through these PATCH endpoints.

## Concepts

### Step Identity

Every process step has a unique `id` (e.g. `"step_001"`) generated when the path is created. Steps belong to a specific path and have an `order` (zero-based index) that determines their position in the manufacturing sequence. The step ID is stable — it doesn't change when the step's properties are updated.

### Operator Assignment

Steps can be assigned to a shop user via the `assignedTo` field. Assignment determines:

- Which operator's work queue the step appears in (see [Work Queue](/api-docs/operator/work-queue))
- Who is responsible for advancing serials at this step
- How work is grouped in the operator kiosk view

Assignment is optional. Unassigned steps appear in the "Unassigned" group in the work queue. A step can be unassigned by setting `userId` to `null`.

The assign endpoint validates that the target user exists and is active. Inactive users cannot be assigned to steps.

### Configuration Properties

Two configuration properties can be modified per step:

- **`optional`** (`boolean`) — When `true`, the step can be skipped during serial advancement in flexible or per-step advancement modes. Optional steps may be deferred or waived without blocking production flow.

- **`dependencyType`** (`enum`) — Controls how the step interacts with the advancement system:
  - `"physical"` — A hard dependency. The serial must physically be at this step. Cannot be skipped or deferred.
  - `"preferred"` — The default. The step should be completed in order but can be bypassed in flexible mode.
  - `"completion_gate"` — A checkpoint step. All prior steps must be completed before this step can be started.

### Relationship to Paths

Steps are embedded within paths. Modifying a step via these endpoints updates the step in-place within its parent path. The path's `updatedAt` timestamp is not affected by step-level changes.

## Common Use Cases

- **Assign an operator** — When a new shift starts, assign operators to their workstation steps.
- **Rotate assignments** — Reassign steps between operators as workload changes.
- **Mark a step optional** — A quality hold step that can be skipped for rush orders.
- **Set a completion gate** — Ensure all prior steps are done before final inspection begins.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `PATCH` | [`/api/steps/:id/assign`](/api-docs/steps/assign) | Assign or unassign an operator to a step |
| `PATCH` | [`/api/steps/:id/config`](/api-docs/steps/config) | Update step optional flag and dependency type |

## Related

- [Paths API](/api-docs/paths) — Create and manage paths that contain steps
- [Users API](/api-docs/users) — Manage operator profiles for step assignment
- [Operator API](/api-docs/operator) — Work queue views that reflect step assignments
