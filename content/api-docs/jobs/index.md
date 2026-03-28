---
title: "Jobs API"
description: "Production order management — create, read, update jobs and track progress"
icon: "i-lucide-briefcase"
navigation:
  order: 1
---

# Jobs API

The Jobs API manages production orders in Shop Planr. A job represents a production order that is routed through one or more paths with process steps, tracking goal quantities and optional Jira ticket linking.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/jobs` | List all jobs |
| `GET` | `/api/jobs/:id` | Get job by ID |
| `POST` | `/api/jobs` | Create a new job |
| `PUT` | `/api/jobs/:id` | Update an existing job |
