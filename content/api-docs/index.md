---
title: "API Documentation"
description: "Shop Planr REST API reference — 52+ endpoints across 14 service domains"
navigation:
  order: 0
---

# Shop Planr API Documentation

Welcome to the Shop Planr REST API reference. This documentation covers all 52+ endpoints organized across 14 service domains that power the job routing and ERP system.

## Getting Started

Shop Planr exposes a RESTful API under the `/api` prefix. All endpoints accept and return JSON. The API is served by Nitro (Nuxt's server engine) and backed by SQLite.

### Base URL

```
http://localhost:3000/api
```

### Request Format

- All request bodies must be JSON with `Content-Type: application/json`
- URL parameters use `:param` syntax (e.g., `/api/jobs/:id`)
- Query parameters are used for filtering and pagination

### Response Format

Successful responses return the resource directly as JSON. Error responses follow this structure:

```json
{
  "statusCode": 400,
  "message": "Validation error description"
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `400` | Validation error — missing or invalid fields |
| `404` | Resource not found |
| `500` | Internal server error |

## Service Domains

The API is organized into 14 service domains, each handling a distinct area of functionality:

| Domain | Prefix | Description |
|--------|--------|-------------|
| **Jobs** | `/api/jobs` | Production order CRUD and progress tracking |
| **Paths** | `/api/paths` | Route instances with ordered process steps |
| **Serials** | `/api/serials` | Serial number lifecycle — creation, advancement, scrap |
| **Certificates** | `/api/certs` | Certificate management and attachment |
| **Templates** | `/api/templates` | Reusable route templates |
| **BOM** | `/api/bom` | Bill of materials roll-ups and versioning |
| **Audit** | `/api/audit` | Immutable audit trail |
| **Jira** | `/api/jira` | Optional Jira integration |
| **Settings** | `/api/settings` | App configuration and page toggles |
| **Users** | `/api/users` | Kiosk-mode user profiles |
| **Notes** | `/api/notes` | Process step notes and defects |
| **Operator** | `/api/operator` | Workstation and queue views |
| **Steps** | `/api/steps` | Step assignment and configuration |
| **Library** | `/api/library` | Process and location libraries |

## Architecture

```
Client → API Routes → Services → Repositories → SQLite
```

All business logic lives in the service layer. API routes are thin HTTP handlers that validate input, call the appropriate service, and return the result. Repositories handle data access and are injected into services via a factory pattern.
