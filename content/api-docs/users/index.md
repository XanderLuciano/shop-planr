---
title: "Users API"
description: "Kiosk-mode user profiles — create and manage shop floor operators"
icon: "i-lucide-users"
navigation:
  order: 10
---

# Users API

The Users API manages simple kiosk-mode user profiles. Users represent shop floor operators who can be assigned to process steps and appear in the work queue. No passwords — identity is for attribution and assignment only.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/users` | List all users |
| `POST` | `/api/users` | Create a user |
| `PUT` | `/api/users/:id` | Update a user |
