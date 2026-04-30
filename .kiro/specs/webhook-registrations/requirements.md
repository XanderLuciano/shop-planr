# Requirements Document

## Introduction

Rearchitect the existing webhook system from a simple toggle-based single-endpoint configuration to a standard webhook registration pattern. The current system uses a singleton `webhookConfig` with a single endpoint URL and an on/off toggle. The new system supports multiple named registrations, each with its own URL and subscribed event types. Events are decoupled from registrations via a delivery join table, enabling per-registration delivery tracking, retry, and cancellation. Client-side dispatch (browser → LAN endpoint) is preserved because the server cannot reach LAN targets.

## Glossary

- **Registration_Service**: The server-side service managing CRUD operations on webhook registrations
- **Event_Service**: The server-side service managing domain event recording (webhook_events table)
- **Delivery_Service**: The server-side service managing webhook delivery records (creation, status transitions, cancellation)
- **Dispatch_Engine**: The client-side (browser) component that picks up queued deliveries and sends HTTP POST requests to registration endpoint URLs
- **Registrations_Page**: The frontend UI for managing webhook registrations (create, edit, delete)
- **Event_Log_Page**: The frontend UI displaying domain events with nested delivery summaries and action buttons
- **Webhook_Registration**: A user-created record containing a name, endpoint URL, and subscribed event types
- **Webhook_Event**: A domain event record (e.g. job.completed, part.advanced) created regardless of registrations
- **Webhook_Delivery**: A join record linking one event to one matching registration, with a status lifecycle
- **Event_Type_Enum**: The fixed set of known webhook event types (part_advanced, part_completed, part_created, part_scrapped, part_force_completed, step_skipped, step_deferred, step_waived, job_created, job_deleted, path_deleted, note_created, cert_attached)
- **Delivery_Status**: The lifecycle status of a delivery: queued, delivering, delivered, failed, canceled


## Requirements

### Requirement 1: Webhook Registration CRUD

**User Story:** As an admin, I want to create, read, update, and delete webhook registrations, so that I can configure multiple endpoints for different event types.

#### Acceptance Criteria

1. WHEN an admin submits a valid registration with a name, URL, and at least one event type, THE Registration_Service SHALL create a new Webhook_Registration and return it with a generated ID
2. WHEN an admin requests the list of registrations, THE Registration_Service SHALL return all Webhook_Registration records ordered by creation date descending
3. WHEN an admin submits an update to an existing registration, THE Registration_Service SHALL update the name, URL, or subscribed event types and return the updated record
4. WHEN an admin deletes a registration, THE Registration_Service SHALL remove the Webhook_Registration record from the database
5. IF a registration name is empty or a URL is empty, THEN THE Registration_Service SHALL reject the request with a validation error
6. IF a registration references an event type not in the Event_Type_Enum, THEN THE Registration_Service SHALL reject the request with a validation error
7. THE Registration_Service SHALL allow multiple registrations with the same URL but different event type subscriptions

### Requirement 2: Domain Event Recording

**User Story:** As the system, I want to record domain events independently of registrations, so that events exist as a permanent log regardless of how many registrations match.

#### Acceptance Criteria

1. WHEN a domain action occurs (part advanced, job created, etc.), THE Event_Service SHALL create a Webhook_Event record with the event type, payload, and summary
2. THE Event_Service SHALL record events regardless of whether any Webhook_Registration exists
3. THE Event_Service SHALL assign each Webhook_Event a unique ID and a creation timestamp
4. WHEN a Webhook_Event is created, THE Delivery_Service SHALL create one Webhook_Delivery record for each Webhook_Registration whose subscribed event types include the event type
5. THE Delivery_Service SHALL create delivery records only for registrations that exist at the moment the event is recorded; registrations created after an event is recorded SHALL NOT retroactively receive deliveries for that event
6. IF no Webhook_Registration matches the event type, THEN THE Delivery_Service SHALL create zero delivery records for that event
7. THE Delivery_Service SHALL set the initial status of each new Webhook_Delivery to "queued"

### Requirement 3: Delivery Status Lifecycle

**User Story:** As an admin, I want delivery records to track their status through a defined lifecycle, so that I can see which deliveries succeeded, failed, or were canceled.

