---
title: "Jobs API"
description: "Production order management — create, read, update jobs and track progress across paths and serial numbers"
icon: "i-lucide-briefcase"
navigation:
  order: 1
---

# Jobs API

The Jobs API is the primary entry point for managing production orders in Shop Planr. A **job** represents a discrete production order — typically mapped one-to-one with a customer work order or a Jira ticket — that tracks how many units need to be built and how far along production has progressed.

## Domain Concepts

### Jobs, Paths, and Serials

Every job contains one or more **paths**. A path defines a specific manufacturing route: an ordered sequence of **process steps** that serial numbers travel through. Each path carries its own goal quantity and advancement mode (`strict`, `flexible`, or `per_step`), allowing a single job to split production across different routing strategies.

**Serial numbers** are the individual units being produced. They are created in batches against a specific path and advance through that path's steps one at a time. The job's overall progress is computed by aggregating completion data across all of its paths and their serial numbers.

### Jira Integration

Jobs can optionally be linked to Jira tickets. When a job is created — either manually or via the Jira sync workflow — fields like `jiraTicketKey`, `jiraTicketSummary`, `jiraPartNumber`, `jiraPriority`, `jiraEpicLink`, and `jiraLabels` are stored on the job record. These fields are informational and do not affect production logic; they exist to maintain traceability between Shop Planr and your Jira project.

### Progress Tracking

The `GET /api/jobs/:id` endpoint returns computed progress statistics alongside the job record. Progress is calculated in real time by examining the status of every serial number across all paths. This includes total goal, total completed, and a per-path breakdown with individual completion percentages.

## Common Use Cases

- **Creating a production order**: Call `POST /api/jobs` with a name and goal quantity. Optionally attach Jira metadata if the job originated from a Jira ticket.
- **Viewing the production dashboard**: Call `GET /api/jobs` to list all jobs, then drill into a specific job with `GET /api/jobs/:id` to see paths, steps, and real-time progress.
- **Adjusting a job mid-production**: Call `PUT /api/jobs/:id` to rename a job or change its goal quantity. Note that only `name` and `goalQuantity` can be updated after creation; Jira fields are immutable once set.
- **Setting up routing**: After creating a job, use the [Paths API](/api-docs/paths) to define one or more manufacturing routes with process steps, then create serial numbers against those paths.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | [`/api/jobs`](/api-docs/jobs/list) | List all production jobs |
| `GET` | [`/api/jobs/:id`](/api-docs/jobs/get) | Get a single job with its paths and computed progress |
| `POST` | [`/api/jobs`](/api-docs/jobs/create) | Create a new production job |
| `PUT` | [`/api/jobs/:id`](/api-docs/jobs/update) | Update an existing job's name or goal quantity |

## Related APIs

- [Paths API](/api-docs/paths) — Define manufacturing routes and process steps within a job
- [Serials API](/api-docs/serials) — Create and advance serial numbers through path steps
- [Jira API](/api-docs/jira) — Sync jobs with Jira tickets and push progress updates
