---
title: "List Jira Tickets"
description: "Retrieve Jira tickets from the connected Jira project"
method: "GET"
endpoint: "/api/jira/tickets"
service: "jiraService"
category: "Jira"
responseType: "JiraTicket[]"
errorCodes: [400, 502]
navigation:
  order: 1
---

# List Jira Tickets

::endpoint-card{method="GET" path="/api/jira/tickets"}

Retrieves Jira tickets from the connected Jira project. Requires a valid Jira connection configured in app settings.

## Response

Returns an array of Jira ticket objects:

```json
[
  {
    "key": "PI-42",
    "summary": "Build 50 widgets",
    "status": "In Progress",
    "priority": "High",
    "partNumber": "WDG-001",
    "epicLink": "PI-10",
    "labels": ["production", "q1"]
  }
]
```

## Errors

| Code | Condition |
|------|-----------|
| `400` | Jira connection not configured |
| `502` | Jira API unreachable or returned an error |

::
