---
title: 'Notes API'
description: 'Process step notes and defect tracking on serials'
icon: 'i-lucide-sticky-note'
navigation:
  order: 11
---

# Notes API

The Notes API manages process step notes — free-text observations, defect records, and quality annotations attached to one or more serial numbers at a specific process step. Notes provide a lightweight mechanism for operators to document issues, observations, and process deviations without leaving the production workflow.

## Concepts

### Note Anatomy

A `StepNote` is anchored to three coordinates in the production hierarchy:

- **Job** (`jobId`) — The production order
- **Path** (`pathId`) — The specific route within the job
- **Step** (`stepId`) — The process step where the observation was made

It also references one or more **serial numbers** (`serialIds`) — the specific parts the note applies to. This many-to-many relationship allows a single note to describe an issue affecting multiple serials at the same step (e.g. "Batch of 5 units showed surface discoloration after anodizing").

### Attribution

Every note records a `createdBy` user ID linking it to the operator who wrote it. This appears in the UI and audit trail for accountability.

### Jira Integration

Notes can be pushed to Jira as comments via the [Comment endpoint](/api-docs/jira/comment). The `pushedToJira` boolean tracks whether a note has been sent to Jira, and `jiraCommentId` stores the resulting Jira comment ID for reference. Note that pushing is a one-way operation — updates to the note in Shop Planr are not synced back to Jira.

### Audit Trail

Creating a note generates an `note_created` audit entry with the user, job, path, and step IDs recorded for traceability.

### Query Patterns

Notes can be queried two ways:

- **By serial** — Returns all notes that reference a specific serial number, across all steps and paths. Used on the serial detail page to show the complete note history for a part.
- **By step** — Returns all notes attached to a specific process step, across all serials. Used in the operator step view to show all observations at the current workstation.

## Common Use Cases

- **Document a defect** — Operator notices a surface blemish during inspection and creates a note on the affected serials at the Inspection step.
- **Record a process deviation** — A step was performed with a substitute tool; operator notes the deviation for traceability.
- **Escalate to Jira** — After creating a note, push it to the linked Jira ticket as a comment so project managers are aware.
- **Review part history** — On the serial detail page, view all notes across all steps to understand the full production history of a part.

## Endpoints

| Method | Path                                                 | Description                                |
| ------ | ---------------------------------------------------- | ------------------------------------------ |
| `POST` | [`/api/notes`](/api-docs/notes/create)               | Create a step note for one or more serials |
| `GET`  | [`/api/notes/serial/:id`](/api-docs/notes/by-serial) | Get all notes referencing a serial number  |
| `GET`  | [`/api/notes/step/:id`](/api-docs/notes/by-step)     | Get all notes attached to a process step   |

## Related

- [Jira API — Comment](/api-docs/jira/comment) — Push notes to Jira as comments
- [Operator API — Step View](/api-docs/operator/step-view) — Step view includes notes for the current step
- [Serials API](/api-docs/serials) — Serial numbers that notes reference
