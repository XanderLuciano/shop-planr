# Shop Planr

Workshop planning and ERP built with [Nuxt 4](https://nuxt.com) and [NuxtUI 4](https://ui.nuxt.com).

## Screenshots

| | |
|---|---|
| ![Dashboard](docs/screenshots/desktop/dashboard.png) | ![Jobs List](docs/screenshots/desktop/jobs-list.png) |
| Dashboard — summary cards, job progress, bottleneck alerts | Jobs — expandable table with paths and steps |
| ![Parts View](docs/screenshots/desktop/parts.png) | ![Work Queue](docs/screenshots/desktop/queue.png) |
| Parts View — active parts grouped by job/step | Work Queue — grouped by operator/assignee |
| ![Parts Browser](docs/screenshots/desktop/parts-browser.png) | ![Templates](docs/screenshots/desktop/templates.png) |
| Parts Browser — searchable/filterable part list | Templates — reusable route template CRUD |
| ![Audit](docs/screenshots/desktop/audit.png) | ![Settings](docs/screenshots/desktop/settings.png) |
| Audit Trail — filterable event log | Settings — users, Jira, libraries |

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
