---
title: "Get Settings"
description: "Retrieve the current application settings"
method: "GET"
endpoint: "/api/settings"
service: "settingsService"
category: "Settings"
responseType: "AppSettings"
errorCodes: [500]
navigation:
  order: 1
---

# Get Settings

::endpoint-card{method="GET" path="/api/settings"}

Retrieves the current application settings. Returns the singleton `AppSettings` record containing Jira connection configuration, field mappings, and page visibility toggles.

If no settings have been explicitly saved yet, the endpoint returns a default configuration. Default Jira connection values are populated from environment variables (`JIRA_BASE_URL`, `JIRA_PROJECT_KEY`, `JIRA_USERNAME`, `JIRA_API_TOKEN`), both toggles default to `false`, five default field mappings are included for the PI project, and all nine page toggles default to `true`.

This endpoint is called by the `app/plugins/settings.ts` plugin on every app initialization to ensure the sidebar navigation and route middleware have the correct toggle state immediately, without flash or stale fallback.

## Request

No request body or query parameters.

## Response

### 200 OK

Returns the complete `AppSettings` object.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Always `"app_settings"` |
| `jiraConnection` | `JiraConnectionSettings` | Jira connection configuration |
| `jiraFieldMappings` | `JiraFieldMapping[]` | Custom field mappings for Jira ticket normalization |
| `pageToggles` | `PageToggles` | Visibility toggles for sidebar pages |
| `updatedAt` | `string` | ISO 8601 timestamp of the last settings update |

#### JiraConnectionSettings

| Field | Type | Description |
|-------|------|-------------|
| `baseUrl` | `string` | Atlassian instance URL (e.g. `"https://mycompany.atlassian.net"`) |
| `projectKey` | `string` | Jira project key (e.g. `"PI"`) |
| `username` | `string` | Jira username / email for Basic auth |
| `apiToken` | `string` | Jira API token for Basic auth |
| `enabled` | `boolean` | Master toggle — enables all Jira endpoints |
| `pushEnabled` | `boolean` | Write toggle — enables push and comment endpoints |

#### JiraFieldMapping

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique mapping identifier (e.g. `"fm_1"`) |
| `jiraFieldId` | `string` | Jira field ID (e.g. `"customfield_10908"`, `"priority"`) |
| `label` | `string` | Human-readable label for the mapping |
| `shopErpField` | `string` | The Shop Planr field this maps to (e.g. `"partNumber"`, `"goalQuantity"`) |
| `isDefault` | `boolean` | `true` for built-in mappings, `false` for user-created ones |

#### PageToggles

| Field | Type | Description |
|-------|------|-------------|
| `jobs` | `boolean` | Show/hide the Jobs page |
| `serials` | `boolean` | Show/hide the Serials browser page |
| `parts` | `boolean` | Show/hide the Parts View page |
| `queue` | `boolean` | Show/hide the Work Queue page |
| `templates` | `boolean` | Show/hide the Templates page |
| `bom` | `boolean` | Show/hide the BOM page |
| `certs` | `boolean` | Show/hide the Certificates page |
| `jira` | `boolean` | Show/hide the Jira dashboard page |
| `audit` | `boolean` | Show/hide the Audit Trail page |

### 500 Internal Server Error

| Condition | Message |
|-----------|---------|
| Database read failure | `"Internal Server Error"` |

## Examples

### Request

```bash
curl http://localhost:3000/api/settings
```

### Response — Default settings (never saved)

```json
{
  "id": "app_settings",
  "jiraConnection": {
    "baseUrl": "",
    "projectKey": "PI",
    "username": "",
    "apiToken": "",
    "enabled": false,
    "pushEnabled": false
  },
  "jiraFieldMappings": [
    { "id": "fm_1", "jiraFieldId": "customfield_10908", "label": "Part Number / Rev", "shopErpField": "partNumber", "isDefault": true },
    { "id": "fm_2", "jiraFieldId": "customfield_10900", "label": "Quantity", "shopErpField": "goalQuantity", "isDefault": true },
    { "id": "fm_3", "jiraFieldId": "customfield_10014", "label": "Epic Link", "shopErpField": "epicLink", "isDefault": true },
    { "id": "fm_4", "jiraFieldId": "priority", "label": "Priority", "shopErpField": "priority", "isDefault": true },
    { "id": "fm_5", "jiraFieldId": "labels", "label": "Labels", "shopErpField": "labels", "isDefault": true }
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
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### Response — Configured settings

```json
{
  "id": "app_settings",
  "jiraConnection": {
    "baseUrl": "https://mycompany.atlassian.net",
    "projectKey": "PI",
    "username": "admin@company.com",
    "apiToken": "ATATT3xFfGF0...",
    "enabled": true,
    "pushEnabled": true
  },
  "jiraFieldMappings": [
    { "id": "fm_1", "jiraFieldId": "customfield_10908", "label": "Part Number / Rev", "shopErpField": "partNumber", "isDefault": true },
    { "id": "fm_2", "jiraFieldId": "customfield_10900", "label": "Quantity", "shopErpField": "goalQuantity", "isDefault": true },
    { "id": "fm_3", "jiraFieldId": "customfield_10014", "label": "Epic Link", "shopErpField": "epicLink", "isDefault": true },
    { "id": "fm_4", "jiraFieldId": "priority", "label": "Priority", "shopErpField": "priority", "isDefault": true },
    { "id": "fm_5", "jiraFieldId": "labels", "label": "Labels", "shopErpField": "labels", "isDefault": true },
    { "id": "fm_6", "jiraFieldId": "customfield_11000", "label": "Material Spec", "shopErpField": "materialSpec", "isDefault": false }
  ],
  "pageToggles": {
    "jobs": true,
    "serials": true,
    "parts": true,
    "queue": true,
    "templates": true,
    "bom": false,
    "certs": false,
    "jira": true,
    "audit": true
  },
  "updatedAt": "2024-01-16T14:00:00.000Z"
}
```

## Notes

- The API token is returned in plaintext. In a production environment, consider masking this value in the frontend.
- Default settings are computed on-the-fly from environment variables and built-in constants. They are not persisted until the first `PUT` call.
- The `updatedAt` timestamp on default settings reflects the current server time, not a stored value.
- The settings plugin (`app/plugins/settings.ts`) calls this endpoint once on app initialization. Subsequent reads use the cached composable state.

## Related Endpoints

- [Update Settings](/api-docs/settings/update) — Modify settings with a partial payload
- [List Jira Tickets](/api-docs/jira/tickets) — Depends on `jiraConnection.enabled`
- [Push to Jira](/api-docs/jira/push) — Depends on both `enabled` and `pushEnabled`

::
