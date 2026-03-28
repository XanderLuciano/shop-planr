---
title: "Jira API"
description: "Optional Jira integration — ticket lookup, linking, push, and comments"
icon: "i-lucide-ticket"
navigation:
  order: 8
---

# Jira API

The Jira API provides optional integration with Jira for ticket linking and synchronization. When enabled, jobs can be linked to Jira tickets, and data can be pushed or pulled between systems. Jira integration is off by default and controlled via Settings.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/jira/tickets` | List Jira tickets |
| `GET` | `/api/jira/tickets/:key` | Get ticket by key |
| `POST` | `/api/jira/link` | Link job to Jira ticket |
| `POST` | `/api/jira/push` | Push data to Jira |
| `POST` | `/api/jira/comment` | Add comment to Jira ticket |
