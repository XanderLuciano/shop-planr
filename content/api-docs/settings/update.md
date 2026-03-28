---
title: "Update Settings"
description: "Update application settings with a partial payload"
method: "PUT"
endpoint: "/api/settings"
service: "settingsService"
category: "Settings"
requestBody: "Partial<AppSettings>"
responseType: "AppSettings"
errorCodes: [400, 500]
navigation:
  order: 2
---

# Update Settings

::endpoint-card{method="PUT" path="/api/settings"}

Updates the singleton application settings with a partial payload. Only the fields provided in the request body are modified — omitted fields retain their current values. This endpoint performs an upsert: if no settings record exists yet, one is created from defaults and then the provided fields are applied.

The three top-level sections (`jiraConnection`, `jiraFieldMappings`, `pageToggles`) are independently mergeable:

- **`jiraConnection`** — Shallow-merged with the existing connection settings. You can update individual fields (e.g. just `enabled: true`) without resending the entire object.
- **`jiraFieldMappings`** — Replaced entirely when provided. If you send this field, the entire array is overwritten. To add a mapping, include all existing mappings plus the new one.
- **`pageToggles`** — Shallow-merged with the existing toggles using `mergePageToggles()`. You can toggle individual pages without affecting others.

## Request

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jiraConnection` | `Partial<JiraConnectionSettings>` | No | Partial Jira connection settings to merge. Any subset of `baseUrl`, `projectKey`, `username`, `apiToken`, `enabled`, `pushEnabled`. |
| `jiraFieldMappings` | `JiraFieldMapping[]` | No | Complete replacement array of field mappings. Each mapping must include `id`, `jiraFieldId`, `label`, `shopErpField`, and `isDefault`. |
| `pageToggles` | `Partial<PageToggles>` | No | Partial page toggle overrides. Any subset of the 9 toggle keys (`jobs`, `serials`, `parts`, `queue`, `templates`, `bom`, `certs`, `jira`, `audit`). |

#### JiraFieldMapping Shape

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique mapping identifier |
| `jiraFieldId` | `string` | Yes | Jira field ID (e.g. `"customfield_10908"`) |
| `label` | `string` | Yes | Human-readable label |
| `shopErpField` | `string` | Yes | Shop Planr field name this maps to |
| `isDefault` | `boolean` | Yes | Whether this is a built-in mapping |

## Response

### 200 OK

Returns the complete updated `AppSettings` object (same shape as [Get Settings](/api-docs/settings/get)).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Always `"app_settings"` |
| `jiraConnection` | `JiraConnectionSettings` | Full Jira connection settings after merge |
| `jiraFieldMappings` | `JiraFieldMapping[]` | Full field mappings array after update |
| `pageToggles` | `PageToggles` | Full page toggles after merge |
| `updatedAt` | `string` | ISO 8601 timestamp of this update |

### 400 Bad Request

| Condition | Message |
|-----------|---------|
| Request body fails validation | Validation error message |

### 500 Internal Server Error

| Condition | Message |
|-----------|---------|
| Database write failure | `"Internal Server Error"` |

## Examples

### Request — Enable Jira integration

```bash
curl -X PUT http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{
    "jiraConnection": {
      "baseUrl": "https://mycompany.atlassian.net",
      "projectKey": "PI",
      "username": "admin@company.com",
      "apiToken": "ATATT3xFfGF0...",
      "enabled": true,
      "pushEnabled": false
    }
  }'
```

### Response — Jira enabled

```json
{
  "id": "app_settings",
  "jiraConnection": {
    "baseUrl": "https://mycompany.atlassian.net",
    "projectKey": "PI",
    "username": "admin@company.com",
    "apiToken": "ATATT3xFfGF0...",
    "enabled": true,
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
  "updatedAt": "2024-01-16T09:00:00.000Z"
}
```

### Request — Toggle page visibility

```bash
curl -X PUT http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{
    "pageToggles": {
      "bom": false,
      "certs": false
    }
  }'
```

### Response — Pages toggled

```json
{
  "id": "app_settings",
  "jiraConnection": {
    "baseUrl": "https://mycompany.atlassian.net",
    "projectKey": "PI",
    "username": "admin@company.com",
    "apiToken": "ATATT3xFfGF0...",
    "enabled": true,
    "pushEnabled": false
  },
  "jiraFieldMappings": [
    { "id": "fm_1", "jiraFieldId": "customfield_10908", "label": "Part Number / Rev", "shopErpField": "partNumber", "isDefault": true }
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
  "updatedAt": "2024-01-16T10:00:00.000Z"
}
```

### Request — Add a custom field mapping

```bash
curl -X PUT http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{
    "jiraFieldMappings": [
      { "id": "fm_1", "jiraFieldId": "customfield_10908", "label": "Part Number / Rev", "shopErpField": "partNumber", "isDefault": true },
      { "id": "fm_2", "jiraFieldId": "customfield_10900", "label": "Quantity", "shopErpField": "goalQuantity", "isDefault": true },
      { "id": "fm_3", "jiraFieldId": "customfield_10014", "label": "Epic Link", "shopErpField": "epicLink", "isDefault": true },
      { "id": "fm_4", "jiraFieldId": "priority", "label": "Priority", "shopErpField": "priority", "isDefault": true },
      { "id": "fm_5", "jiraFieldId": "labels", "label": "Labels", "shopErpField": "labels", "isDefault": true },
      { "id": "fm_6", "jiraFieldId": "customfield_11000", "label": "Material Spec", "shopErpField": "materialSpec", "isDefault": false }
    ]
  }'
```

## Notes

- **`jiraFieldMappings` is a full replacement**, not a merge. Always include all desired mappings when updating this field. Omitting existing mappings will remove them.
- **`jiraConnection` and `pageToggles` are shallow-merged.** You can send just the fields you want to change.
- The `updatedAt` timestamp is set server-side on every update. It cannot be specified in the request.
- The `id` field is always `"app_settings"` and cannot be changed.
- Disabling a page toggle immediately hides it from the sidebar for all users. The route middleware will redirect any direct navigation attempts to the homepage.
- Certain routes (`/parts/step/*`) are defined in `ALWAYS_ENABLED_ROUTES` and remain accessible regardless of the `parts` toggle state.
- Changing Jira connection settings does not test the connection. Use the [List Jira Tickets](/api-docs/jira/tickets) endpoint to verify connectivity after updating credentials.

## Related Endpoints

- [Get Settings](/api-docs/settings/get) — Retrieve the current settings
- [List Jira Tickets](/api-docs/jira/tickets) — Test Jira connectivity after updating connection settings

::
