---
title: "Get Settings"
description: "Retrieve the current application settings"
method: "GET"
endpoint: "/api/settings"
service: "settingsService"
category: "Settings"
responseType: "AppSettings"
errorCodes: [400]
navigation:
  order: 1
---

# Get Settings

::endpoint-card{method="GET" path="/api/settings"}

Retrieves the current application settings including Jira connection configuration, field mappings, and page visibility toggles.

## Response

Returns the `AppSettings` object:

```json
{
  "id": "settings_001",
  "jiraConnection": {
    "baseUrl": "https://mycompany.atlassian.net",
    "projectKey": "PI",
    "username": "admin@company.com",
    "apiToken": "****",
    "enabled": true,
    "pushEnabled": true
  },
  "jiraFieldMappings": [
    {
      "id": "map_001",
      "jiraFieldId": "customfield_10001",
      "label": "Part Number",
      "shopErpField": "partNumber",
      "isDefault": true
    }
  ],
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
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Validation error |

::
