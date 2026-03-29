---
title: "Templates API"
description: "Reusable route templates — create, edit, apply to jobs"
icon: "i-lucide-copy"
navigation:
  order: 5
---

# Templates API

The Templates API manages reusable route templates. Templates define a sequence of process steps that can be applied to jobs to create paths. When applied, templates are deep-cloned to preserve template independence.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/templates` | List all templates |
| `GET` | `/api/templates/:id` | Get template by ID |
| `POST` | `/api/templates` | Create a template |
| `PUT` | `/api/templates/:id` | Update a template |
| `DELETE` | `/api/templates/:id` | Delete a template |
| `POST` | `/api/templates/:id/apply` | Apply template to a job |