#### Acceptance Criteria

1. WHEN the Dispatch_Engine begins sending a delivery, THE Dispatch_Engine SHALL transition the delivery status from "queued" to "delivering"
2. WHEN the target endpoint responds with an HTTP 2xx status, THE Dispatch_Engine SHALL transition the delivery status from "delivering" to "delivered" and record the response timestamp
3. WHEN the target endpoint responds with a non-2xx status or a network error occurs, THE Dispatch_Engine SHALL transition the delivery status from "delivering" to "failed" and record the error message
4. WHEN an admin retries a failed delivery, THE Delivery_Service SHALL transition the delivery status from "failed" to "queued"
5. WHEN an admin cancels a queued delivery, THE Delivery_Service SHALL transition the delivery status from "queued" to "canceled"
6. IF a status transition is requested that does not follow the allowed lifecycle (queued → delivering → delivered|failed, failed → queued, queued → canceled), THEN THE Delivery_Service SHALL reject the transition with a validation error

### Requirement 4: Registration Deletion Cascade

**User Story:** As an admin, I want deleting a registration to cancel pending deliveries and preserve historical records, so that no orphaned queued work remains but audit history is retained.

#### Acceptance Criteria

1. WHEN a Webhook_Registration is deleted, THE Delivery_Service SHALL transition all "queued" deliveries for that registration to "canceled"
2. WHEN a Webhook_Registration is deleted, THE Delivery_Service SHALL leave all "delivered" and "failed" deliveries unchanged as historical records
3. WHEN a Webhook_Registration is deleted, THE Event_Service SHALL continue to record new events without creating deliveries for the deleted registration
4. THE Delivery_Service SHALL perform the queued-to-canceled transition and the registration deletion within a single database transaction

### Requirement 5: Client-Side Dispatch

**User Story:** As a user, I want webhook deliveries to be sent from my browser, so that the webhooks can reach LAN endpoints that the server cannot access.

#### Acceptance Criteria

1. WHEN a user opens the webhooks page, THE Dispatch_Engine SHALL fetch all deliveries with status "queued" from the server
2. THE Dispatch_Engine SHALL send each queued delivery as an HTTP POST request to the URL from the associated Webhook_Registration
3. THE Dispatch_Engine SHALL include the event type, summary, timestamp, and payload fields in the POST request body as JSON
4. WHEN a delivery is successfully sent, THE Dispatch_Engine SHALL report the "delivered" status back to the server
5. WHEN a delivery fails, THE Dispatch_Engine SHALL report the "failed" status and error message back to the server
6. WHILE no user has the webhooks page open, THE Delivery_Service SHALL accumulate deliveries in "queued" status without data loss
7. THE Dispatch_Engine SHALL process deliveries sequentially per registration URL to avoid overwhelming a single endpoint

### Requirement 6: Event Log with Nested Deliveries

**User Story:** As an admin, I want to view events with their delivery summaries, so that I can quickly see which events were delivered successfully and which had failures.

#### Acceptance Criteria

1. WHEN an admin views the event log, THE Event_Log_Page SHALL display events in reverse chronological order with event type, summary, and timestamp
2. THE Event_Log_Page SHALL display a delivery summary for each event showing the count of deliveries by status (e.g. "3 Webhooks: 2 delivered, 1 failed")
3. WHEN an admin expands an event, THE Event_Log_Page SHALL display each individual delivery with the registration name, URL, status, and error details if failed
4. WHEN an admin clicks "Replay all" on an event, THE Delivery_Service SHALL re-queue all deliveries for that event by creating new delivery records with "queued" status
5. WHEN an admin clicks "Retry failed" on an event, THE Delivery_Service SHALL transition only the "failed" deliveries for that event back to "queued" status
6. WHEN an admin clicks "Retry" on a single failed delivery, THE Delivery_Service SHALL transition that delivery from "failed" to "queued"
7. WHEN an admin clicks "Cancel" on a single queued delivery, THE Delivery_Service SHALL transition that delivery from "queued" to "canceled"
8. WHEN an admin clicks "Fire" on a single queued delivery, THE Dispatch_Engine SHALL immediately send that delivery to the target URL regardless of the automatic dispatch cycle

