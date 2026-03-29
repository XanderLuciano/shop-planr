---
title: 'Users API'
description: 'Kiosk-mode user profiles — create and manage shop floor operators'
icon: 'i-lucide-users'
navigation:
  order: 10
---

# Users API

The Users API manages simple kiosk-mode user profiles for Shop Planr. Users represent shop floor operators, inspectors, and other personnel who interact with the production system. There are no passwords or authentication — user identity exists purely for attribution (who advanced a serial, who created a note) and assignment (who is responsible for a process step).

## Concepts

### Kiosk-Mode Identity

Shop Planr is designed for shared workstation environments where operators select their name from a dropdown rather than logging in. A `ShopUser` record provides just enough identity to:

- **Assign steps** — Link an operator to a process step so their work appears in the [Work Queue](/api-docs/operator/work-queue).
- **Attribute actions** — Record who advanced a serial, created a note, scrapped a part, or attached a certificate in the [Audit Trail](/api-docs/audit).
- **Filter work** — The operator work queue can be filtered by user to show only the steps assigned to a specific person.

### Active vs. Inactive

Users have an `active` boolean flag. Inactive users:

- Still appear in historical audit records and existing step assignments
- Are excluded from the `GET /api/users` response (which returns only active users)
- Cannot be assigned to new steps (the assign endpoint validates that the user is active)

Deactivation is a soft delete — the user record is preserved for audit trail integrity.

### Departments

The optional `department` field is a free-text string for organizational grouping (e.g. `"Assembly"`, `"Quality Control"`, `"CNC"`). It has no functional impact on routing or assignment but is displayed in the UI for context.

## Common Use Cases

- **Onboard a new operator** — Create a user with name and department, then assign them to relevant process steps.
- **Transfer departments** — Update the user's department field.
- **Off-board an operator** — Set `active: false` to remove them from dropdowns while preserving their audit history.
- **Seasonal workforce** — Reactivate previously deactivated users by setting `active: true`.

## Endpoints

| Method | Path                                       | Description             |
| ------ | ------------------------------------------ | ----------------------- |
| `GET`  | [`/api/users`](/api-docs/users/list)       | List all active users   |
| `POST` | [`/api/users`](/api-docs/users/create)     | Create a new user       |
| `PUT`  | [`/api/users/:id`](/api-docs/users/update) | Update an existing user |

## Related

- [Steps API](/api-docs/steps) — Assign users to process steps
- [Operator API](/api-docs/operator) — Work queue views filtered by user
- [Notes API](/api-docs/notes) — Notes attributed to users via `createdBy`
