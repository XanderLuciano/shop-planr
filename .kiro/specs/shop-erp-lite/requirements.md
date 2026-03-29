# Requirements Document

## Introduction

SHOP_ERP is a job routing and ERP application for machine shops. It provides production order tracking, multi-path routing of parts through process steps, serial number management, certificate traceability, progress visualization, and Jira integration. The application is built with Nuxt 4 / Vue, Nuxt UI 4.3.0, and TypeScript, targeting both desktop planning and shop-floor data entry workflows.

## Glossary

- **Job**: A production order representing a batch of parts to manufacture, with a goal quantity and one or more Paths.
- **Path**: An instance of a route — a specific ordered sequence of Process Steps that parts follow to completion within a Job.
- **Process_Step**: An individual operation within a Path (e.g., OP1, stress relief, coating, final inspection). Parts advance through Process Steps sequentially.
- **Serial_Number (SN)**: A unique identifier assigned to every physical part. Tracks which Job, Path, and current Process Step the part belongs to, along with attached Certificates.
- **Certificate (Cert)**: A quality document (material cert, process cert) attached to one or more Serial Numbers at a given Process Step. Stored in the Cert Database.
- **Cert_Database**: The application's internal store of all Certificate records.
- **Goal_Quantity**: The target number of parts to produce, defined at both Job and Path levels.
- **BOM (Bill of Materials)**: A definition of which parts and quantities are needed to build a sub-assembly.
- **Template_Route**: A pre-defined sequence of Process Steps that can be applied to new Jobs for quick setup.
- **Progress_Bar**: A visual indicator showing percentage of parts completed toward a Goal Quantity, with color-coded status.
- **Dashboard**: The main overview screen showing Job status, Jira tickets, and roll-up summaries.
- **Audit_Trail**: A log recording which user performed which action and when.
- **QR_Scanner**: The interface component that reads QR codes to look up or attach Certificates and Serial Numbers.
- **Jira_Integration**: The module responsible for reading tickets from and optionally writing data back to an external Jira instance.
- **SHOP_ERP**: The application system as a whole.

## Requirements

### Requirement 1: Job Creation and Management

**User Story:** As a shop planner, I want to create and manage production jobs, so that I can track all work orders in one place regardless of whether they originate from Jira.

#### Acceptance Criteria

1. WHEN a user submits a new Job form with a name and Goal Quantity, THE SHOP_ERP SHALL create a new Job record and display it in the Job list.
2. WHEN a user creates a Job without a Jira ticket association, THE SHOP_ERP SHALL store the Job as a standalone record with the same tracking capabilities as Jira-linked Jobs.
3. WHEN a user edits a Job's Goal Quantity, THE SHOP_ERP SHALL update the Goal Quantity and recalculate the Progress Bar for that Job.
4. THE SHOP_ERP SHALL compute a Job's part count as the sum of all Serial Numbers across all Paths belonging to that Job.
5. WHEN a Job's total completed Serial Numbers exceed the Goal Quantity, THE SHOP_ERP SHALL display the Progress Bar above 100% to indicate over-production.
6. IF a user attempts to create a Job with a Goal Quantity of zero or less, THEN THE SHOP_ERP SHALL reject the submission and display a validation error message.

### Requirement 2: Path (Route Instance) Management

**User Story:** As a shop planner, I want to define multiple paths for a single job, so that parts can take different routes to completion in parallel.

#### Acceptance Criteria

1. WHEN a user adds a Path to a Job, THE SHOP_ERP SHALL create a new Path record with an ordered sequence of Process Steps and its own Goal Quantity.
2. THE SHOP_ERP SHALL allow multiple Paths to exist on a single Job, each running independently with its own Process Step sequence.
3. WHEN a user sets a Path Goal Quantity above or below the Job Goal Quantity, THE SHOP_ERP SHALL accept the value without constraint, allowing flexible production planning.
4. THE SHOP_ERP SHALL display the count of Serial Numbers at each Process Step within a Path, showing distribution of parts across the route.
5. WHEN a Process Step in a Path has more Serial Numbers waiting than any other step, THE SHOP_ERP SHALL visually identify that step as a bottleneck.
6. IF a user attempts to create a Path with zero Process Steps, THEN THE SHOP_ERP SHALL reject the creation and display a validation error.

