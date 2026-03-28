---
title: "BOM API"
description: "Bill of materials roll-ups, editing, and version history"
icon: "i-lucide-layers"
navigation:
  order: 6
---

# BOM API

The BOM (Bill of Materials) API manages material roll-ups for production. Each BOM contains entries for part types linked to contributing jobs. Edits create immutable version snapshots for full traceability.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/bom` | List all BOMs |
| `GET` | `/api/bom/:id` | Get BOM by ID |
| `POST` | `/api/bom` | Create a BOM |
| `PUT` | `/api/bom/:id` | Update a BOM |
| `POST` | `/api/bom/:id/edit` | Edit BOM (creates version) |
| `GET` | `/api/bom/:id/versions` | Get version history |
