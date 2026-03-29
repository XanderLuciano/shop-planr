---
title: 'Audit API'
description: 'Immutable audit trail — query logs of all production events by action, user, serial, or date range'
icon: 'i-lucide-scroll-text'
navigation:
  order: 7
---

# Audit API

The Audit API provides read-only access to Shop Planr's append-only audit trail. Every significant production event — certificate attachments, serial number creation and advancement, lifecycle transitions, BOM edits, notes, and more — is automatically logged with timestamps, user attribution, and contextual references. The audit trail is immutable: entries cannot be modified or deleted once created.

## Domain Concepts

### Audit Entries

Each audit entry records a single event with the following core fields:

- **`action`** — The type of event that occurred (see Action Types below).
- **`userId`** — The user who performed the action.
- **`timestamp`** — When the event occurred (ISO 8601).
- **Contextual references** — Optional fields like `serialId`, `certId`, `jobId`, `pathId`, `stepId`, `fromStepId`, `toStepId`, and `batchQuantity` that link the event to specific domain objects.
- **`metadata`** — An optional free-form JSON object for action-specific data (e.g., scrap reason, force-complete details, BOM change description).

### Action Types

The `AuditAction` type defines 14 distinct event types:

| Action                    | Description                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `cert_attached`           | A certificate was attached to a serial number at a process step                         |
| `serial_created`          | A batch of serial numbers was created                                                   |
| `serial_advanced`         | A serial number was advanced from one step to the next                                  |
| `serial_completed`        | A serial number completed its final step                                                |
| `note_created`            | A process step note or defect was recorded                                              |
| `serial_scrapped`         | A serial number was scrapped (metadata includes reason)                                 |
| `serial_force_completed`  | A serial was force-completed, bypassing remaining steps                                 |
| `step_override_created`   | A step override was created for a serial                                                |
| `step_override_reversed`  | A step override was reversed                                                            |
| `step_deferred`           | A step was deferred during advancement                                                  |
| `step_skipped`            | An optional step was skipped during advancement                                         |
| `deferred_step_completed` | A previously deferred step was completed                                                |
| `step_waived`             | A step was waived with approval (metadata includes reason and approver)                 |
| `bom_edited`              | A BOM was edited via the versioned edit endpoint (metadata includes change description) |

### Immutability

The audit trail is strictly append-only. There are no update or delete operations at any level — not in the API, not in the service layer, and not in the repository. This design ensures that the audit trail is a reliable, tamper-proof record of all production events.

### Automatic Recording

Audit entries are created automatically by the service layer. You do not need to call the Audit API to create entries — they are generated as side effects of operations like advancing serials, attaching certificates, scrapping parts, and editing BOMs. The Audit API is read-only.

## Common Use Cases

- **Part traceability**: Use `GET /api/audit/serial/:id` to see the complete history of a specific serial number — from creation through every step advancement, certificate attachment, and lifecycle event.
- **User activity review**: Filter the audit trail by `userId` to see all actions performed by a specific operator.
- **Compliance reporting**: Export the full audit trail or filter by action type to generate compliance reports for quality audits.
- **Investigating issues**: When a production problem is discovered, trace back through the audit trail to understand what happened, when, and who was involved.

## Endpoints

| Method | Path                                              | Description                                               |
| ------ | ------------------------------------------------- | --------------------------------------------------------- |
| `GET`  | [`/api/audit`](/api-docs/audit/list)              | List audit entries with optional pagination               |
| `GET`  | [`/api/audit/serial/:id`](/api-docs/audit/serial) | Get the complete audit trail for a specific serial number |

## Related APIs

- [Serials API](/api-docs/serials) — Serial number operations that generate audit entries
- [Certificates API](/api-docs/certs) — Certificate attachments that generate `cert_attached` entries
- [BOM API](/api-docs/bom) — Versioned BOM edits that generate `bom_edited` entries
- [Jobs API](/api-docs/jobs) — Jobs referenced in audit entry context
