---
title: "Jira API"
description: "Optional Jira integration — ticket lookup, linking, push, and comments"
icon: "i-lucide-ticket"
navigation:
  order: 8
---

# Jira API

The Jira API provides optional, bidirectional integration between Shop Planr and Atlassian Jira. When enabled, production jobs can be linked to Jira tickets, and manufacturing data can be pushed back to Jira as description updates or comments. This integration is designed around a single Jira project (typically a "PI" project with custom fields for part numbers, quantities, and epic links) and uses Jira's REST API v2 with Basic authentication.

## Concepts

### Connection & Toggles

Jira integration is **off by default** and controlled by two independent toggles in [App Settings](/api-docs/settings):

1. **`enabled`** — Master switch. When `false`, all Jira endpoints return `400 Jira integration is not enabled`. Ticket fetching and linking require only this toggle.
2. **`pushEnabled`** — Controls write operations back to Jira. The push and comment endpoints require *both* `enabled` and `pushEnabled` to be `true`.

### Ticket Normalization

Raw Jira issue data is normalized into a consistent `JiraTicket` shape using configurable field mappings stored in settings. The default mappings target the PI project's custom fields (`customfield_10908` for part number, `customfield_10900` for quantity, `customfield_10014` for epic link), but these can be reconfigured via the [Settings API](/api-docs/settings/update).

### Linking Flow

The typical workflow is:

1. Fetch open tickets via `GET /api/jira/tickets`
2. Select a ticket and link it to a new job via `POST /api/jira/link`, optionally applying a route template
3. As production progresses, push status updates back to Jira via `POST /api/jira/push` or `POST /api/jira/comment`

### Caching

The ticket list endpoint caches results in memory. If the Jira API is unreachable, the endpoint returns the cached list along with an error message rather than failing outright. This ensures the UI remains functional during transient Jira outages.

### Push Modes

Two push strategies are available:

- **Description table** — Appends a Jira wiki markup table to the ticket's description showing serial counts at each process step, timestamped by date.
- **Comment summary** — Posts a new comment with a human-readable status summary per path and step.

Individual step notes can also be pushed as Jira comments, formatted as `{StepName} - {SN(s)}: {note text}`.

## Common Use Cases

- **Import work orders from Jira** — Fetch tickets, link one to create a job, apply a template to set up routing automatically.
- **Keep Jira updated** — Push description tables after each shift to maintain a running log of production progress on the ticket.
- **Escalate defects** — Push step notes as Jira comments so quality issues are visible to project managers in Jira.

## Endpoints

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| `GET` | [`/api/jira/tickets`](/api-docs/jira/tickets) | List open Jira tickets from the configured project | `enabled` |
| `GET` | [`/api/jira/tickets/:key`](/api-docs/jira/ticket-detail) | Get a single Jira ticket by key | `enabled` |
| `POST` | [`/api/jira/link`](/api-docs/jira/link) | Link a Jira ticket to a new production job | `enabled` |
| `POST` | [`/api/jira/push`](/api-docs/jira/push) | Push a description table to the linked Jira ticket | `enabled` + `pushEnabled` |
| `POST` | [`/api/jira/comment`](/api-docs/jira/comment) | Push a comment summary or individual note to Jira | `enabled` + `pushEnabled` |

## Related

- [Settings API](/api-docs/settings) — Configure Jira connection, field mappings, and toggles
- [Jobs API](/api-docs/jobs) — Production jobs that Jira tickets link to
- [Notes API](/api-docs/notes) — Step notes that can be pushed as Jira comments
