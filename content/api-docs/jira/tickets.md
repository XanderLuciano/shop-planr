---
title: "List Jira Tickets"
description: "Retrieve open Jira tickets from the connected project"
method: "GET"
endpoint: "/api/jira/tickets"
service: "jiraService"
category: "Jira"
responseType: "FetchTicketsResult"
errorCodes: [400, 502]
navigation:
  order: 1
---

# List Jira Tickets

::endpoint-card{method="GET" path="/api/jira/tickets"}

Retrieves all open (unresolved) Jira tickets from the configured Jira project. The endpoint executes a JQL query of `project = {projectKey} AND resolution is EMPTY` against the Jira REST API v2, requesting up to 200 results. Each raw Jira issue is normalized into a consistent `JiraTicket` shape using the field mappings configured in [App Settings](/api-docs/settings).

Results are cached in memory. If the Jira API is unreachable or returns an error, the endpoint returns the previously cached ticket list along with an error message and a `fromCache: true` flag, rather than failing with a 502. This graceful degradation ensures the UI remains functional during transient Jira outages.

The Jira connection must be enabled in settings. If `jiraConnection.enabled` is `false`, the endpoint returns a `400` error immediately without attempting to contact Jira.

## Request

No request body or query parameters. The project key and authentication credentials are read from the app settings.

## Response

### 200 OK

Returns a `FetchTicketsResult` object containing the ticket array, an optional error message, and a cache indicator.

| Field | Type | Description |
|-------|------|-------------|
| `tickets` | `JiraTicket[]` | Array of normalized Jira tickets (may be empty) |
| `error` | `string \| null` | Error message if the Jira API call failed, `null` on success |
| `fromCache` | `boolean` | `true` if the tickets were served from cache due to a Jira API failure |

#### JiraTicket Fields

| Field | Type | Description |
|-------|------|-------------|
| `key` | `string` | Jira issue key (e.g. `"PI-42"`) |
| `summary` | `string` | Issue summary / title |
| `status` | `string` | Current Jira status name (e.g. `"In Progress"`, `"To Do"`) |
| `priority` | `string` | Priority name (e.g. `"High"`, `"Medium"`) |
| `assignee` | `string` | Display name of the assignee, or empty string if unassigned |
| `reporter` | `string` | Display name of the reporter |
| `labels` | `string[]` | Array of Jira labels |
| `partNumber` | `string \| null` | Part number extracted from the configured custom field or parsed from the summary |
| `goalQuantity` | `number \| null` | Quantity from the configured custom field, or `null` if not set |
| `epicLink` | `string \| null` | Epic link key from the configured custom field |
| `createdAt` | `string` | ISO 8601 creation timestamp from Jira |
| `updatedAt` | `string` | ISO 8601 last-updated timestamp from Jira |
| `rawFields` | `object` | The raw Jira `fields` object for advanced use cases |

### 400 Bad Request

| Condition | Message |
|-----------|---------|
| Jira integration is disabled in settings | `"Jira integration is not enabled"` |

### 502 Bad Gateway

Not returned directly — Jira API failures are handled gracefully by returning cached data with an `error` field. A 502 would only occur if an unexpected non-Jira error is thrown.

## Examples

### Request

```bash
curl http://localhost:3000/api/jira/tickets
```

### Response — Successful fetch

```json
{
  "tickets": [
    {
      "key": "PI-42",
      "summary": "Build 50 aluminum housings",
      "status": "In Progress",
      "priority": "High",
      "assignee": "Jane Smith",
      "reporter": "John Doe",
      "labels": ["Q1-2024", "rush"],
      "partNumber": "ALU-HOUSING-7075",
      "goalQuantity": 50,
      "epicLink": "PI-10",
      "createdAt": "2024-01-10T08:00:00.000Z",
      "updatedAt": "2024-01-14T16:30:00.000Z",
      "rawFields": {}
    },
    {
      "key": "PI-43",
      "summary": "Machine 200 steel brackets",
      "status": "To Do",
      "priority": "Medium",
      "assignee": "",
      "reporter": "John Doe",
      "labels": [],
      "partNumber": "STL-BRACKET-304",
      "goalQuantity": 200,
      "epicLink": null,
      "createdAt": "2024-01-12T10:00:00.000Z",
      "updatedAt": "2024-01-12T10:00:00.000Z",
      "rawFields": {}
    }
  ],
  "error": null,
  "fromCache": false
}
```

### Response — Jira unreachable (cached fallback)

```json
{
  "tickets": [
    {
      "key": "PI-42",
      "summary": "Build 50 aluminum housings",
      "status": "In Progress",
      "priority": "High",
      "assignee": "Jane Smith",
      "reporter": "John Doe",
      "labels": ["Q1-2024", "rush"],
      "partNumber": "ALU-HOUSING-7075",
      "goalQuantity": 50,
      "epicLink": "PI-10",
      "createdAt": "2024-01-10T08:00:00.000Z",
      "updatedAt": "2024-01-14T16:30:00.000Z",
      "rawFields": {}
    }
  ],
  "error": "Jira API error: 503 Service Unavailable",
  "fromCache": true
}
```

## Notes

- The cache is **in-memory only** and resets when the server restarts. The first call after a restart will always hit the Jira API.
- Field mappings determine which custom fields are requested from Jira. If mappings are misconfigured, fields like `partNumber` or `goalQuantity` may return `null`.
- The `rawFields` object contains the unprocessed Jira fields, useful for debugging field mapping issues.
- The endpoint requests a maximum of 200 tickets. Projects with more than 200 open tickets will only return the first page.
- A 10-second timeout is applied to the Jira API call. If Jira doesn't respond within 10 seconds, the request is aborted and cached data is returned.

## Related Endpoints

- [Get Jira Ticket](/api-docs/jira/ticket-detail) — Fetch a single ticket by key with full detail
- [Link Jira Ticket](/api-docs/jira/link) — Link a ticket to a new production job
- [Get Settings](/api-docs/settings/get) — Check Jira connection status and field mappings

::
