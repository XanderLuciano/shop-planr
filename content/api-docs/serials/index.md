---
title: "Serials API"
description: "Serial number lifecycle — creation, advancement, scrap, force-complete, and overrides"
icon: "i-lucide-hash"
navigation:
  order: 3
---

# Serials API

The Serials API handles the full lifecycle of serial numbers. Serials are created in batches, advance through process steps, and can be scrapped, force-completed, or have step overrides applied. Certificate attachments and step status tracking are also managed here.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/serials` | List all serials |
| `GET` | `/api/serials/:id` | Get serial by ID |
| `POST` | `/api/serials` | Create serials (batch) |
| `POST` | `/api/serials/:id/advance` | Advance to next step |
| `POST` | `/api/serials/:id/advance-to` | Advance to specific step |
| `POST` | `/api/serials/:id/scrap` | Scrap a serial |
| `POST` | `/api/serials/:id/force-complete` | Force-complete a serial |
| `POST` | `/api/serials/:id/attach-cert` | Attach certificate |
| `GET` | `/api/serials/:id/cert-attachments` | List cert attachments |
| `GET` | `/api/serials/:id/step-statuses` | Get step statuses |
| `GET` | `/api/serials/:id/overrides` | List step overrides |
| `POST` | `/api/serials/:id/overrides` | Create step override |
