# Requirements — Sub-Area 1: Revisions and Path Lineages

> Sub-area scope: part/job revision tagging, path lineage as a first-class entity, rev-up events, display rules.
> Out of sub-area scope: delivery milestones (sub-area 2), demand/supply reconciliation and step-1 operator UX (sub-area 3).

## Introduction

*[TODO: 2-3 paragraph framing of the sub-area. Why these capabilities exist, what shop problem they solve, how they hang together.]*

### Guiding Principles (apply to all sub-areas)

1. **No behind-your-back actions** — only nudges, reminders, warnings, and deliberate user actions.
2. **Progressive disclosure** — simple defaults; complexity revealed only when the situation warrants it (e.g., rev pills hidden on single-rev jobs).
3. **Informational tracker, not workflow engine** — the system reports state; humans drive action. Gating, where needed, lives at the routing-step level which already exists.

## Glossary

*[TODO: define each term used below.]*

- **Revision / Rev** — *[free-form string, e.g. "A", "B", "1", "A02"]*
- **Rev Tag** — *[the per-part label]*
- **Job Revision** — *[the job's current revision pointer]*
- **Path Lineage** — *[grouping container for paths representing the same physical workflow across revs]*
- **Path Rev** — *[an individual Path within a lineage; today's `Path` entity, now associated with a specific rev]*
- **Rev-Up Event** — *[planner action that introduces a new revision for a job]*
- **Active Rev** — *[the latest rev in a lineage that has open in-progress work]*
- **Muted Rev** — *[an older rev in a lineage with no remaining active parts and a successor rev]*
- **Lineage Grouping** — *[UI rendering of a multi-rev lineage as a container with rev sub-cards]*
- **Single-Rev Job** — *[job with only one distinct rev across its lineages]*
- **Multi-Rev Job** — *[job with two or more distinct revs across one or more lineages]*

## Requirements

### Requirement 1: Revision Tagging on Parts and Jobs

**User Story:** As a planner, I want every part to carry a revision tag inherited from its job, so that even single-rev jobs are forward-compatible with future rev changes without backfilling data.

#### Acceptance Criteria
*[TODO: WHEN/THEN bullets covering:
- Part inherits Job's current revision at creation time
- Job has a revision field, default "A", free-form string (no constraints)
- Job has a `revisions[]` array tracking all revs introduced over time
- Revision values are unique within a job's history (no rev "A" twice)]*

### Requirement 2: Path Lineage Always-Exists

**User Story:** As a developer, I want every path to belong to a path lineage from creation, so that the rev-up flow is a uniform "add a path to an existing lineage" operation rather than a special-case retroactive entity creation.

#### Acceptance Criteria
*[TODO:
- New paths auto-create a lineage at creation (lineage of one rev)
- `paths.lineage_id` is NOT NULL
- Lineage has a name (defaults to path name on creation)
- A lineage belongs to exactly one job; cannot be moved between jobs]*

### Requirement 3: Single-Lineage-Single-Rev Path Creation Preserves Existing UX

**User Story:** As a planner creating a path on a job that has never been rev'd, I want the experience to be identical to today — same form, same fields, same job view rendering — so that the lineage concept adds no friction to the common case.

#### Acceptance Criteria
*[TODO:
- "Add Path" form: identical fields (name, steps, goal); no rev or lineage controls visible
- Submit creates lineage + one Path with `revision = (Job's current rev)`
- Job view renders the lineage as a single path row (no grouping container, no rev pill)
- Renaming the path renames the lineage (one-to-one in this state)]*

### Requirement 4: Rev-Up Event with Work In Progress

**User Story:** As a planner, when a customer rev's a job mid-production and parts are already in flight, I want to clone affected paths so that the in-progress old-rev parts continue their original path while new-rev parts go through a fresh path.

#### Acceptance Criteria
*[TODO:
- Planner triggers Rev-Up; modal collects new rev value, lineage selection, per-lineage goal split, scrap-in-progress option
- For each selected lineage: clone latest path (new path same lineage, new revision value, fresh step definitions, zero parts)
- Source path goal is reduced (default = current non-scrapped part count, planner-editable)
- Clone path goal is set (default = original goal − source goal, planner-editable)
- Goals are planner-editable; system does not enforce sum invariants]*

### Requirement 5: Rev-Up Event without Work In Progress

**User Story:** As a planner, when a rev change happens but no parts have been created yet, I want the rev change to behave like an edit (no path clone) so that the existing path simply updates and future parts inherit the new rev.

#### Acceptance Criteria
*[TODO:
- For affected lineages with zero parts on their current path: update the path's revision in place (no clone)
- Job revision updates to new value
- Future parts created on this path inherit the new rev
- Surface the rev change as an event (banner / audit entry) so users see it happened, even though no path structure changed]*

### Requirement 6: Rev-Up — Scrap-In-Progress Option

**User Story:** As a planner, when rev-ing up a path that has in-progress parts I no longer want to finish, I want a single checkbox to scrap them all so I don't have to scrap each part individually.

#### Acceptance Criteria
*[TODO:
- Per-lineage checkbox in Rev-Up modal: "Scrap all in-progress parts on the old rev"
- Default off
- When checked: all non-completed non-scrapped parts on the source path are scrapped with reason `process_defect` and explanation "Revision change to [new rev]"
- Records one audit entry per scrapped part plus the rev-up event
- Source path goal default updates to 0 when this option is checked (planner-editable)]*

### Requirement 7: Rev-Up — Multi-Lineage Selection

**User Story:** As a planner, when a rev change affects more than one workflow on a job (e.g., both in-house and outsource lineages), I want to select multiple lineages in a single Rev-Up modal so I don't have to repeat the operation.

#### Acceptance Criteria
*[TODO:
- Rev-Up modal lists all active lineages for the job as checkboxes
- Planner selects one or more lineages
- Each selected lineage independently follows the with-work / without-work flow (Req 4 / Req 5)
- Per-lineage goal split and scrap-in-progress option configurable independently
- Submit applies all changes atomically; rollback on any error]*

### Requirement 8: Sequential Rev-Ups within a Lineage

**User Story:** As a planner, when a lineage has already been rev'd from A to B, I want a subsequent rev-up (B to C) to clone from the most recent rev (B), so that the new C path takes over from where B left off.

#### Acceptance Criteria
*[TODO:
- Rev-Up always clones from the latest rev in the lineage
- Older revs in the lineage are not affected by a new rev-up
- A lineage can accumulate any number of revs over time
- Rev value validation: new rev cannot duplicate any existing rev already used in the lineage]*

### Requirement 9: Rev Pill and Lineage Grouping Display Rules

**User Story:** As an operator, I want rev pills and lineage groupings to appear only when there's actually a multi-rev situation to track, so that single-rev jobs (the common case) stay visually clean.

#### Acceptance Criteria
*[TODO:
- Rev pill shown on Job, Path, and Part rows ONLY when the job has >1 distinct revision
- Single-rev job: no rev pill anywhere; lineage renders as a flat path row
- Multi-rev job: lineage renders as a grouped container with rev sub-cards inside; each part shows its rev pill
- Pill color/styling distinct from existing tag UI (specifics in design doc)]*

### Requirement 10: Muted Rev Behavior and Display

**User Story:** As an operator, I want older revs whose work is finished to fade into the background, so my view stays focused on actionable current work without losing access to history.

#### Acceptance Criteria
*[TODO:
- A rev (i.e., a Path within a lineage) is "muted" when (a) it has zero in-progress parts AND (b) a later rev exists in the same lineage
- Muted state is computed, not stored or manually set
- Muted revs render dimmed and collapsed within the lineage container
- Muted revs remain expandable on click for history/audit
- A muted rev becomes un-muted automatically if a previously-completed part somehow returns to in-progress (edge case)]*

### Requirement 11: Lineage Naming and Renaming

**User Story:** As a planner, I want to rename a lineage in one place and have all rev cards inside it reflect the new name, so I don't have to manage multiple path-name strings.

#### Acceptance Criteria
*[TODO:
- Lineage name is the user-visible name; all paths in the lineage display under it
- Single-rev lineage: renaming the path renames the lineage (one-to-one)
- Multi-rev lineage: rename is on the lineage container; rev cards inherit the display
- No "Rev X" suffix appended to lineage or path names automatically — the rev label is rendered as a separate visual element
- Rename is editable inline on the Job detail view (admin-gated, consistent with existing path-edit permissions)]*

### Requirement 12: Audit Trail for Rev Events

**User Story:** As a quality engineer, I want every rev-up event and downstream cascade (path clone, scrap-in-progress) recorded in the audit trail with full detail, so I can reconstruct what changed and when.

#### Acceptance Criteria
*[TODO:
- New audit action types: `job_revision_changed`, `path_cloned_for_revision`, `path_revision_updated_in_place`, `lineage_renamed`
- Each rev-up records `job_revision_changed` once at job level + per-lineage cascade entries
- Scrap-in-progress events record existing `part_scrapped` action with metadata flagging "rev-up cascade"
- Audit entries link to the source rev-up event for traceability]*

### Requirement 13: Backwards Compatibility and Migration

**User Story:** As a developer, I want the migration to introduce revisions and lineages without breaking any existing data or behavior, so that all existing jobs render identically until a planner takes a deliberate rev-up action.

#### Acceptance Criteria
*[TODO:
- Migration adds `path_lineages` table; for each existing path, creates a lineage with `name = path.name`, sets `path.lineage_id`, sets `path.revision = "A"`
- Migration adds `jobs.revision` column default "A", `jobs.revisions` JSON column default `["A"]`
- Migration adds `parts.revision` column; for each existing part, sets `revision = (its job's revision)` = "A"
- All existing UI renders identically post-migration (single-rev = no pills, no grouping)
- Migration is forward-only and runs in a single transaction]*

## Correctness Properties (for property-based testing)

*[TODO: bullet list of invariants. Candidates:]*

- **CP-1: Universal rev tag** — every Part has a non-empty revision; every Job has a non-empty revision; every Path has a non-empty revision.
- **CP-2: Lineage membership** — every Path belongs to exactly one PathLineage; every PathLineage belongs to exactly one Job.
- **CP-3: Rev inheritance at creation** — a Part's revision equals the (lineage's path's) revision active at the moment of part creation.
- **CP-4: Rev pill visibility rule** — the rev pill is shown on a Job's children iff the Job has >1 distinct revision in its `revisions[]` array.
- **CP-5: Single-rev UI parity** — for any single-rev Job, the Job detail view renders zero rev-related visual elements (no pills, no grouping, no rev-up affordances beyond the "Rev Up Job" action).
- **CP-6: Lineage rev uniqueness** — within a single PathLineage, no two Paths have the same revision value.
- **CP-7: Rev-up clones latest** — a Rev-Up on a lineage always clones from the lineage's latest rev (highest creation timestamp), never from an older one.
- **CP-8: Muted-rev computation** — a rev is muted iff (zero in-progress parts on its path) AND (a later rev exists in the same lineage). No manual state.
- **CP-9: Scrap-in-progress completeness** — when the scrap-in-progress option is checked, every non-completed non-scrapped part on the source path is scrapped exactly once with the rev-up explanation.
- **CP-10: Audit completeness** — every rev-up event produces exactly one `job_revision_changed` entry plus one cascade entry per affected lineage; no rev change occurs without an audit entry.

## Open Questions / Deferred to Design Doc

*[TODO: items that surfaced during requirements drafting that need to be answered in the design doc, not the requirements doc.]*

- *[Placeholder: confirm modal layout — single modal with collapsible sections vs multi-step wizard.]*
- *[Placeholder: lineage delete cascade behavior when multi-rev.]*
- *[Placeholder: behavior when planner enters a rev value that was used in a different lineage of the same job (allowed or blocked?).]*
