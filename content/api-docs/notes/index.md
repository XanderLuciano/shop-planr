---
title: "Notes API"
description: "Process step notes and defect tracking on serials"
icon: "i-lucide-sticky-note"
navigation:
  order: 11
---

# Notes API

The Notes API manages notes and defect records attached to serial numbers at specific process steps. Notes can be queried by serial or by step for contextual display in the operator and serial detail views.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/notes` | Create a note |
| `GET` | `/api/notes/serial/:id` | Get notes for a serial |
| `GET` | `/api/notes/step/:id` | Get notes for a step |