### Requirement 7: Registrations Management UI

**User Story:** As an admin, I want a dedicated UI for managing webhook registrations, so that I can create, edit, and delete registrations with event type selection.

#### Acceptance Criteria

1. THE Registrations_Page SHALL display all existing registrations in a list showing name, URL, and subscribed event count
2. WHEN an admin clicks "Add Registration", THE Registrations_Page SHALL display a form with fields for name, URL, and event type checkboxes
3. THE Registrations_Page SHALL include a "Subscribe to all" checkbox that checks all individual event type checkboxes
4. WHEN an admin selects "Subscribe to all", THE Registrations_Page SHALL check all individual event type checkboxes (the subscription is stored as the full list of event types, not a special value)
5. WHEN an admin submits the registration form with valid data, THE Registrations_Page SHALL create the registration and add it to the list
6. WHEN an admin clicks edit on a registration, THE Registrations_Page SHALL populate the form with the existing registration data for modification
7. WHEN an admin clicks delete on a registration, THE Registrations_Page SHALL display a confirmation dialog explaining that queued deliveries will be canceled
8. IF the registration form has an empty name or empty URL, THEN THE Registrations_Page SHALL disable the submit button and display a validation message

### Requirement 8: Data Model Migration

**User Story:** As a developer, I want the database schema to support multiple registrations with a delivery join table, so that the new webhook architecture is properly persisted.

#### Acceptance Criteria

1. THE Migration SHALL create a `webhook_registrations` table with columns: id (TEXT PRIMARY KEY), name (TEXT NOT NULL), url (TEXT NOT NULL), event_types (TEXT NOT NULL, JSON array), created_at (TEXT NOT NULL), updated_at (TEXT NOT NULL)
2. THE Migration SHALL create a `webhook_deliveries` table with columns: id (TEXT PRIMARY KEY), event_id (TEXT NOT NULL, FK to webhook_events), registration_id (TEXT NOT NULL, FK to webhook_registrations), status (TEXT NOT NULL DEFAULT 'queued'), error (TEXT), created_at (TEXT NOT NULL), updated_at (TEXT NOT NULL)
3. THE Migration SHALL add an index on `webhook_deliveries(event_id)` for efficient event-to-delivery lookups
4. THE Migration SHALL add an index on `webhook_deliveries(registration_id, status)` for efficient per-registration queued delivery queries
5. THE Migration SHALL rebuild the `webhook_events` table to drop columns that are now tracked per-delivery (status, sent_at, last_error, retry_count), keeping only id, event_type, payload, summary, created_at
6. THE Migration SHALL drop the `webhook_config` table since the singleton config is replaced by the registrations model
7. FOR ALL valid Webhook_Delivery records, serializing then deserializing the delivery record SHALL produce an equivalent object (round-trip property)

### Requirement 9: API Endpoints

**User Story:** As a developer, I want RESTful API endpoints for registrations and deliveries, so that the frontend can manage the full webhook lifecycle.

#### Acceptance Criteria

1. THE Registration_Service SHALL expose GET /api/webhooks/registrations to list all registrations
2. THE Registration_Service SHALL expose POST /api/webhooks/registrations to create a registration
3. THE Registration_Service SHALL expose PATCH /api/webhooks/registrations/:id to update a registration
4. THE Registration_Service SHALL expose DELETE /api/webhooks/registrations/:id to delete a registration with cascade
5. THE Delivery_Service SHALL expose GET /api/webhooks/deliveries/queued to list all queued deliveries with their associated registration URLs
6. THE Delivery_Service SHALL expose POST /api/webhooks/deliveries/batch-status to update delivery statuses in bulk
7. THE Delivery_Service SHALL expose POST /api/webhooks/events/:eventId/replay to re-queue all deliveries for an event
8. THE Delivery_Service SHALL expose POST /api/webhooks/events/:eventId/retry-failed to re-queue only failed deliveries for an event
9. THE Delivery_Service SHALL expose PATCH /api/webhooks/deliveries/:id to update a single delivery status (retry, cancel)
10. WHEN any registration or delivery endpoint is called without admin authentication, THE server SHALL reject the request with a 401 or 403 error


