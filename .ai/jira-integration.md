# Jira Integration — SHOP_ERP

> PI project custom fields, REST API patterns, and push/pull flow.

## Overview

Jira integration is optional and layered in three phases:

1. Standalone core (Jira off — the default)
2. Read-only pull (import tickets from PI project)
3. Write/push to Jira (stretch goal)

Two independent toggles in `AppSettings.jiraConnection`:

- `enabled` — global on/off. When off, all Jira UI is hidden.
- `pushEnabled` — write toggle. Only active when `enabled` is also true.

## Jira API

- Base URL: configured via `JIRA_BASE_URL` env var (e.g. `https://jira.example.com/rest/api/2/`)
- Auth: Basic auth (username + API token)
- Timeout: 10 seconds
- Active tickets JQL: `project = PI AND resolution is EMPTY`

## PI Project Custom Fields

| Field ID            | Label                       | SHOP_ERP mapping     |
| ------------------- | --------------------------- | -------------------- |
| `customfield_10908` | Part Number / Rev (PRIMARY) | `Job.jiraPartNumber` |
| `customfield_10909` | Quantity                    | `Job.goalQuantity`   |
| `customfield_10923` | Part Number (alternate)     | fallback PN          |
| `customfield_13000` | MFG Part Number             | metadata             |
| `customfield_10949` | Material Certs Required     | metadata             |
| `customfield_10937` | Delivery Date               | metadata             |
| `customfield_10602` | Start date                  | metadata             |
| `customfield_10603` | End date                    | metadata             |
| `customfield_10101` | Epic Link                   | `Job.jiraEpicLink`   |
| `customfield_10926` | Subsystem                   | metadata             |
| `customfield_10925` | Part Type                   | metadata             |

These mappings are configurable via the Settings UI (`JiraFieldMapping[]`). The constants above are defaults.

## Part Number Resolution

1. Check `customfield_10908` (Part Number / Rev) — primary
2. Fallback: parse summary with regex `/\d{6,7}-\d{3}(-\d{2})?/`
3. Return null if neither yields a result

## Ticket-to-Job Mapping

When linking a Jira ticket to a SHOP_ERP job:

- `Job.name` = ticket summary
- `Job.goalQuantity` = `customfield_10909` or user-provided
- `Job.jiraTicketKey` = ticket key (e.g. "PI-7987")
- `Job.jiraPriority` = ticket priority name
- `Job.jiraEpicLink` = `customfield_10101`
- `Job.jiraLabels` = ticket labels array

## Push Formats

Description table push (per Path):

```
|| Date || Step1 || Step2 || Completed ||
| 2026-03-13 | 5 | 3 | 10 |
| 2026-03-14 | 2 | 4 | 15 |
```

Each push appends a new date row.

Comment push for notes/defects:

```
{StepName} - {SN(s)}: {note text}
```

Example: `Machining - SN3: threaded feature is missing`

## Error Handling

- Connection failure: return cached/previous ticket list + error banner
- Write rejection: retain payload locally for retry, show Jira error
- Null/missing mapped fields: treat as empty, no error

## Configuration Sources (precedence)

1. Database `settings` table (primary — set via Settings UI)
2. Environment variables (fallback for first boot):
   - `JIRA_BASE_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`

## Attachment Pattern Recognition

Jira attachments can be auto-categorized by filename:

- `*-dwg*.pdf` → Drawings
- `*_SCAN.pdf` → Inspection scan data
- `*CERT*.pdf` → Material certificates
- `*.DXF` → 2D CAD
- `*.stp`, `*.step` → 3D CAD
