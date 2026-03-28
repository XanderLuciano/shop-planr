---
title: "Certificates API"
description: "Certificate management, batch attachment, and traceability"
icon: "i-lucide-shield-check"
navigation:
  order: 4
---

# Certificates API

The Certificates API manages quality certificates and their attachment to serial numbers at specific process steps. Supports batch attachment for efficiency and provides traceability through attachment queries.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/certs` | List all certificates |
| `GET` | `/api/certs/:id` | Get certificate by ID |
| `POST` | `/api/certs` | Create a certificate |
| `POST` | `/api/certs/batch-attach` | Batch attach to serials |
| `GET` | `/api/certs/:id/attachments` | List attachments for cert |
