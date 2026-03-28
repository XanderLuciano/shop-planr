---
title: "Get Jira Ticket"
description: "Retrieve a single Jira ticket by key"
method: "GET"
endpoint: "/api/jira/tickets/:key"
service: "jiraService"
category: "Jira"
responseType: "JiraTicket"
errorCodes: [400, 404, 502]
navigation:
  order: 2
---

# Get Jira Ticket

::endpoint-card{method="GET" path="/api/jira/tickets/:key"}

Retrieves a single Jira ticket by its key. Returns detailed ticket information including custom field mappings.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | `string` | Yes | Jira ticket key (e.g. `PI-42`) |

## Response

Returns a Jira ticket object:

```json
{
  "key": "PI-42",
  "summary": "Build 50 widgets",
  "status": "In Progress",
  "priority": "High",
  "partNumber": "WDG-001",
  "epicLink": "PI-10",
  "labels": ["production", "q1"]
}
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Jira connection not configured |
| `404` | Ticket not found in Jira |
| `502` | Jira API unreachable or returned an error |

::
