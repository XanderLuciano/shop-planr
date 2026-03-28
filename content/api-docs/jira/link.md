---
title: "Link Jira Ticket"
description: "Link a Jira ticket to a job, optionally creating the job from a template"
method: "POST"
endpoint: "/api/jira/link"
service: "jiraService"
category: "Jira"
requestBody: "LinkJiraInput"
responseType: "Job"
errorCodes: [400, 404, 502]
navigation:
  order: 3
---

# Link Jira Ticket

::endpoint-card{method="POST" path="/api/jira/link"}

Links a Jira ticket to a production job. If a `templateId` is provided, a new job is created from the template and linked to the ticket. If `goalQuantity` is provided, it overrides the template default.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticketKey` | `string` | Yes | Jira ticket key (e.g. `PI-42`) |
| `templateId` | `string` | No | Template ID to create a new job from |
| `goalQuantity` | `number` | No | Override goal quantity for the new job |

## Example Request

```json
{
  "ticketKey": "PI-42",
  "templateId": "tmpl_abc123",
  "goalQuantity": 50
}
```

## Response

Returns the linked or newly created `Job` object:

```json
{
  "id": "job_abc123",
  "name": "PI-42",
  "goalQuantity": 50,
  "jiraTicketKey": "PI-42",
  "jiraTicketSummary": "Build 50 widgets",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Missing `ticketKey` or invalid input |
| `404` | Template not found (when `templateId` provided) |
| `502` | Jira API unreachable or returned an error |

::
