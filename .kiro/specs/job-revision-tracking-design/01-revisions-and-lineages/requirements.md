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
*[TODO: WHEN/THEN bullets covering:
- `Job.revisions[]` is the authoritative catalog; every rev value used anywhere in the job must appear here
- Catalog starts with one entry ("A" by default) at job creation; planner can override the initial value
- Rev values are free-form strings; uniqueness enforced only within a single job's catalog (no duplicate catalog entries)
- A path's `revision` field references one entry in its job's catalog (FK-like semantics, enforced at write)
- A part inherits its path's revision at creation; parts do not independently choose a rev
- Paths receive revs; they do not own them — two paths in different lineages can express the same catalog rev (e.g. in-house Rev B and outsource Rev B are the SAME Rev B)]*

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

### Requirement 8: Rev-Up — Introduce New Rev or Propagate Existing Rev

**User Story:** As a planner, I want one Rev-Up flow that handles both introducing a brand-new rev to the job and propagating an already-existing rev to a lineage that hasn't caught up yet (e.g., outsource lineage catching up to an in-house Rev B later), so I don't have to remember which button does which.

#### Acceptance Criteria
*[TODO:
- Rev-Up modal: planner types a rev value
- System classifies automatically: if value is NOT in `Job.revisions[]` → Introduce (adds to catalog, applies to selected lineages); if value IS in catalog → Propagate (no catalog change, clones selected lineages to express the existing rev)
- Both sub-types follow the same downstream mechanics: per-lineage clone-with-goal-split, scrap-in-progress option, milestone review prompt
- Introduce validation: new rev value must not already be in catalog (detected = propagation instead)
- Propagate validation: target lineage must not already express the chosen rev (would produce duplicate path in same lineage — blocked)
- Sequential rev-ups within a lineage always clone from the latest rev in that lineage
- Audit trail distinguishes introduce vs propagate in metadata]*

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
- **CP-6: Lineage rev uniqueness** — within a single PathLineage, no two Paths have the same revision value. (Across lineages, the same rev value may appear freely — it's one catalog rev expressed in multiple lineages.)
- **CP-7: Rev-up clones latest** — a Rev-Up on a lineage always clones from the lineage's latest rev (highest creation timestamp), never from an older one.
- **CP-8: Muted-rev computation** — a rev is muted iff (zero in-progress parts on its path) AND (a later rev exists in the same lineage). No manual state.
- **CP-9: Scrap-in-progress completeness** — when the scrap-in-progress option is checked, every non-completed non-scrapped part on the source path is scrapped exactly once with the rev-up explanation.
- **CP-10: Audit completeness** — every rev-up event produces exactly one `job_revision_changed` entry plus one cascade entry per affected lineage; no rev change occurs without an audit entry.

## Open Questions / Deferred to Design Doc

*[TODO: items that surfaced during requirements drafting that need to be answered in the design doc, not the requirements doc.]*

- *[Placeholder: confirm modal layout — single modal with collapsible sections vs multi-step wizard.]*
- *[Placeholder: lineage delete cascade behavior when multi-rev.]*

### Resolved During Requirements Discussion

- **Revs are job-owned** (not path-owned). A rev value means the same thing across all lineages in a job; a path expresses one of the job's catalog revs. Captured in R1 and R8.
