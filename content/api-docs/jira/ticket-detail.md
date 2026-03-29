---
title: 'Get Jira Ticket'
description: 'Retrieve a single Jira ticket by its issue key'
method: 'GET'
endpoint: '/api/jira/tickets/:key'
service: 'jiraService'
category: 'Jira'
responseType: 'JiraTicket'
errorCodes: [400, 404, 502]
navigation:
  order: 2
---

# Get Jira Ticket

::endpoint-card{method="GET" path="/api/jira/tickets/:key"}

Retrieves the full detail of a single Jira ticket by its issue key. Unlike the list endpoint, this always makes a live call to the Jira API (no caching) and returns the complete normalized ticket. This is typically used when a user selects a ticket from the list and needs to see full details before linking it to a job.

The raw Jira issue is normalized using the same field mapping logic as the list endpoint — custom fields for part number, quantity, and epic link are resolved from the configured mappings in [App Settings](/api-docs/settings).

## Request

### Path Parameters

| Parameter | Type     | Required | Description                                                                                             |
| --------- | -------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `key`     | `string` | Yes      | The Jira issue key (e.g. `"PI-42"`, `"PROJ-123"`). Case-sensitive and must match the exact key in Jira. |

## Response

### 200 OK

Returns a single `JiraTicket` object with all normalized fields.

| Field          | Type             | Description                                                         |
| -------------- | ---------------- | ------------------------------------------------------------------- |
| `key`          | `string`         | Jira issue key (e.g. `"PI-42"`)                                     |
| `summary`      | `string`         | Issue summary / title                                               |
| `status`       | `string`         | Current Jira status name (e.g. `"In Progress"`)                     |
| `priority`     | `string`         | Priority name (e.g. `"High"`, `"Medium"`)                           |
| `assignee`     | `string`         | Display name of the assignee, or empty string if unassigned         |
| `reporter`     | `string`         | Display name of the reporter                                        |
| `labels`       | `string[]`       | Array of Jira labels                                                |
| `partNumber`   | `string \| null` | Part number from the configured custom field or parsed from summary |
| `goalQuantity` | `number \| null` | Quantity from the configured custom field                           |
| `epicLink`     | `string \| null` | Epic link key from the configured custom field                      |
| `createdAt`    | `string`         | ISO 8601 creation timestamp from Jira                               |
| `updatedAt`    | `string`         | ISO 8601 last-updated timestamp from Jira                           |
| `rawFields`    | `object`         | The raw Jira `fields` object                                        |

### 400 Bad Request

| Condition                                | Message                             |
| ---------------------------------------- | ----------------------------------- |
| Jira integration is disabled in settings | `"Jira integration is not enabled"` |

### 404 Not Found

| Condition                         | Message                                                      |
| --------------------------------- | ------------------------------------------------------------ |
| Ticket key does not exist in Jira | Jira API returns a 404, which is re-thrown as a server error |

### 502 Bad Gateway

| Condition                                        | Message                                   |
| ------------------------------------------------ | ----------------------------------------- |
| Jira API unreachable or returned a non-OK status | `"Jira API error: {status} {statusText}"` |
| Request timed out (10-second limit)              | Abort error from the fetch signal         |

## Examples

### Request

```bash
curl http://localhost:3000/api/jira/tickets/PI-42
```

### Response

```json
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
  "rawFields": {
    "summary": "Build 50 aluminum housings",
    "status": { "name": "In Progress" },
    "priority": { "name": "High" },
    "customfield_10908": "ALU-HOUSING-7075",
    "customfield_10900": 50,
    "customfield_10014": "PI-10"
  }
}
```

### Error — Jira disabled

```bash
curl http://localhost:3000/api/jira/tickets/PI-42
# 400: { "message": "Jira integration is not enabled" }
```

## Notes

- This endpoint does **not** use the in-memory cache. It always makes a live Jira API call, so it reflects the most current ticket state.
- The `rawFields` object is included for debugging and advanced integrations. It contains the unprocessed Jira fields exactly as returned by the Jira REST API.
- A 10-second timeout applies to the Jira API call. Slow Jira instances may cause timeouts.
- The ticket key is URL-encoded before being sent to Jira, so special characters are handled safely.

## Related Endpoints

- [List Jira Tickets](/api-docs/jira/tickets) — Fetch all open tickets from the project
- [Link Jira Ticket](/api-docs/jira/link) — Link this ticket to a new production job
- [Get Settings](/api-docs/settings/get) — Check field mapping configuration

::
