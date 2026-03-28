---
title: "Steps API"
description: "Process step assignment and configuration — optional flags, dependency types"
icon: "i-lucide-list-checks"
navigation:
  order: 13
---

# Steps API

The Steps API provides endpoints for configuring individual process steps within a path. Steps can be assigned to operators and configured with optional flags and dependency types (physical, preferred, completion_gate).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `PATCH` | `/api/steps/:id/assign` | Assign operator to step |
| `PATCH` | `/api/steps/:id/config` | Update step configuration |
