---
title: "Settings API"
description: "App configuration — Jira connection, field mappings, and page visibility toggles"
icon: "i-lucide-settings"
navigation:
  order: 9
---

# Settings API

The Settings API manages the singleton application configuration for Shop Planr. Settings are stored as a single `AppSettings` record in the database and control three major areas: Jira integration, field mappings, and page visibility.

## Concepts

### Singleton Pattern

There is exactly one `AppSettings` record in the system, identified by the fixed ID `"app_settings"`. The GET endpoint always returns this record. If no settings have been saved yet, a default configuration is returned based on environment variables and built-in defaults. The PUT endpoint performs an upsert — creating the record on first write and updating it on subsequent writes.

### Jira Connection Settings

The `jiraConnection` object controls how Shop Planr connects to Jira:

- **`baseUrl`** — The Atlassian instance URL (e.g. `https://mycompany.atlassian.net`)
- **`projectKey`** — The Jira project key to query (defaults to `"PI"`)
- **`username`** / **`apiToken`** — Basic auth credentials for the Jira REST API
- **`enabled`** — Master toggle. When `false`, all Jira API endpoints return 400.
- **`pushEnabled`** — Write toggle. When `false`, push and comment endpoints return 400.

Default values for `baseUrl`, `projectKey`, `username`, and `apiToken` are seeded from the Nuxt runtime config environment variables (`JIRA_BASE_URL`, `JIRA_PROJECT_KEY`, `JIRA_USERNAME`, `JIRA_API_TOKEN`). Both toggles default to `false`.

### Field Mappings

The `jiraFieldMappings` array defines how Jira custom fields map to Shop Planr fields. Five default mappings are provided for the PI project:

| Shop ERP Field | Default Jira Field ID | Label |
|---------------|----------------------|-------|
| `partNumber` | `customfield_10908` | Part Number / Rev |
| `goalQuantity` | `customfield_10900` | Quantity |
| `epicLink` | `customfield_10014` | Epic Link |
| `priority` | `priority` | Priority |
| `labels` | `labels` | Labels |

These mappings are used by the Jira service when normalizing ticket data. Custom mappings can be added or modified to support different Jira project configurations.

### Page Toggles

The `pageToggles` object controls which pages appear in the sidebar navigation. Each key corresponds to a page route, and the boolean value determines visibility. A global route middleware blocks navigation to disabled pages and redirects to the homepage.

All nine toggles default to `true`:

`jobs`, `serials`, `parts`, `queue`, `templates`, `bom`, `certs`, `jira`, `audit`

Certain routes (like `/parts/step/*`) are always accessible regardless of toggle state to prevent breaking deep links.

## Common Use Cases

- **Initial setup** — Configure Jira connection credentials and enable integration after deployment.
- **Toggle Jira push** — Enable or disable the ability to write data back to Jira without disconnecting entirely.
- **Customize field mappings** — Adapt to a different Jira project's custom field IDs.
- **Simplify navigation** — Hide unused pages (e.g. disable BOM or Certs for shops that don't use them).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | [`/api/settings`](/api-docs/settings/get) | Retrieve the current application settings |
| `PUT` | [`/api/settings`](/api-docs/settings/update) | Update application settings (partial payload) |

## Related

- [Jira API](/api-docs/jira) — Endpoints that depend on Jira connection settings
- [Users API](/api-docs/users) — User profiles referenced in step assignments
