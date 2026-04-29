# Implementation Plan: Webhook Registrations

## Overview

Replace the singleton webhook configuration (`webhook_config` table) with a multi-registration webhook system. This involves a new database migration, two new repository interfaces + SQLite implementations, two new services, nine new API routes, removal of old config routes and code, new Zod schemas, new composables, a rewritten webhooks page with two-tab layout, and comprehensive property-based + unit tests. No backward compatibility layer is maintained since this branch is pre-production.

## Tasks

- [x] 1. Database migration and domain types
  - [x] 1.1 Create migration 018_webhook_registrations.sql
    - Create `webhook_registrations` table (id TEXT PK, name TEXT NOT NULL, url TEXT NOT NULL, event_types TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)
    - Create `webhook_deliveries` table (id TEXT PK, event_id TEXT NOT NULL FK webhook_events(id) ON DELETE CASCADE, registration_id TEXT NOT NULL FK webhook_registrations(id), status TEXT NOT NULL DEFAULT 'queued', error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)
    - Create index `idx_webhook_deliveries_event_id` on webhook_deliveries(event_id)
    - Create index `idx_webhook_deliveries_registration_status` on webhook_deliveries(registration_id, status)
    - Create index `idx_webhook_deliveries_status` on webhook_deliveries(status)
    - Rebuild `webhook_events` table to drop dead columns (status, sent_at, last_error, retry_count) — these are now tracked per-delivery. Use the standard SQLite rebuild pattern: create new table with only id, event_type, payload, summary, created_at → copy data → drop old → rename new → recreate any indexes
    - Drop `webhook_config` table
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 1.2 Add new domain types to server/types/domain.ts
    - Add `WebhookDeliveryStatus` type ('queued' | 'delivering' | 'delivered' | 'failed' | 'canceled')
    - Add `WebhookRegistration` interface (id, name, url, eventTypes, createdAt, updatedAt)
    - Add `WebhookDelivery` interface (id, eventId, registrationId, status, error?, createdAt, updatedAt)
    - Add `QueuedDeliveryView` interface (delivery + joined registration + event fields for dispatch engine)
    - Add `DeliveryDetail` interface (delivery + registration info for event log UI)
    - Add `EventWithDeliveries` interface (event + delivery summary counts)
    - Update `WebhookEvent` interface to remove `status`, `sentAt`, `lastError`, `retryCount` fields (now tracked per-delivery)
    - Update `WebhookEventStatus` type or remove if no longer needed
    - _Requirements: 8.1, 8.2_

  - [x] 1.3 Export new types from app/types/domain.ts
    - Add exports for `WebhookDeliveryStatus`, `WebhookRegistration`, `WebhookDelivery`, `QueuedDeliveryView`, `DeliveryDetail`, `EventWithDeliveries`
    - _Requirements: 8.1, 8.2_

- [x] 2. Zod schemas for registrations and deliveries
  - [x] 2.1 Create server/schemas/webhookRegistrationSchemas.ts
    - `createRegistrationSchema`: name (string min 1 max 100), url (string min 1 url), eventTypes (array of strings min 1)
    - `updateRegistrationSchema`: name, url, eventTypes all optional with same constraints
    - `batchDeliveryStatusSchema`: deliveries array with id, status enum, optional error
    - `updateDeliveryStatusSchema`: status enum, optional error
    - Import `requiredId` from `_primitives.ts` and `WEBHOOK_EVENT_TYPES` from domain
    - _Requirements: 1.5, 1.6, 9.1–9.9_

