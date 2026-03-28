---
title: "Settings API"
description: "App configuration — Jira connection, field mappings, and page visibility toggles"
icon: "i-lucide-settings"
navigation:
  order: 9
---

# Settings API

The Settings API manages application-wide configuration. This includes Jira connection settings, field mappings for Jira integration, and page visibility toggles that control which pages appear in the sidebar navigation.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/settings` | Get current settings |
| `PUT` | `/api/settings` | Update settings |
