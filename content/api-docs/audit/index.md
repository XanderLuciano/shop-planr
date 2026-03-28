---
title: "Audit API"
description: "Immutable audit trail — query logs by action, user, serial, or date range"
icon: "i-lucide-scroll-text"
navigation:
  order: 7
---

# Audit API

The Audit API provides read access to the append-only audit trail. Every significant operation (certificate attachment, serial advancement, lifecycle events, notes) is logged with timestamps, user attribution, and contextual data. Supports filtering by action type, user, serial, job, and date range.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/audit` | List audit entries (with filters) |
| `GET` | `/api/audit/serial/:id` | Get audit trail for a serial |