- [x] 3. Repository interfaces and SQLite implementations
  - [x] 3.1 Create server/repositories/interfaces/webhookRegistrationRepository.ts
    - Define `WebhookRegistrationRepository` interface: create, getById, list, update, delete, listByEventType
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 3.2 Create server/repositories/interfaces/webhookDeliveryRepository.ts
    - Define `WebhookDeliveryRepository` interface: create, createMany, getById, listQueued, listByEventId, updateStatus, updateManyStatus, cancelQueuedByRegistrationId, listFailedByEventId, countByEventId, getDeliverySummariesByEventIds
    - _Requirements: 2.4, 3.1–3.6, 4.1, 5.1_

  - [x] 3.3 Update server/repositories/interfaces/index.ts barrel export
    - Add exports for `WebhookRegistrationRepository` and `WebhookDeliveryRepository`
    - _Requirements: 8.1, 8.2_

  - [x] 3.4 Create server/repositories/sqlite/webhookRegistrationRepository.ts
    - Implement `WebhookRegistrationRepository` with SQLite queries
    - `list()` returns registrations ordered by created_at DESC
    - `listByEventType()` filters registrations whose JSON event_types array contains the given type
    - Row-to-domain mapping for `WebhookRegistration` (JSON parse event_types)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7_

  - [x] 3.5 Create server/repositories/sqlite/webhookDeliveryRepository.ts
    - Implement `WebhookDeliveryRepository` with SQLite queries
    - `listQueued()` joins webhook_deliveries + webhook_registrations + webhook_events to return `QueuedDeliveryView[]`
    - `listByEventId()` joins webhook_deliveries + webhook_registrations to return `DeliveryDetail[]`
    - `cancelQueuedByRegistrationId()` updates all queued deliveries for a registration to canceled
    - `getDeliverySummariesByEventIds()` returns delivery count by status grouped by event_id
    - _Requirements: 2.4, 3.1–3.6, 4.1, 5.1_

  - [x] 3.6 Update RepositorySet and createSQLiteRepositories
    - Add `webhookRegistrations: WebhookRegistrationRepository` and `webhookDeliveries: WebhookDeliveryRepository` to `RepositorySet` interface in `server/repositories/sqlite/index.ts`
    - Remove `webhookConfig: WebhookConfigRepository` from `RepositorySet`
    - Instantiate new repos in `createSQLiteRepositories()`, remove webhookConfig instantiation
    - Update imports accordingly
    - _Requirements: 8.1, 8.2_

