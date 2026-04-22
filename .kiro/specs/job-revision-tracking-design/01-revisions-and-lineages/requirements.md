# Requirements — Sub-Area 1: Revisions and Path Lineages

> Sub-area scope: part/job revision tagging, path lineage as a first-class entity, rev-up events, display rules.
> Out of sub-area scope: delivery milestones (sub-area 2), demand/supply reconciliation and step-1 operator UX (sub-area 3).

## Introduction

This sub-area introduces revision tracking to Shop Planr. Today, a job in progress that receives a revision change from a customer has no clean way to distinguish old-rev parts from new-rev parts — operators at step 1 don't know how many new-rev parts to produce, and planners can't track the two revs as a single logical job. This sub-area adds a job-owned rev catalog, a path lineage concept that groups paths representing the same physical workflow across revisions, and a Rev-Up event that either introduces a new rev to the catalog or propagates an existing rev to additional lineages.

The design is intentionally invisible in the common case. Single-rev jobs — the overwhelming majority — see no new UI, no new controls, and no new concepts. Every job receives a default rev (typically "A") at creation, every path belongs to a lineage from day one, and the rev infrastructure simply stays out of sight until a planner triggers a Rev-Up. At that point, rev pills, lineage groupings, and rev-specific cards become visible on the affected jobs and paths.

Revisions are treated as a property of the Job, not of a path. When a customer says "Rev B," they mean one conceptual revision; the system can express that Rev B via in-house production, outsourcing, or any other lineage, but "Rev B" remains one entry in the job's catalog. This framing eliminates ambiguity about whether in-house Rev B and outsource Rev B are "the same thing" — they are. The planner's Rev-Up action either introduces a new catalog entry (with optional path clones on affected lineages) or propagates an existing catalog entry to a lineage that hasn't caught up yet.

### Guiding Principles (apply to all sub-areas)

1. **No behind-your-back actions** — only nudges, reminders, warnings, and deliberate user actions.
2. **Progressive disclosure** — simple defaults; complexity revealed only when the situation warrants it (e.g., rev pills hidden on single-rev jobs).
3. **Informational tracker, not workflow engine** — the system reports state; humans drive action. Gating, where needed, lives at the routing-step level which already exists.

## Glossary

