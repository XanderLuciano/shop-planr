---
title: "Certificates API"
description: "Certificate management, batch attachment, and traceability for material and process certifications"
icon: "i-lucide-shield-check"
navigation:
  order: 4
---

# Certificates API

The Certificates API manages quality certifications and their attachment to serial numbers at specific process steps. Certificates are a core traceability mechanism in Shop Planr — they provide auditable proof that a material or process certification was verified and recorded against a specific part at a specific point in the manufacturing route.

## Domain Concepts

### Certificate Types

Every certificate has a `type` field that classifies it as one of two categories:

- **`material`** — Represents a material certification, such as a mill test report for steel alloy, a certificate of conformance for raw stock, or a supplier quality document. Material certs are typically attached when raw materials enter the production process.
- **`process`** — Represents a process certification, such as a heat treatment record, a calibration certificate for measurement equipment, or an operator qualification. Process certs are typically attached at the step where the process was performed.

### Certificate Attachments

Certificates are not directly linked to serial numbers. Instead, a **CertAttachment** record bridges the two, capturing which serial received which certificate, at which process step, when, and by whom. This design allows the same certificate to be attached to many serials (e.g., a single mill cert covering an entire batch of raw material) and supports full traceability through the audit trail.

Attachments are **idempotent** — attaching the same certificate to the same serial at the same step a second time will not create a duplicate record. The `cert_attachments` table enforces a UNIQUE constraint on `(serialId, certId, stepId)`.

### Metadata

Certificates support an optional `metadata` field — a free-form JSON object where you can store domain-specific attributes like supplier name, grade, lot number, expiration date, or any other key-value data relevant to the certification. This field is stored as-is and returned verbatim in all responses.

## Common Use Cases

- **Recording incoming material certs**: Create a `material` certificate with supplier metadata, then batch-attach it to all serial numbers in the receiving batch.
- **Attaching process certs during production**: As an operator completes a process step (e.g., heat treatment), attach the relevant `process` certificate to the serial at that step.
- **Auditing certificate coverage**: Use `GET /api/certs/:id/attachments` to see every serial that has a given certificate, or query the [Audit API](/api-docs/audit) to trace certificate attachment events over time.
- **Batch operations**: Use `POST /api/certs/batch-attach` to attach a single certificate to dozens or hundreds of serials in one call, rather than making individual attachment requests.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | [`/api/certs`](/api-docs/certs/list) | List all certificates |
| `GET` | [`/api/certs/:id`](/api-docs/certs/get) | Get a single certificate by ID |
| `POST` | [`/api/certs`](/api-docs/certs/create) | Create a new certificate |
| `POST` | [`/api/certs/batch-attach`](/api-docs/certs/batch-attach) | Batch attach a certificate to multiple serials |
| `GET` | [`/api/certs/:id/attachments`](/api-docs/certs/attachments) | List all attachments for a certificate |

## Related APIs

- [Serials API](/api-docs/serials) — Manage serial numbers that certificates are attached to
- [Audit API](/api-docs/audit) — Query `cert_attached` audit entries for traceability
- [Paths API](/api-docs/paths) — Process steps where certificates are recorded