- [x] 4. Checkpoint — Ensure migration and repositories compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Services
  - [x] 5.1 Create server/services/webhookRegistrationService.ts
    - `create(userId, input)`: validate name non-empty, URL non-empty, eventTypes all in WEBHOOK_EVENT_TYPES; generate ID with `generateId('whr')`; requireAdmin; create via repo
    - `list()`: return all registrations from repo
    - `getById(id)`: return registration or throw NotFoundError
    - `update(userId, id, input)`: validate input fields; requireAdmin; update via repo
    - `delete(userId, id)`: requireAdmin; cancel queued deliveries via deliveryRepo.cancelQueuedByRegistrationId; delete registration via repo (in a transaction)
    - _Requirements: 1.1–1.7, 4.1–4.4_

  - [x] 5.2 Create server/services/webhookDeliveryService.ts
    - `fanOut(event)`: list registrations matching event type via registrationRepo.listByEventType; create one delivery per matching registration with status 'queued'; return created deliveries
    - `listQueued(limit?)`: delegate to deliveryRepo.listQueued
    - `updateStatus(id, status, error?)`: validate lifecycle transition (queued→delivering, queued→canceled, delivering→delivered, delivering→failed, failed→queued); throw ValidationError on invalid transition; delegate to repo
    - `batchUpdateStatus(updates)`: validate each transition; delegate to repo
    - `replayEvent(userId, eventId)`: requireAdmin; get event or throw NotFoundError; list registrations matching event type; create new delivery records for each; return new deliveries
    - `retryFailed(userId, eventId)`: requireAdmin; list failed deliveries for event; transition each from failed→queued
    - `cancel(id)`: get delivery or throw NotFoundError; validate queued→canceled transition; update status
    - `listByEventId(eventId)`: delegate to deliveryRepo.listByEventId
    - _Requirements: 2.4–2.7, 3.1–3.6, 4.1–4.2, 6.4–6.7_

  - [x] 5.3 Modify server/services/webhookService.ts for fan-out
    - Add `webhookDeliveries` and `webhookRegistrations` repo dependencies to the service factory
    - After creating an event in `queueEvent()`, call delivery fan-out logic (create deliveries for all matching registrations)
    - Remove config-related methods (`getConfig`, `updateConfig`) and `webhookConfig` repo dependency
    - Remove `skipQueuedByType` calls (no longer needed — delivery model replaces per-event status filtering)
    - Remove `WebhookConfig` interface from `server/types/domain.ts`
    - Remove `WebhookConfigRepository` interface from `server/repositories/interfaces/webhookRepository.ts`
    - Remove `createSQLiteWebhookConfigRepository` from `server/repositories/sqlite/webhookRepository.ts`
    - Remove `WebhookConfigRepository` export from `server/repositories/interfaces/index.ts`
    - Remove `WebhookConfig` export from `app/types/domain.ts`
    - _Requirements: 2.1–2.7, 8.6_

  - [x] 5.4 Update server/utils/services.ts (service wiring)
    - Import and create `webhookRegistrationService` and `webhookDeliveryService`
    - Pass new repos (`webhookRegistrations`, `webhookDeliveries`) to `webhookService`
    - Add new services to `ServiceSet` interface and return object
    - Remove `webhookConfig` repo reference from webhookService creation
    - _Requirements: 1.1, 2.4, 9.1–9.9_

  - [x] 5.5 Write property tests for registration service (Properties 1, 2, 3)
    - **Property 1: Registration creation preserves input** — create with valid input, retrieve by ID, verify name/url/eventTypes match
    - **Validates: Requirements 1.1**
    - **Property 2: Registration list ordering** — create N registrations at distinct times, list returns reverse chronological order
    - **Validates: Requirements 1.2**
    - **Property 3: Invalid registration input rejection** — empty name, empty URL, or unknown event type → ValidationError, no record created
    - **Validates: Requirements 1.5, 1.6**
    - Test file: `tests/properties/webhookRegistration.property.test.ts`

  - [x] 5.6 Write property tests for delivery fan-out (Properties 4, 11, 12)
    - **Property 4: Delivery fan-out correctness** — for any event type and set of registrations, delivery count equals matching registrations count, all deliveries have status 'queued'
    - **Validates: Requirements 2.4, 2.6, 2.7, 10.3**
    - **Property 11: Event ID uniqueness** — N events created in sequence all have distinct IDs
    - **Validates: Requirements 2.3**
    - **Property 12: No retroactive deliveries** — registrations created after events do not receive deliveries for those events
    - **Validates: Requirements 2.5**
    - Test file: `tests/properties/webhookDeliveryFanout.property.test.ts`

  - [x] 5.7 Write property tests for delivery lifecycle (Properties 5, 7)
    - **Property 5: Delivery status lifecycle enforcement** — only valid transitions succeed (queued→delivering, queued→canceled, delivering→delivered, delivering→failed, failed→queued); all others rejected
    - **Validates: Requirements 3.6**
    - **Property 7: Retry-failed selectivity** — retry-failed only transitions failed deliveries to queued; all other statuses unchanged
    - **Validates: Requirements 6.5**
    - Test file: `tests/properties/webhookDeliveryLifecycle.property.test.ts`

  - [x] 5.8 Write property tests for deletion cascade and replay (Properties 6, 8)
    - **Property 6: Registration deletion cascade** — deleting a registration cancels queued deliveries, leaves delivered/failed unchanged
    - **Validates: Requirements 4.1, 4.2**
    - **Property 8: Replay creates new deliveries** — replaying an event creates new delivery records for all matching registrations without modifying existing deliveries
    - **Validates: Requirements 6.4**
    - Test file: `tests/properties/webhookDeliveryFanout.property.test.ts` (additional properties)

  - [x] 5.9 Write property test for delivery serialization (Property 9)
    - **Property 9: Delivery round-trip serialization** — serialize a WebhookDelivery to a DB row and back, verify equivalence
    - **Validates: Requirements 8.7**
    - Test file: `tests/properties/webhookDeliverySerialization.property.test.ts`

  - [x] 5.10 Write property test for dispatch payload (Property 10)
    - **Property 10: Dispatch payload completeness** — for any QueuedDeliveryView, the constructed payload contains event, summary, timestamp, plus all event payload keys
    - **Validates: Requirements 5.3**
    - Test file: `tests/properties/webhookDispatchPayload.property.test.ts`