### Requirement 3: Process Step Definition and Part Advancement

**User Story:** As a shop floor operator, I want to advance parts through process steps, so that the system accurately reflects where each part is in the production route.

#### Acceptance Criteria

1. WHEN a user advances a Serial Number to the next Process Step in its Path, THE SHOP_ERP SHALL update the Serial Number's current step and increment the count at the destination step.
2. THE SHOP_ERP SHALL enforce sequential advancement of Serial Numbers through Process Steps within a Path — a Serial Number at step N can only advance to step N+1.
3. IF a user attempts to advance a Serial Number that is already at the final Process Step, THEN THE SHOP_ERP SHALL mark the Serial Number as completed and update the Job's completed count.
4. WHEN a Serial Number advances from one Process Step to the next, THE SHOP_ERP SHALL decrement the count at the origin step and increment the count at the destination step.
5. THE SHOP_ERP SHALL allow a Certificate to be attached to a Serial Number at any Process Step during advancement.
6. THE SHOP_ERP SHALL support an optional physical location field on each Process Step (e.g., "Machine Shop", "QC Lab", "Vendor - Anodize Co.") that indicates where the work happens and where parts should be delivered.

### Requirement 4: Serial Number Creation and Tracking

**User Story:** As a shop floor operator, I want to create serial numbers in batches when running OP1, so that every physical part is tracked from the start of production.

#### Acceptance Criteria

1. WHEN a user specifies a quantity at OP1 (the first Process Step), THE SHOP_ERP SHALL create that many Serial Number records, each with a unique identifier, assigned to the specified Job and Path.
2. THE SHOP_ERP SHALL generate Serial Number identifiers that are unique across the entire system — no two Serial Numbers share the same identifier.
3. WHEN a batch of Serial Numbers is created, THE SHOP_ERP SHALL allow a single material Certificate to be attached to all Serial Numbers in the batch.
4. THE SHOP_ERP SHALL store for each Serial Number: the owning Job, the assigned Path, the current Process Step, and all attached Certificates.
5. WHEN a user looks up a Serial Number, THE SHOP_ERP SHALL display the Serial Number's Job, Path, current Process Step, and all attached Certificates.
6. IF a user attempts to create Serial Numbers on a Path that has no Process Steps defined, THEN THE SHOP_ERP SHALL reject the operation and display an error message.

### Requirement 5: Certificate Management

**User Story:** As a quality engineer, I want to manage certificates and attach them to parts, so that every part has full traceability of material and process certifications.

#### Acceptance Criteria

1. WHEN a user creates a new Certificate record, THE SHOP_ERP SHALL store the Certificate in the Cert Database with a unique identifier, type (material or process), and associated metadata.
2. WHEN a user attaches a Certificate to a Serial Number at a Process Step, THE SHOP_ERP SHALL record the association including the Process Step, the timestamp, and the authenticated user who performed the action.
3. WHEN a user selects multiple Serial Numbers and a Certificate, THE SHOP_ERP SHALL batch-apply the Certificate to all selected Serial Numbers in a single operation.
4. THE SHOP_ERP SHALL maintain an Audit Trail for every Certificate attachment, recording the user identity, timestamp, Serial Number, and Certificate identifier.
5. IF a user attempts to attach a Certificate that does not exist in the Cert Database, THEN THE SHOP_ERP SHALL reject the operation and display an error message.
6. WHEN a user queries a Serial Number's Certificates, THE SHOP_ERP SHALL return all attached Certificates in the order they were applied.

### Requirement 6: QR Code and Barcode Scanner Integration

**User Story:** As a shop floor operator, I want to scan QR codes and barcodes to quickly look up parts and attach certificates, so that data entry is fast and error-free on the shop floor.

#### Acceptance Criteria

