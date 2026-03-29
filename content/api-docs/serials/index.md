---
title: 'Serials API'
description: 'Serial number lifecycle — creation, advancement, completion, scrap, force-complete, step overrides, waivers, deferred steps, and certificate attachments'
icon: 'i-lucide-hash'
navigation:
  order: 3
---

# Serials API

The Serials API manages the complete lifecycle of serial numbers in Shop Planr. A **serial number** represents a single physical unit being produced — it is created against a specific job and path, advances through that path's ordered process steps, and ultimately reaches one of three terminal states: **completed**, **scrapped**, or **force-completed**.

## Domain Concepts

### Serial Number Lifecycle

Every serial number follows a predictable lifecycle:

1. **Creation** — Serials are created in batches via `POST /api/serials`. Each serial is assigned a sequential identifier (e.g. `SN-00001`) and placed at step index `0` (the first process step) with status `in_progress`. Step status records are initialized for every step in the path: the first step gets `in_progress`, all others get `pending`.

2. **Advancement** — As work is completed, serials advance through the path's steps via `POST /api/serials/:id/advance` (next step) or `POST /api/serials/:id/advance-to` (jump to a specific step). Each advancement updates the serial's `currentStepIndex` and records an audit trail entry. When a serial advances past the final step, it transitions to `completed` status with `currentStepIndex: -1`.

3. **Terminal States** — A serial reaches one of three endpoints:
   - **Completed** — Advanced through all required steps normally. `status: "completed"`, `currentStepIndex: -1`.
   - **Scrapped** — Removed from production due to a defect or error. `status: "scrapped"` with a mandatory reason code and optional explanation.
   - **Force-completed** — Marked as done despite having incomplete required steps. `status: "completed"`, `forceCompleted: true`, with an optional reason.

### Step Statuses

Each serial maintains a per-step status record (`SnStepStatus`) for every step in its path. These statuses track the granular state of each step independently of the serial's overall position:

| Status        | Meaning                                                |
| ------------- | ------------------------------------------------------ |
| `pending`     | Step has not been reached yet                          |
| `in_progress` | Serial is currently at this step                       |
| `completed`   | Step was completed normally                            |
| `skipped`     | Optional step was bypassed during advancement          |
| `deferred`    | Required step was bypassed but must be completed later |
| `waived`      | Deferred step was formally waived by an approver       |

### Advancement Modes

The path's `advancementMode` controls how serials move through steps:

- **`strict`** — Serials can only advance to the immediately next step (N+1). No skipping allowed.
- **`flexible`** — Serials can jump forward, automatically skipping optional steps and deferring required ones.
- **`per_step`** — Like flexible, but each step's `dependencyType` determines whether it can be bypassed. Steps with `physical` dependency cannot be skipped unless they are optional or have an active override.

### Step Overrides

A **step override** (`SnStepOverride`) marks a specific step as effectively optional for a particular serial number. When an override is active, the step can be skipped during advancement even if it would normally be required. Overrides are reversible — they can be deactivated as long as the step hasn't already been skipped or completed.

### Waivers

A **waiver** is a formal approval to permanently excuse a deferred required step. Unlike overrides (which affect future advancement), waivers resolve steps that were already bypassed. Waivers require an approver ID and a reason, and they change the step status from `deferred` to `waived`. Only deferred required steps can be waived — optional steps cannot.

### Deferred Steps

When a required step is bypassed during advancement (in `flexible` or `per_step` mode), it receives `deferred` status. Deferred steps represent work that still needs to happen, just not in the original sequence. They can be resolved in two ways:

- **Completed later** via `POST /api/serials/:id/complete-deferred/:stepId` — changes status from `deferred` to `completed`.
- **Waived** via `POST /api/serials/:id/waive-step/:stepId` — changes status from `deferred` to `waived` with formal approval.

### Certificate Attachments

Certificates (material certs, process certs) can be attached to serial numbers at their current process step. Attachments are idempotent — re-attaching the same certificate at the same step is a no-op. Each attachment records which step the serial was at when the certificate was attached, creating a traceable chain of custody.

### Relationship to Jobs and Paths

Serials exist within the hierarchy: **Job → Path → Serial Numbers**. A job represents the production order, a path defines the manufacturing route (sequence of process steps), and serial numbers are the individual units flowing through that route. Every serial belongs to exactly one job and one path. The job's overall progress is computed by aggregating serial completion data across all of its paths.

## Endpoints

| Method   | Path                                                                                | Description                                |
| -------- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| `GET`    | [`/api/serials`](/api-docs/serials/list)                                            | List all serial numbers with enriched data |
| `GET`    | [`/api/serials/:id`](/api-docs/serials/get)                                         | Get a single serial with certificate data  |
| `POST`   | [`/api/serials`](/api-docs/serials/create)                                          | Batch create serial numbers for a job path |
| `POST`   | [`/api/serials/:id/advance`](/api-docs/serials/advance)                             | Advance to the next process step           |
| `POST`   | [`/api/serials/:id/advance-to`](/api-docs/serials/advance-to)                       | Advance to a specific target step          |
| `POST`   | [`/api/serials/:id/scrap`](/api-docs/serials/scrap)                                 | Scrap a serial number                      |
| `POST`   | [`/api/serials/:id/force-complete`](/api-docs/serials/force-complete)               | Force-complete bypassing remaining steps   |
| `POST`   | [`/api/serials/:id/attach-cert`](/api-docs/serials/attach-cert)                     | Attach a certificate at the current step   |
| `GET`    | [`/api/serials/:id/cert-attachments`](/api-docs/serials/cert-attachments)           | List all certificate attachments           |
| `GET`    | [`/api/serials/:id/step-statuses`](/api-docs/serials/step-statuses)                 | Get per-step status tracking               |
| `GET`    | [`/api/serials/:id/overrides`](/api-docs/serials/overrides)                         | List step overrides                        |
| `POST`   | [`/api/serials/:id/overrides`](/api-docs/serials/overrides)                         | Create a step override                     |
| `DELETE` | [`/api/serials/:id/overrides/:stepId`](/api-docs/serials/override-delete)           | Reverse a step override                    |
| `POST`   | [`/api/serials/:id/waive-step/:stepId`](/api-docs/serials/waive-step)               | Waive a deferred step                      |
| `POST`   | [`/api/serials/:id/complete-deferred/:stepId`](/api-docs/serials/complete-deferred) | Complete a deferred step                   |

## Related APIs

- [Jobs API](/api-docs/jobs) — Production orders that serial numbers belong to
- [Paths API](/api-docs/paths) — Manufacturing routes that define the step sequence
- [Certificates API](/api-docs/certs) — Certificate management and creation
- [Audit API](/api-docs/audit) — Immutable audit trail of all serial lifecycle events
