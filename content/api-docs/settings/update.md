---
title: "Update Settings"
description: "Update application settings with a partial payload"
method: "PUT"
endpoint: "/api/settings"
service: "settingsService"
category: "Settings"
requestBody: "Partial<AppSettings>"
responseType: "AppSettings"
errorCodes: [400]
navigation:
  order: 2
---

# Update Settings

::endpoint-card{method="PUT" path="/api/settings"}

Updates the application settings. Accepts a partial payload — only the fields provided will be updated. Commonly used to configure Jira connection details, field mappings, and page visibility toggles.

## Request Body

Any subset of `AppSettings` fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jiraConnection` | `JiraConnectionSettings` | No | Jira connection configuration |
| `jiraFieldMappings` | `JiraFieldMapping[]` | No | Custom field mappings for Jira sync |
| `pageToggles` | `PageToggles` | No | Visibility toggles for app pages |

## Example Request

```json
{
  "jiraConnection": {
    "baseUrl": "https://mycompany.atlassian.net",
    "projectKey": "PI",
    "username": "admin@company.com",
    "apiToken": "new-token",
    "enabled": true,
    "pushEnabled": false
  }
}
```

## Response

Returns the full updated `AppSettings` object:

```json
{
  "id": "settings_001",
  "jiraConnection": {
    "baseUrl": "https://mycompany.atlassian.net",
    "projectKey": "PI",
    "username": "admin@company.com",
    "apiToken": "new-token",
    "enabled": true,
    "pushEnabled": false
  },
  "jiraFieldMappings": [],
  "pageToggles": {
    "jobs": true,
    "serials": true,
    "parts": true,
    "queue": true,
    "templates": true,
    "bom": true,
    "certs": true,
    "jira": true,
    "audit": true
  },
  "updatedAt": "2024-01-16T09:00:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Invalid settings payload |

::