1. WHEN a user scans a QR code containing a Serial Number identifier, THE QR_Scanner SHALL look up the Serial Number and display its current status (Job, Path, Process Step, Certificates).
2. WHEN a user scans a QR code containing a Certificate identifier, THE QR_Scanner SHALL retrieve the Certificate from the Cert Database and present an option to attach the Certificate to a selected Serial Number.
3. IF a scanned QR code does not match any Serial Number or Certificate in the system, THEN THE QR_Scanner SHALL display a "not found" error message with the scanned value.
4. WHEN a Certificate is attached via QR scan, THE SHOP_ERP SHALL record the same Audit Trail entry as a manual attachment (user, timestamp, Serial Number, Certificate).
5. THE SHOP_ERP SHALL provide a barcode/scanner input field on all relevant views (job detail, operator view, cert attachment) that accepts input from USB/Bluetooth barcode scanners.
6. THE SHOP_ERP SHALL support a global keyboard hotkey (`/`) that immediately focuses the barcode scanner input field from anywhere in the application.
7. THE SHOP_ERP SHALL display a camera-based QR scan button adjacent to the barcode input field for scanning via device camera as an alternative to a hardware scanner.
8. WHEN a barcode or QR value is entered (via scanner, camera, or manual typing), THE SHOP_ERP SHALL auto-detect whether it is a Serial Number or Certificate identifier and route to the appropriate lookup.

### Requirement 7: Progress Tracking and Visualization