- [x] 6. Checkpoint — Ensure all service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. API routes
  - [x] 7.1 Create registration CRUD routes
    - `server/api/webhooks/registrations/index.get.ts` — GET list all registrations
    - `server/api/webhooks/registrations/index.post.ts` — POST create registration (admin, parseBody with createRegistrationSchema)
    - `server/api/webhooks/registrations/[id].patch.ts` — PATCH update registration (admin, parseBody with updateRegistrationSchema)
    - `server/api/webhooks/registrations/[id].delete.ts` — DELETE registration with cascade (admin)
    - All routes use `defineApiHandler`, `getAuthUserId(event)`, `defineRouteMeta` with OpenAPI tags ['Webhooks']
    - _Requirements: 9.1–9.4, 9.10_

  - [x] 7.2 Create delivery and event action routes
    - `server/api/webhooks/deliveries/queued.get.ts` — GET list queued deliveries with registration URLs
    - `server/api/webhooks/deliveries/batch-status.post.ts` — POST batch update delivery statuses (parseBody with batchDeliveryStatusSchema)
    - `server/api/webhooks/deliveries/[id].patch.ts` — PATCH update single delivery status (parseBody with updateDeliveryStatusSchema)
    - `server/api/webhooks/events/[eventId]/replay.post.ts` — POST re-queue all deliveries for event (admin)
    - `server/api/webhooks/events/[eventId]/retry-failed.post.ts` — POST re-queue failed deliveries for event (admin)
    - All routes use `defineApiHandler`, `defineRouteMeta` with OpenAPI tags ['Webhooks']
    - _Requirements: 9.5–9.10_

  - [x] 7.3 Modify existing event routes for delivery integration
    - Update `server/api/webhooks/events/index.get.ts` to return `EventWithDeliveries[]` (events with delivery summary counts)
    - Update `server/api/webhooks/events/index.post.ts` — queueEvent now triggers fan-out automatically via the modified webhookService
    - _Requirements: 6.1, 6.2_

  - [x] 7.4 Remove old config routes and related code
    - Delete `server/api/webhooks/config.get.ts`
    - Delete `server/api/webhooks/config.patch.ts`
    - Delete `server/api/webhooks/events/test.post.ts` (test endpoint replaced by registration-based dispatch)
    - Remove old webhook config-related route tests if any exist
    - _Requirements: 8.6_

  - [x] 7.5 Write unit tests for new API routes
    - Test registration CRUD routes with valid/invalid input
    - Test delivery status update routes with valid/invalid transitions
    - Test admin auth guards on mutation endpoints
    - _Requirements: 9.1–9.10_

