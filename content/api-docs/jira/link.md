---
title: "Link Jira Ticket"
description: "Link a Jira ticket to a new production job, optionally applying a route template"
method: "POST"
endpoint: "/api/jira/link"
service: "jiraService"
category: "Jira"
requestBody: "LinkJiraInput"
responseType: "{ job: Job, path: Path | null }"
errorCodes: [400, 404, 502]
navigation:
  order: 3
---

# Link Jira Ticket

::endpoint-card{method="POST" path="/api/jira/link"}

Links a Jira ticket to a new production job by fetching the ticket's details from Jira and creating a `Job` record populated with the ticket's metadata (summary, part number, priority, epic link, labels). This is the primary mechanism for importing work orders from Jira into Shop Planr.

The endpoint performs two operations in sequence:

1. **Fetch & create job** — Calls the Jira API to retrieve the ticket by key, normalizes the fields using configured mappings, and creates a new job. The job name defaults to the ticket summary (or the ticket key if the summary is empty). The goal quantity is taken from the `goalQuantity` input parameter, falling back to the ticket's quantity custom field, and finally defaulting to `1`.

2. **Apply template (optional)** — If a `templateId` is provided, the specified route template is applied to the newly created job, creating a path with pre-configured process steps. The `goalQuantity` from the job is used for the path.

The Jira connection must be enabled in settings. Only the `enabled` toggle is required — `pushEnabled` is not needed for linking.

## Request

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticketKey` | `string` | Yes | The Jira issue key to link (e.g. `"PI-42"`). Must be a non-empty string. The ticket must exist in Jira. |
| `templateId` | `string` | No | ID of a route template to apply to the new job. When provided, a path is created from the template's steps. If the template is not found, a `404` is returned. |
| `goalQuantity` | `number` | No | Override goal quantity for the new job. If omitted, the quantity is read from the Jira ticket's custom field. If that is also empty, defaults to `1`. |

## Response

### 200 OK

Returns an object containing the newly created `Job` and optionally the `Path` created from the template.

| Field | Type | Description |
|-------|------|-------------|
| `job` | `Job` | The newly created job with Jira metadata populated |
| `path` | `Path \| null` | The path created from the template, or `null` if no `templateId` was provided |

#### Job Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Server-generated unique identifier |
| `name` | `string` | Job name (defaults to ticket summary or ticket key) |
| `goalQuantity` | `number` | Target production quantity |
| `jiraTicketKey` | `string` | The linked Jira ticket key |
| `jiraTicketSummary` | `string \| undefined` | Ticket summary from Jira |
| `jiraPartNumber` | `string \| undefined` | Part number from Jira custom field |
| `jiraPriority` | `string \| undefined` | Priority from Jira |
| `jiraEpicLink` | `string \| undefined` | Epic link from Jira |
| `jiraLabels` | `string[] \| undefined` | Labels from Jira |
| `createdAt` | `string` | ISO 8601 creation timestamp |
| `updatedAt` | `string` | ISO 8601 update timestamp |

### 400 Bad Request

| Condition | Message |
|-----------|---------|
| Jira integration is disabled | `"Jira integration is not enabled"` |
| `ticketKey` is missing or empty | `"ticketKey is required"` |

### 404 Not Found

| Condition | Message |
|-----------|---------|
| `templateId` provided but template does not exist | `"TemplateRoute not found: {templateId}"` |
| Ticket key does not exist in Jira | Jira API 404 re-thrown |

### 502 Bad Gateway

| Condition | Message |
|-----------|---------|
| Jira API unreachable or returned an error | `"Jira API error: {status} {statusText}"` |

## Examples

### Request — Link with template

```bash
curl -X POST http://localhost:3000/api/jira/link \
  -H "Content-Type: application/json" \
  -d '{
    "ticketKey": "PI-42",
    "templateId": "tmpl_abc123",
    "goalQuantity": 50
  }'
```

### Response — Link with template

```json
{
  "job": {
    "id": "job_x7k9m2",
    "name": "Build 50 aluminum housings",
    "goalQuantity": 50,
    "jiraTicketKey": "PI-42",
    "jiraTicketSummary": "Build 50 aluminum housings",
    "jiraPartNumber": "ALU-HOUSING-7075",
    "jiraPriority": "High",
    "jiraEpicLink": "PI-10",
    "jiraLabels": ["Q1-2024", "rush"],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "path": {
    "id": "path_a3b8c1",
    "jobId": "job_x7k9m2",
    "name": "Standard Route",
    "goalQuantity": 50,
    "steps": [
      { "id": "step_001", "name": "CNC Machining", "order": 0, "location": "Bay 1", "optional": false, "dependencyType": "preferred" },
      { "id": "step_002", "name": "Deburring", "order": 1, "optional": false, "dependencyType": "preferred" },
      { "id": "step_003", "name": "Inspection", "order": 2, "location": "QC Lab", "optional": false, "dependencyType": "physical" }
    ],
    "advancementMode": "strict",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Request — Link without template

```bash
curl -X POST http://localhost:3000/api/jira/link \
  -H "Content-Type: application/json" \
  -d '{
    "ticketKey": "PI-43"
  }'
```

### Response — Link without template

```json
{
  "job": {
    "id": "job_m4n7p9",
    "name": "Machine 200 steel brackets",
    "goalQuantity": 200,
    "jiraTicketKey": "PI-43",
    "jiraTicketSummary": "Machine 200 steel brackets",
    "jiraPartNumber": "STL-BRACKET-304",
    "jiraPriority": "Medium",
    "createdAt": "2024-01-15T11:00:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  },
  "path": null
}
```

## Notes

- The job name is derived from the Jira ticket summary. If the summary is empty, the ticket key is used as the job name.
- The `goalQuantity` resolution order is: request body → Jira custom field → default of `1`.
- Jira metadata fields (`jiraTicketKey`, `jiraTicketSummary`, etc.) are **write-once at creation time** and cannot be modified via the [Update Job](/api-docs/jobs/update) endpoint.
- Linking does not check for duplicate links. You can link the same Jira ticket to multiple jobs, though this is not recommended.
- If a `templateId` is provided and the template application fails, the job is still created. The error is thrown after job creation, so you may end up with a job but no path.
- The template's steps are deep-cloned when applied, so subsequent changes to the template do not affect the created path.

## Related Endpoints

- [List Jira Tickets](/api-docs/jira/tickets) — Browse open tickets to find one to link
- [Get Jira Ticket](/api-docs/jira/ticket-detail) — Preview ticket details before linking
- [Create Job](/api-docs/jobs/create) — Create a job manually without Jira
- [Apply Template](/api-docs/templates/apply) — Apply a template to an existing job

::
