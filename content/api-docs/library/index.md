---
title: "Library API"
description: "Reusable process name and location libraries for template building"
icon: "i-lucide-library"
navigation:
  order: 14
---

# Library API

The Library API manages reusable process names and locations used when building route templates and paths. Library entries provide consistent naming across the shop floor and are available as dropdowns in the template editor.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/library/processes` | List process library entries |
| `POST` | `/api/library/processes` | Create process entry |
| `DELETE` | `/api/library/processes/:id` | Delete process entry |
| `GET` | `/api/library/locations` | List location library entries |
| `POST` | `/api/library/locations` | Create location entry |
| `DELETE` | `/api/library/locations/:id` | Delete location entry |