- [x] 8. Checkpoint — Ensure all API route tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Client-side composables
  - [x] 9.1 Create app/composables/useWebhookRegistrations.ts
    - Reactive state: `registrations` ref, `loading`, `error`
    - `fetchRegistrations()`: GET /api/webhooks/registrations
    - `createRegistration(input)`: POST /api/webhooks/registrations, refresh list
    - `updateRegistration(id, input)`: PATCH /api/webhooks/registrations/:id, refresh list
    - `deleteRegistration(id)`: DELETE /api/webhooks/registrations/:id, refresh list
    - Use `useAuthFetch()` for all API calls
    - _Requirements: 1.1–1.4, 7.1–7.8_

  - [x] 9.2 Create app/composables/useWebhookDeliveries.ts
    - Reactive state: `dispatching`, `error`
    - `fetchQueuedDeliveries()`: GET /api/webhooks/deliveries/queued → returns QueuedDeliveryView[]
    - `dispatchQueued()`: fetch queued deliveries, send HTTP POST to each registration URL sequentially per URL, batch report statuses back via POST /api/webhooks/deliveries/batch-status
    - `dispatchSingle(delivery)`: send single delivery to its registration URL, report status
    - `updateDeliveryStatus(id, status, error?)`: PATCH /api/webhooks/deliveries/:id
    - `replayEvent(eventId)`: POST /api/webhooks/events/:eventId/replay
    - `retryFailed(eventId)`: POST /api/webhooks/events/:eventId/retry-failed
    - `cancelDelivery(id)`: PATCH /api/webhooks/deliveries/:id with status 'canceled'
    - Dispatch payload format: { event, summary, timestamp, ...payload }
    - Sequential dispatch per registration URL to avoid overwhelming endpoints
    - _Requirements: 5.1–5.7, 6.4–6.8_

  - [x] 9.3 Rewrite app/composables/useWebhookEvents.ts
    - Remove config-related state and methods (fetchConfig, updateConfig)
    - Remove old dispatch logic that used config.endpointUrl and enabledSince filtering
    - Update events list to work with `EventWithDeliveries` type (events now include delivery summaries)
    - Keep fetchEvents, fetchStats, deleteEvent, clearAllEvents
    - Update `useWebhookEmit` composable to only POST events (remove any config checks)
    - _Requirements: 6.1, 6.2_

- [x] 10. Rewrite webhooks page UI
  - [x] 10.1 Rewrite app/pages/webhooks.vue — Registrations tab
    - Two-tab layout using UTabs: "Registrations" + "Event Log"
    - Registrations tab: list all registrations showing name, URL, subscribed event count
    - "Add Registration" button opens a form with name input, URL input, event type checkboxes
    - "Subscribe to all" checkbox that checks/unchecks all individual event type checkboxes (stored as full list, not special value)
    - Edit button populates form with existing registration data
    - Delete button shows UModal confirmation dialog explaining queued deliveries will be canceled
    - Form validation: disable submit when name or URL is empty, show validation messages
    - Wire to `useWebhookRegistrations` composable
    - _Requirements: 7.1–7.8_

  - [x] 10.2 Rewrite app/pages/webhooks.vue — Event Log tab
    - Display events in reverse chronological order with event type, summary, timestamp
    - Delivery summary per event: "N Webhooks: X delivered, Y failed, Z queued" etc.
    - Expandable event rows showing individual deliveries with registration name, URL, status, error details
    - "Replay all" button per event (creates new deliveries for all matching registrations)
    - "Retry failed" button per event (re-queues only failed deliveries)
    - Per-delivery "Retry" button (failed → queued), "Cancel" button (queued → canceled), "Fire" button (immediately dispatch a queued delivery)
    - Wire to `useWebhookEvents` and `useWebhookDeliveries` composables
    - Dispatch loop: auto-dispatch queued deliveries while page is open, sequential per URL
    - _Requirements: 6.1–6.8, 5.1–5.7_

  - [x] 10.3 Remove old config tab and developer tab references
    - Remove Configuration tab (replaced by Registrations tab)
    - Keep Developer tab with payload documentation (update dispatch format docs if needed)
    - Remove all references to `useWebhookEvents().config`, `updateConfig`, `fetchConfig`
    - _Requirements: 7.1, 10.1_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (12 properties across 6 test files)
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all code examples and implementations use TypeScript
- Old config code removal is folded into Task 5.3 (service refactor) and Task 7.4 (route cleanup)
- Migration 018 drops `webhook_config` table — this is a one-way migration
