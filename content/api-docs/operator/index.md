---
title: "Operator API"
description: "Workstation views — step data, work queues, and operator assignments"
icon: "i-lucide-hard-hat"
navigation:
  order: 12
---

# Operator API

The Operator API provides aggregated views for shop floor workstations. It combines data from jobs, paths, and serials to power the Parts View, Step View, and Operator Work Queue pages. These endpoints are read-only and optimized for display.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/operator/step/:stepId` | Get step view data |
| `GET` | `/api/operator/work-queue` | Get work queue overview |
| `GET` | `/api/operator/queue/_all` | Get all queue items |
| `GET` | `/api/operator/queue/:userId` | Get queue for a user |
| `GET` | `/api/operator/:stepName` | Get data by step name |