**User Story:** As a shop manager, I want to see visual progress of jobs and paths with expandable drill-down, so that I can quickly assess production status at any level of detail.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL display a Progress Bar for each Job showing the percentage of completed Serial Numbers relative to the Job's Goal Quantity.
2. THE SHOP_ERP SHALL color-code the Progress Bar using blue (#3B82F6) for in-progress portions and green (#22C55E) for completed portions, displayed simultaneously.
3. WHEN a Job's completed count changes, THE SHOP_ERP SHALL update the Progress Bar in real time without requiring a page refresh.
4. THE SHOP_ERP SHALL display path-level tracking showing the distribution of Serial Numbers across Process Steps for each Path.
5. THE SHOP_ERP SHALL roll up path-level progress to the Job level, aggregating counts from all Paths belonging to a Job.
6. WHEN a Job reaches 100% completion, THE SHOP_ERP SHALL display the Progress Bar as fully green while still allowing additional Serial Numbers to be completed beyond the goal.
7. WHEN a user expands a Job in the job list, THE SHOP_ERP SHALL show all Paths (routes) belonging to that Job, each with its own progress summary.
8. WHEN a user expands a Path, THE SHOP_ERP SHALL show the ordered sequence of Process Steps (e.g., Machining → Inspection → Coating) with the count of in-progress and completed Serial Numbers at each step.
9. FOR each Process Step in an expanded Path, THE SHOP_ERP SHALL display: the step name, the number of parts currently at that step, and the number of parts that have completed that step.

### Requirement 8: Template Routes

**User Story:** As a shop planner, I want to apply pre-defined route templates to new jobs, so that I can set up common production routes quickly without manual step-by-step entry.

#### Acceptance Criteria

1. WHEN a user creates a Template Route, THE SHOP_ERP SHALL store the template as a named, ordered sequence of Process Step definitions.
2. WHEN a user applies a Template Route to a Job, THE SHOP_ERP SHALL create a new Path on that Job with Process Steps matching the template's sequence.
3. WHEN a user applies a Template Route, THE SHOP_ERP SHALL allow the user to customize the generated Path's Process Steps after application (add, remove, reorder steps).
4. THE SHOP_ERP SHALL preserve the original Template Route unchanged when a user modifies a Path that was created from the template.
5. IF a user attempts to apply a Template Route that has been deleted, THEN THE SHOP_ERP SHALL display an error message indicating the template no longer exists.

### Requirement 9: Jira Integration — Read (Pull)

**User Story:** As a shop planner, I want to optionally view open Jira tickets and apply routes to them, so that I can turn Jira work items into tracked production jobs when Jira is available.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL provide a global Jira integration toggle in Settings that enables or disables all Jira functionality. When disabled, all Jira-related UI elements (dashboard, push buttons, ticket links) SHALL be hidden.
2. WHEN Jira integration is enabled and a user opens the Jira Dashboard view, THE Jira_Integration SHALL fetch and display open Jira tickets that have no associated Job in SHOP_ERP.
3. WHEN a user selects a Jira ticket and applies a Template Route, THE SHOP_ERP SHALL create a new Job linked to that Jira ticket with a Path generated from the selected template.
4. WHEN a user triggers a refresh on the Jira Dashboard, THE Jira_Integration SHALL re-fetch the current list of open tickets from Jira and update the display.
5. IF the Jira API is unreachable during a fetch, THEN THE Jira_Integration SHALL display an error message indicating the connection failure and retain the previously loaded ticket list.
6. THE Jira_Integration SHALL store the Jira ticket key and summary on the linked Job record for reference.
7. THE SHOP_ERP SHALL function fully as a standalone application when Jira integration is disabled — all job creation, routing, tracking, and reporting features SHALL work without any Jira configuration.

### Requirement 10: Jira Integration — Write (Push) (Stretch Goal)

**User Story:** As a shop planner, I want to optionally push production status back to Jira as structured tables and formatted comments, so that stakeholders using Jira can see detailed progress without accessing SHOP_ERP.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL provide a separate "Jira Push" toggle in Settings (independent of the read toggle) that enables or disables all write operations to Jira. Push features SHALL only be available when both the global Jira toggle AND the push toggle are enabled.
2. WHEN a user triggers a description push for a Job linked to a Jira ticket, THE Jira_Integration SHALL append a status table to the end of the Jira ticket description — one table per Path, with columns for each Process Step and a row for the current date showing the count of parts at each step.
3. WHEN a subsequent description push is triggered for the same Job, THE Jira_Integration SHALL add a new date row to the existing table(s) rather than replacing them, creating a time-series history of part distribution.
4. WHEN a user triggers a comment push, THE Jira_Integration SHALL post a Jira comment summarizing the current part counts at each Process Step for each Path.
5. WHEN a user posts a defect, note, or issue from a Process Step, THE Jira_Integration SHALL post a Jira comment formatted as: `{StepName} - {SerialNumber(s)}: {note text}` (e.g., "Machining - SN3: threaded feature is missing").
6. IF the Jira API rejects a write operation, THEN THE Jira_Integration SHALL display the error details and retain the data locally for retry.
7. WHEN a Job reaches completion, THE Jira_Integration SHALL offer to upload all associated documentation (Certificates, completion summary) to the linked Jira ticket.

### Requirement 11: Roll-Up Views (Sub-Assembly Summary)

**User Story:** As a production manager, I want to define bills of materials and see aggregated progress across contributing jobs, so that I can determine if enough parts are ready to build a sub-assembly.

#### Acceptance Criteria

1. WHEN a user defines a BOM, THE SHOP_ERP SHALL store the BOM as a named list of part types with required quantities per build.
2. WHEN a user associates Jobs with a BOM entry, THE SHOP_ERP SHALL aggregate completed, in-progress, and outstanding counts across all contributing Jobs for that part type.
3. THE SHOP_ERP SHALL display a summary view for each BOM showing: total parts needed, total parts completed, and total parts in-progress for each part type.
4. WHEN a contributing Job's progress changes, THE SHOP_ERP SHALL update the BOM summary view to reflect the new totals.
5. IF a BOM part type has zero contributing Jobs, THEN THE SHOP_ERP SHALL display the part type with zero completed and zero in-progress counts.

### Requirement 12: Data Persistence and Database Abstraction

**User Story:** As a developer, I want a database-backed persistence layer with swappable implementations, so that data integrity is maintained and the system can scale to different database backends.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL persist all domain objects (Job, Path, Process Step, Serial Number, Certificate, Template Route, BOM, Audit Entry, Settings) in a SQLite database as the default backend.
2. THE SHOP_ERP SHALL access all persistent data through repository interfaces, so that the database backend can be swapped without changing service or API layer code.
3. THE SHOP_ERP SHALL provide a repository factory that returns concrete implementations based on configuration (initially SQLite, extensible to PostgreSQL or others).
4. THE SHOP_ERP SHALL run database migrations on startup to create or update the schema as needed.
5. THE SHOP_ERP SHALL serialize domain objects to JSON for API responses and export/import functionality, with round-trip fidelity — `deserialize(serialize(obj))` produces an equivalent object.
6. IF the SHOP_ERP receives malformed input during deserialization, THEN THE SHOP_ERP SHALL return a descriptive error identifying the malformed field or structure.

### Requirement 13: Audit Trail

**User Story:** As a quality engineer, I want a complete audit trail of all certificate and part actions, so that I can demonstrate traceability during audits.

#### Acceptance Criteria

1. WHEN a user attaches a Certificate to a Serial Number, THE SHOP_ERP SHALL record an Audit Trail entry containing: user identity, timestamp, Serial Number identifier, Certificate identifier, and Process Step.
2. WHEN a user creates Serial Numbers in a batch, THE SHOP_ERP SHALL record an Audit Trail entry for the batch creation including: user identity, timestamp, quantity created, Job, and Path.
3. WHEN a user advances a Serial Number to the next Process Step, THE SHOP_ERP SHALL record an Audit Trail entry containing: user identity, timestamp, Serial Number, origin step, and destination step.
4. THE SHOP_ERP SHALL store Audit Trail entries as immutable records — entries cannot be modified or deleted after creation.
5. WHEN a user queries the Audit Trail for a Serial Number, THE SHOP_ERP SHALL return all entries in chronological order.

### Requirement 14: Jira Field Mapping Configuration

**User Story:** As a shop admin, I want to configure which Jira custom fields map to SHOP_ERP fields through the UI, so that I can adjust the integration when field IDs change without modifying code.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL provide a Settings page where an admin can view and edit the Jira custom field mapping (e.g., which custom field ID maps to "Part Number / Rev", "Quantity", "Epic Link", etc.).
2. WHEN an admin updates a field mapping and saves, THE SHOP_ERP SHALL persist the new mapping and use it for all subsequent Jira API calls.
3. THE SHOP_ERP SHALL ship with a default field mapping matching the known PI project custom fields, so the system works out of the box without configuration.
4. THE SHOP_ERP SHALL allow an admin to add new custom field mappings (field ID + display label + target SHOP_ERP field) for fields not in the default set.
5. THE SHOP_ERP SHALL allow an admin to remove custom field mappings that are no longer relevant.
6. WHEN a mapped Jira field returns null or is missing from the API response, THE SHOP_ERP SHALL treat the value as empty/null without erroring.
7. THE SHOP_ERP SHALL also allow configuration of the Jira connection settings (base URL, project key, credentials) from the same Settings page.

### Requirement 15: User Management (Simple / Kiosk Mode)

**User Story:** As a shop admin, I want to create user profiles that operators can select from a list to identify themselves, so that actions are attributed to the right person without requiring passwords or complex authentication.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL provide a user management section in the Settings page where an admin can create, edit, and deactivate user profiles (name, display name, optional role/department).
2. THE SHOP_ERP SHALL display a user selector (click-to-select from a list of active users) that allows an operator to identify themselves when using the application.
3. THE SHOP_ERP SHALL persist the selected user in the browser session so the operator does not need to re-select on every page navigation.
4. WHEN a user performs an auditable action (cert attachment, SN advancement, note creation), THE SHOP_ERP SHALL record the currently selected user's identity in the Audit Trail.
5. IF no user is selected, THE SHOP_ERP SHALL prompt the operator to select a user before allowing auditable actions.
6. THE SHOP_ERP SHALL NOT require passwords or authentication — this is a high-trust, in-person kiosk environment.

### Requirement 15: Operator / Workstation View

**User Story:** As a shop floor operator assigned to a specific process (e.g., machining, QC), I want to see what work is at my step, what's coming next, and what's backlogged further upstream, so that I can plan my workload.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL provide an Operator View that shows all Serial Numbers currently at a selected Process Step across all active Jobs and Paths.
2. FOR each Serial Number at the selected step, THE SHOP_ERP SHALL display: the Job name, Path name, Serial Number identifier, and how long the part has been at this step.
3. THE SHOP_ERP SHALL show a "Coming Soon" section listing Serial Numbers at the immediately preceding step (one step upstream), indicating parts that will arrive at this step next.
4. THE SHOP_ERP SHALL show a "Backlog" section listing Serial Numbers at steps further upstream (two or more steps away), indicating future work that is not imminent.
5. FOR steps that involve external vendors (e.g., outsourced coating), THE SHOP_ERP SHALL display the count of parts currently at the vendor and the next internal step they will arrive at when returned.
6. WHEN a user selects a different Process Step, THE SHOP_ERP SHALL update the Operator View to reflect the work distribution for the newly selected step.
7. THE SHOP_ERP SHALL show where each part goes after the current step — both the next step name and its physical location in the Path — so the operator knows where to deliver the part.

### Requirement 16: View Modes and Filtering

**User Story:** As a shop manager, I want to view work across the shop in multiple ways — by all jobs, by assignee, or filtered by specific criteria — so that I can slice the data to answer different planning questions.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL provide an "All Jobs" view that lists all active Jobs, each expandable to show Paths and Process Steps with part counts.
2. THE SHOP_ERP SHALL provide an "By Assignee" view that groups work by the person assigned, showing each assignee's Jobs, the quantity they need to produce, and where parts go when they finish their step.
3. THE SHOP_ERP SHALL provide filters on all views that allow the user to narrow results by: Job name, Jira ticket key, Process Step name, assignee, priority, label, and status (active/completed).
4. WHEN a user applies a filter, THE SHOP_ERP SHALL update the view immediately to show only matching records.
5. THE SHOP_ERP SHALL allow combining multiple filters (e.g., assignee = "Mike" AND step = "Machining") to further narrow results.
6. THE SHOP_ERP SHALL persist the user's last-used view mode and filter selections so they are restored on next visit.

### Requirement 17: Process Step Notes and Defect Reporting

**User Story:** As a shop floor operator, I want to record notes, defects, and issues against specific serial numbers at a process step, so that problems are documented and can be pushed to Jira.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL allow a user to create a note on one or more Serial Numbers at a specific Process Step, with free-text content describing the issue.
2. THE SHOP_ERP SHALL store each note with: the Process Step, the affected Serial Number(s), the note text, the user who created it, and a timestamp.
3. WHEN a user creates a note on a Jira-linked Job, THE SHOP_ERP SHALL offer to push the note as a Jira comment formatted as: `{StepName} - {SN(s)}: {note text}`.
4. THE SHOP_ERP SHALL display all notes for a Serial Number in chronological order when viewing that Serial Number's detail.
5. THE SHOP_ERP SHALL display all notes for a Process Step when viewing the Operator View for that step.
6. THE SHOP_ERP SHALL record note creation in the Audit Trail.

## Correctness Properties (for Property-Based Testing)

### CP-1: Job Part Count Invariant
FOR ALL Jobs, the Job's total part count SHALL equal the sum of Serial Number counts across all Paths belonging to that Job. This invariant holds after any sequence of Serial Number creation, advancement, or deletion operations.

### CP-2: Serial Number Uniqueness
FOR ALL Serial Numbers in the system, no two Serial Numbers SHALL share the same identifier. This property holds after any sequence of batch creation operations.

### CP-3: Sequential Step Advancement
FOR ALL Serial Numbers, the current Process Step index SHALL be between 0 and the length of the Path's Process Step sequence minus 1 (inclusive). Advancing a Serial Number at step N always results in step N+1 or completion.

### CP-4: Process Step Count Conservation
FOR ALL Paths, the sum of Serial Numbers at each Process Step plus the count of completed Serial Numbers SHALL equal the total number of Serial Numbers created on that Path. No Serial Numbers are lost or duplicated during advancement.

### CP-5: Domain Object Round-Trip Serialization
FOR ALL valid Job, Path, Process Step, Serial Number, and Certificate objects, `deserialize(serialize(obj))` SHALL produce an object equivalent to `obj`. No data is lost or corrupted during serialization cycles.

### CP-6: Audit Trail Immutability and Completeness
FOR ALL Certificate attachment and Serial Number advancement operations, exactly one Audit Trail entry SHALL be created. The count of Audit Trail entries for a Serial Number SHALL equal the number of recorded operations performed on that Serial Number.

### CP-7: Progress Bar Accuracy
FOR ALL Jobs, the Progress Bar percentage SHALL equal `(completed Serial Number count / Goal Quantity) * 100`. This value can exceed 100 when completed count exceeds Goal Quantity.

### CP-8: Template Route Independence
FOR ALL Paths created from a Template Route, modifying the Path's Process Steps SHALL leave the original Template Route's Process Step sequence unchanged. `template_before == template_after` for any modification to a derived Path.

### CP-9: BOM Roll-Up Consistency
FOR ALL BOMs, the aggregated completed count for a part type SHALL equal the sum of completed counts from all contributing Jobs for that part type. The aggregated in-progress count SHALL equal the sum of in-progress counts from all contributing Jobs.

### CP-10: Batch Certificate Application Idempotence
FOR ALL batch Certificate attachment operations, applying the same Certificate to the same set of Serial Numbers a second time SHALL produce the same state as applying it once. The set of Certificates on each Serial Number remains unchanged after re-application.