- **Revision / Rev** — *[free-form string, e.g. "A", "B", "1", "A02". Job-owned concept: a single rev value refers to one conceptual revision regardless of how many paths express it.]*
- **Rev Catalog** — *[`Job.revisions[]`, the authoritative list of revs that exist for a job; grows over time as new revs are introduced]*
- **Rev Tag** — *[the per-part label showing which catalog rev that part expresses]*
- **Path Lineage** — *[grouping container for paths representing the same physical workflow across revs]*
- **Path Rev (Path Revision)** — *[an individual Path within a lineage; today's `Path` entity, now associated with a specific rev from the catalog]*
- **Express a Rev** — *[a path is said to "express" a rev when its `revision` field references that catalog entry; paths receive revs, they do not own them]*
- **Rev-Up Event** — *[planner action that either introduces a new rev to the catalog or propagates an existing rev to additional lineages]*
- **Introduce Rev** — *[sub-type of Rev-Up: the typed rev value is not in the catalog → adds it and applies to selected lineages]*
- **Propagate Rev** — *[sub-type of Rev-Up: the typed rev value is already in the catalog → no catalog change, clones selected lineages to express that existing rev]*
- **Active Rev** — *[the latest rev in a lineage that has open in-progress work]*
- **Muted Rev** — *[a rev in a lineage with no remaining active parts and a successor rev in the same lineage]*
- **Lineage Grouping** — *[UI rendering of a multi-rev lineage as a container with rev sub-cards]*
- **Single-Rev Job** — *[job whose catalog has exactly one entry]*
- **Multi-Rev Job** — *[job whose catalog has two or more entries]*

## Requirements

### Requirement 1: Job-Owned Rev Catalog; Paths and Parts Reference It

**User Story:** As a planner, I want revisions to be a property of the Job (not of individual paths or parts), so that a rev value means the same thing across every lineage in the job and the same Rev B can be expressed by in-house, outsource, or any other lineage without ambiguity.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL maintain `Job.revisions[]` as the authoritative catalog of rev values for each Job.
2. WHEN a new Job is created, THE SHOP_ERP SHALL populate `Job.revisions[]` with exactly one entry, defaulting to "A" and overridable by the planner during creation.
3. THE SHOP_ERP SHALL allow rev values to be free-form strings of any non-empty length — letters, numbers, or combinations — with no format constraints.
4. WHEN a new rev value is added to a Job's catalog, THE SHOP_ERP SHALL reject the addition IF the value already exists in the same Job's catalog (case-sensitive comparison).
5. THE SHOP_ERP SHALL NOT enforce uniqueness of rev values across different Jobs — two Jobs may both have a "Rev A" independently.
6. WHEN a Path is created or updated with a `revision` value, THE SHOP_ERP SHALL require that value to exist in the parent Job's `revisions[]` catalog.
7. WHEN a Part is created, THE SHOP_ERP SHALL set its `revision` field to the revision of the Path it is being created on (inherited, not user-specified).
8. IF two Paths in different Lineages of the same Job both express the same rev value, THEN THE SHOP_ERP SHALL treat them as expressing the SAME catalog rev (one conceptual revision expressed in multiple workflows).

### Requirement 2: Path Lineage Always-Exists

**User Story:** As a developer, I want every path to belong to a path lineage from creation, so that the rev-up flow is a uniform "add a path to an existing lineage" operation rather than a special-case retroactive entity creation.

#### Acceptance Criteria

1. WHEN a new Path is created, THE SHOP_ERP SHALL atomically create a new PathLineage record and associate the Path with it via `path.lineage_id`.
2. THE SHOP_ERP SHALL enforce `path.lineage_id` as NOT NULL on all Paths.
3. THE SHOP_ERP SHALL set the new PathLineage's `name` to match the creating Path's name by default; the planner may edit either name independently post-creation.
4. THE SHOP_ERP SHALL scope a PathLineage to exactly one Job via `lineage.job_id`; this reference SHALL be immutable (a Lineage cannot be moved between Jobs).
5. WHEN a Path is cloned during a Rev-Up event, THE SHOP_ERP SHALL associate the clone with the source Path's existing Lineage (same `lineage_id`), not create a new Lineage.
6. IF a PathLineage's last remaining Path is deleted, THEN THE SHOP_ERP SHALL delete the PathLineage in the same transaction (cascade).

### Requirement 3: Single-Lineage-Single-Rev Path Creation Preserves Existing UX

**User Story:** As a planner creating a path on a job that has never been rev'd, I want the experience to be identical to today — same form, same fields, same job view rendering — so that the lineage concept adds no friction to the common case.

#### Acceptance Criteria

1. WHEN a planner opens the "Add Path" form on a Job with a single-entry catalog, THE SHOP_ERP SHALL display the same fields as today (name, steps, goal) with no rev selector and no lineage controls visible.
2. WHEN the planner submits the "Add Path" form, THE SHOP_ERP SHALL create a new PathLineage and one Path with `revision` set to the Job's current single catalog entry.
3. WHILE a Job has a single-entry catalog and each of its Lineages contains a single Path, THE SHOP_ERP SHALL render each Lineage as a single row on the Job detail view — no grouping container, no rev pill, no expand affordance.
4. WHEN the planner renames a Path on a Lineage that contains exactly one Path, THE SHOP_ERP SHALL update the parent PathLineage's name to match (one-to-one), and vice versa.
5. THE Add Path flow for single-rev Jobs SHALL require zero new clicks, zero new fields, and zero new visible concepts compared to pre-migration behavior.

### Requirement 4: Rev-Up Event with Work In Progress

**User Story:** As a planner, when a customer rev's a job mid-production and parts are already in flight, I want to clone affected paths so that the in-progress old-rev parts continue their original path while new-rev parts go through a fresh path.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL provide a "Rev Up Job" action on the Job detail view that opens the Rev-Up modal.
2. THE Rev-Up modal SHALL collect: a rev value (free-text input), a multi-select list of affected Lineages, and per-Lineage configuration controls (goal split inputs, scrap-in-progress checkbox).
3. WHEN a selected Lineage's latest Path has at least one non-scrapped Part, THE SHOP_ERP SHALL treat the Rev-Up for that Lineage as a "with-work" operation and clone the Lineage's latest Path as a new Path expressing the new rev value.
4. THE cloned Path SHALL start with zero Parts and fresh step definitions deep-cloned from the source Path (preserving step names, order, locations, assignments, optional flags, and dependency types).
5. THE SHOP_ERP SHALL default the source Path's new goal quantity to the count of its current non-scrapped Parts, allowing the planner to edit the value before submission.
6. THE SHOP_ERP SHALL default the clone Path's goal quantity to `max(0, original source goal − new source goal)`, allowing the planner to edit the value before submission.
7. THE SHOP_ERP SHALL NOT enforce any sum invariant between source and clone goals — the planner may set them to any non-negative integers regardless of the original Job goal.
8. IF the planner sets goal values that result in the sum exceeding the original goal or falling below committed milestone demand, THEN THE SHOP_ERP SHALL accept the values but display a reconciliation warning (see sub-area 3).

### Requirement 5: Rev-Up Event without Work In Progress

**User Story:** As a planner, when a rev change happens but no parts have been created yet, I want the rev change to behave like an edit (no path clone) so that the existing path simply updates and future parts inherit the new rev.

#### Acceptance Criteria

1. WHEN a selected Lineage's latest Path has zero Parts created, THE SHOP_ERP SHALL treat the Rev-Up for that Lineage as an "in-place" operation, updating the existing Path's `revision` field without cloning.
2. WHEN an in-place Rev-Up occurs, THE SHOP_ERP SHALL record a `path_revision_updated_in_place` audit entry with the before and after rev values.
3. THE SHOP_ERP SHALL display a visible rev-change event on the Job detail view (e.g., a dismissable banner or timeline entry) so operators and planners can see the change even though no path structure changed.
4. WHEN Parts are created on the updated Path after the in-place Rev-Up, THE SHOP_ERP SHALL assign them the new rev value.
5. IF a single Rev-Up operation affects multiple Lineages with a mix of with-work and without-work states, THEN THE SHOP_ERP SHALL apply the appropriate sub-type per Lineage within a single atomic transaction.

### Requirement 6: Rev-Up — Scrap-In-Progress Option

**User Story:** As a planner, when rev-ing up a path that has in-progress parts I no longer want to finish, I want a single checkbox to scrap them all so I don't have to scrap each part individually.

#### Acceptance Criteria

1. THE Rev-Up modal SHALL display a "Scrap all in-progress parts on the old rev" checkbox for each selected Lineage, defaulted to unchecked.
2. WHEN the checkbox is checked and the planner submits, THE SHOP_ERP SHALL scrap every non-completed non-scrapped Part on the source Path using the existing scrap mechanism, with `scrap_reason = 'process_defect'` and `scrap_explanation = "Revision change to [new rev value]"`.
3. THE SHOP_ERP SHALL record one `part_scrapped` audit entry per scrapped Part, with metadata linking it to the originating Rev-Up event ID.
4. WHEN the scrap-in-progress checkbox is checked, THE SHOP_ERP SHALL default the source Path's new goal quantity to zero (planner remains free to edit).
5. WHEN the scrap-in-progress checkbox is unchecked, THE SHOP_ERP SHALL leave all in-flight Parts on the source Path unchanged.
6. THE scrap-in-progress cascade SHALL be included in the Rev-Up transaction; any failure in the Rev-Up SHALL roll back all cascade scraps.
7. THE SHOP_ERP SHALL apply the scrap-in-progress option only to "with-work" Lineages; for "without-work" Lineages the checkbox SHALL be disabled in the modal (nothing to scrap).

### Requirement 7: Rev-Up — Multi-Lineage Selection

**User Story:** As a planner, when a rev change affects more than one workflow on a job (e.g., both in-house and outsource lineages), I want to select multiple lineages in a single Rev-Up modal so I don't have to repeat the operation.

#### Acceptance Criteria

1. THE Rev-Up modal SHALL list every PathLineage in the Job as a selectable checkbox, labeled with the Lineage name and its current latest rev.
2. THE modal SHALL require at least one Lineage to be selected before the planner can submit.
3. FOR each selected Lineage, THE modal SHALL expose per-Lineage controls: source goal input, clone goal input (hidden for without-work Lineages), and scrap-in-progress checkbox (hidden for without-work Lineages).
4. WHEN the planner submits, THE SHOP_ERP SHALL apply all per-Lineage changes within a single database transaction; any validation failure or error SHALL roll back the entire operation.
5. WHEN the Rev-Up operation succeeds, THE SHOP_ERP SHALL record exactly one `job_revision_changed` audit entry at the Job level plus one cascade entry per affected Lineage (`path_cloned_for_revision` for with-work, `path_revision_updated_in_place` for without-work).
6. THE modal SHALL allow mixing with-work and without-work Lineages within a single submission; the system handles the per-Lineage sub-type automatically.

### Requirement 8: Rev-Up — Introduce New Rev or Propagate Existing Rev

**User Story:** As a planner, I want one Rev-Up flow that handles both introducing a brand-new rev to the job and propagating an already-existing rev to a lineage that hasn't caught up yet (e.g., outsource lineage catching up to an in-house Rev B later), so I don't have to remember which button does which.

#### Acceptance Criteria

1. WHEN the planner submits the Rev-Up modal, THE SHOP_ERP SHALL classify the operation based on whether the typed rev value already exists in `Job.revisions[]`.
2. IF the rev value does NOT exist in `Job.revisions[]`, THEN THE SHOP_ERP SHALL perform an "Introduce" operation: add the value to the catalog and apply the downstream per-Lineage mechanics (see R4, R5, R6).
3. IF the rev value IS in `Job.revisions[]`, THEN THE SHOP_ERP SHALL perform a "Propagate" operation: leave `Job.revisions[]` unchanged and apply the downstream per-Lineage mechanics against the existing rev value.
4. IF a selected Lineage's latest Path already expresses the chosen rev value, THEN THE SHOP_ERP SHALL reject the operation for that Lineage with a validation error identifying the conflict (to prevent duplicate paths).
5. IF a Propagate operation targets a Lineage where the chosen rev was used historically but has since been succeeded by a newer rev, THEN THE SHOP_ERP SHALL reject the operation with a validation error — a Lineage cannot revert to an older rev via Rev-Up.
6. THE SHOP_ERP SHALL include an `operation_type` field (`introduce` or `propagate`) in the `job_revision_changed` audit entry metadata.
7. WHEN performing a sequential Rev-Up on a Lineage (e.g., A → B → C), THE SHOP_ERP SHALL always clone from the Lineage's latest Path by creation timestamp.

### Requirement 9: Rev Pill and Lineage Grouping Display Rules

**User Story:** As an operator, I want rev pills and lineage groupings to appear only when there's actually a multi-rev situation to track, so that single-rev jobs (the common case) stay visually clean.

#### Acceptance Criteria

1. WHILE a Job has exactly one entry in `Job.revisions[]`, THE SHOP_ERP SHALL suppress all rev pills on the Job, its Paths, and its Parts across every view.
2. WHILE a Job has two or more entries in `Job.revisions[]`, THE SHOP_ERP SHALL display a rev pill on every Path row and Part row showing that row's current rev value.
3. WHILE a PathLineage contains exactly one Path, THE SHOP_ERP SHALL render the Lineage as a single flat row on the Job detail view — no grouping container, no expand control.
4. WHILE a PathLineage contains two or more Paths, THE SHOP_ERP SHALL render the Lineage as a grouped container with expandable per-rev sub-cards.
5. THE rev pill visual style SHALL be distinct from the existing tag pill UI (specifics defined in the design doc).
6. THE SHOP_ERP SHALL apply identical visibility rules on Jobs list, Job detail, Parts browser, Part detail, and Work Queue views.
7. THE Rev-Up action button SHALL be visible on all Jobs regardless of current catalog size — the action is the mechanism that creates the multi-rev state, so it must be reachable before the state exists.

### Requirement 10: Muted Rev Behavior and Display

**User Story:** As an operator, I want older revs whose work is finished to fade into the background, so my view stays focused on actionable current work without losing access to history.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL compute a Path's "muted" state on read as: `(zero non-completed non-scrapped Parts on the Path) AND (a later Path exists in the same Lineage by creation timestamp)`.
2. THE SHOP_ERP SHALL NOT persist the muted flag — it is always derived, never stored.
3. WHILE a Path is muted, THE SHOP_ERP SHALL render it with dimmed visual treatment and collapse it by default within the Lineage grouping.
4. WHEN a user clicks a muted Path, THE SHOP_ERP SHALL expand it to show its Parts, steps, and audit history.
5. IF a previously-completed Part on a muted Path returns to in-progress status (edge case — e.g., via a future lifecycle operation that reverses completion), THEN THE SHOP_ERP SHALL automatically un-mute the Path on the next read.
6. THE most recent Path in a Lineage (by creation timestamp) SHALL never be muted, regardless of its Part counts.

### Requirement 11: Lineage Naming and Renaming

**User Story:** As a planner, I want to rename a lineage in one place and have all rev cards inside it reflect the new name, so I don't have to manage multiple path-name strings.

#### Acceptance Criteria

1. THE PathLineage SHALL expose a `name` field that is the user-visible identifier for the Lineage across all views.
2. WHILE a Lineage contains exactly one Path, THE SHOP_ERP SHALL keep the Path's name and the Lineage's name synchronized — renaming either updates both.
3. WHILE a Lineage contains two or more Paths, THE SHOP_ERP SHALL expose renaming at the Lineage level only; individual Path names SHALL NOT be renamed independently in the UI (they display under the Lineage name with a rev pill).
4. THE SHOP_ERP SHALL NOT automatically append any "[Rev X]" suffix to Lineage or Path names — rev labels are rendered as separate visual elements, not baked into name strings.
5. THE rename control SHALL be editable inline on the Job detail view, gated by the same admin permission as the existing path-edit flow.
6. WHEN a Lineage is renamed, THE SHOP_ERP SHALL record a `lineage_renamed` audit entry capturing before/after name values and the user identity.

### Requirement 12: Audit Trail for Rev Events

**User Story:** As a quality engineer, I want every rev-up event and downstream cascade (path clone, scrap-in-progress) recorded in the audit trail with full detail, so I can reconstruct what changed and when.

#### Acceptance Criteria

1. THE SHOP_ERP SHALL extend the `AuditAction` union with the following new action types: `job_revision_changed`, `path_cloned_for_revision`, `path_revision_updated_in_place`, `lineage_renamed`.
2. WHEN a Rev-Up event is executed, THE SHOP_ERP SHALL record exactly one `job_revision_changed` entry at the Job level with metadata including: operation type (`introduce` or `propagate`), new rev value, list of affected Lineage IDs.
3. FOR each affected Lineage in a Rev-Up, THE SHOP_ERP SHALL record exactly one cascade entry — `path_cloned_for_revision` for with-work Lineages or `path_revision_updated_in_place` for without-work Lineages.
4. WHEN the scrap-in-progress option is used, THE SHOP_ERP SHALL record existing `part_scrapped` entries for each scrapped Part, with metadata linking back to the `job_revision_changed` event ID for traceability.
5. THE SHOP_ERP SHALL include in each Rev-Up-related audit entry: user ID, timestamp, Job ID, Lineage ID (where applicable), source Path ID (where applicable), clone Path ID (where applicable), and before/after rev values.
6. THE SHOP_ERP SHALL expose all new action types in the existing Audit Trail viewer filter controls.

### Requirement 13: Backwards Compatibility and Migration

**User Story:** As a developer, I want the migration to introduce revisions and lineages without breaking any existing data or behavior, so that all existing jobs render identically until a planner takes a deliberate rev-up action.

#### Acceptance Criteria

1. THE migration SHALL create the `path_lineages` table with columns: `id` (text, PK), `job_id` (text, FK to jobs, NOT NULL), `name` (text, NOT NULL), `created_at` (text, NOT NULL), `updated_at` (text, NOT NULL).
2. FOR each existing Path in the database, THE migration SHALL create a corresponding PathLineage with `name = path.name` and `job_id = path.job_id`, then set `path.lineage_id` to the new Lineage's ID.
3. THE migration SHALL add `jobs.revisions` as a TEXT column storing a JSON array, defaulting to `["A"]` for existing Jobs.
4. THE migration SHALL add `paths.revision` as a TEXT column, defaulting to `"A"` for existing Paths.
5. THE migration SHALL add `parts.revision` as a TEXT column, defaulting to `"A"` for existing Parts.
6. THE migration SHALL enforce `paths.lineage_id` as NOT NULL after backfill completes.
7. THE migration SHALL run as a single transaction; any failure SHALL roll back the entire migration and leave the database in its pre-migration state.
8. WHEN all existing data is migrated, THE SHOP_ERP SHALL render every pre-existing Job, Path, and Part identically to its pre-migration appearance — no rev pills, no lineage grouping — because every such Job has a single-entry catalog.

## Correctness Properties (for property-based testing)

- **CP-1: Universal rev tag** — every Part has a non-empty revision; every Job has a non-empty revision; every Path has a non-empty revision.
- **CP-2: Lineage membership** — every Path belongs to exactly one PathLineage; every PathLineage belongs to exactly one Job.
- **CP-3: Rev inheritance at creation** — a Part's revision equals the (lineage's path's) revision active at the moment of part creation.
- **CP-4: Rev pill visibility rule** — the rev pill is shown on a Job's children iff the Job has >1 distinct revision in its `revisions[]` array.
- **CP-5: Single-rev UI parity** — for any single-rev Job, the Job detail view renders zero rev-related visual elements (no pills, no grouping, no rev-up affordances beyond the "Rev Up Job" action).
- **CP-6: Lineage rev uniqueness** — within a single PathLineage, no two Paths have the same revision value. (Across lineages, the same rev value may appear freely — it's one catalog rev expressed in multiple lineages.)
- **CP-7: Rev-up clones latest** — a Rev-Up on a lineage always clones from the lineage's latest rev (highest creation timestamp), never from an older one.
- **CP-8: Muted-rev computation** — a rev is muted iff (zero in-progress parts on its path) AND (a later rev exists in the same lineage). No manual state.
- **CP-9: Scrap-in-progress completeness** — when the scrap-in-progress option is checked, every non-completed non-scrapped part on the source path is scrapped exactly once with the rev-up explanation.
- **CP-10: Audit completeness** — every rev-up event produces exactly one `job_revision_changed` entry plus one cascade entry per affected lineage; no rev change occurs without an audit entry.

## Open Questions / Deferred to Design Doc

- **Modal layout**: single modal with collapsible per-Lineage sections (my lean) vs multi-step wizard. Settle in design doc once wireframed.
- **Lineage delete cascade when multi-rev**: today a Path with Parts cannot be deleted; when a Lineage has two or more Paths, should we allow deleting the Lineage as a whole (with admin override)? Related to existing admin-path-delete behavior — likely the answer is "delete each Path individually via existing flow; no new Lineage-level delete."

### Resolved During Requirements Discussion

- **Revs are job-owned** (not path-owned). A rev value means the same thing across all lineages in a job; a path expresses one of the job's catalog revs. Captured in R1 and R8.
