---
title: "Paths API"
description: "Route instances with ordered process steps and advancement modes"
icon: "i-lucide-route"
navigation:
  order: 2
---

# Paths API

The Paths API manages route instances attached to jobs. Each path contains an ordered sequence of process steps that serial numbers advance through. Paths support configurable advancement modes (strict, flexible, per-step).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/paths/:id` | Get path by ID |
| `POST` | `/api/paths` | Create a new path |
| `PUT` | `/api/paths/:id` | Update a path |
| `DELETE` | `/api/paths/:id` | Delete a path |
| `PATCH` | `/api/paths/:id/advancement-mode` | Set advancement mode |
