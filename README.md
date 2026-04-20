# Shop Planr

Workshop planning and ERP built with [Nuxt 4](https://nuxt.com) and [NuxtUI 4](https://ui.nuxt.com).

## Screenshots

<!-- SCREENSHOTS:START -->
| | |
|---|---|
| ![Dashboard](docs/screenshots/desktop/dashboard.png) | ![Jobs List](docs/screenshots/desktop/jobs-list.png) |
| Dashboard — Summary cards, job progress, bottleneck alerts | Jobs List — Expandable table with paths and steps |
| ![Parts View](docs/screenshots/desktop/parts.png) | ![Work Queue](docs/screenshots/desktop/queue.png) |
| Parts View — Active parts grouped by job/step | Work Queue — Grouped by operator/assignee |
| ![Parts Browser](docs/screenshots/desktop/parts-browser.png) | ![Templates](docs/screenshots/desktop/templates.png) |
| Parts Browser — Searchable/filterable part list | Templates — Reusable route template CRUD |
| ![Audit Trail](docs/screenshots/desktop/audit.png) | ![Settings](docs/screenshots/desktop/settings.png) |
| Audit Trail — Filterable event log | Settings — Users, Jira, libraries |
<!-- SCREENSHOTS:END -->

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

## Seed Data

```bash
npm run seed          # Idempotent sample data
npm run seed:reset    # Delete + re-seed
```

## Regenerate Screenshots

Start the dev server, then run the screenshot script in another terminal:

```bash
npm run dev
npm run screenshots
```

## Production

```bash
npm run build
docker build -t shop-erp .
docker-compose up -d
```
