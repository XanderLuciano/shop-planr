# Requirements — Sub-Area 2: Delivery Milestones

> Sub-area scope: job-level delivery milestones (quantity + due date), optional rev breakdown, FIFO fill behavior, milestone review prompt at rev-up, optional job-wide due date.
> Out of sub-area scope: revision tagging and path lineages (sub-area 1), demand/supply reconciliation prompts and step-1 operator UX (sub-area 3).

## Introduction

*[TODO: 2-3 paragraph framing. Why milestones exist (customer wants quantity X by date D, often staggered), how they differ from path goals (commitments vs production targets), how they interact with revs (sometimes mix matters, sometimes total only). Note: milestones are a counter, not a workflow gate.]*

### Guiding Principles (apply to all sub-areas)

1. **No behind-your-back actions** — only nudges, reminders, warnings, and deliberate user actions.
2. **Progressive disclosure** — simple defaults; complexity revealed only when warranted (rev breakdown hidden unless opted in).
3. **Informational tracker, not workflow engine** — milestones report state ("can we deliver N by D?"); they do not gate shipments or require sign-off.

## Glossary

*[TODO: define each term used below.]*

- **Delivery Milestone (Milestone)** — *[a job-level commitment of "deliver N parts by date D"]*
- **Total Mode** — *[milestone with quantity + due date only; any rev counts]*
- **Breakdown Mode** — *[milestone with optional per-rev quantities; sum must equal total]*
- **Rev Breakdown** — *[the per-rev quantity map, e.g. `{A: 6, B: 4}`]*
- **FIFO Fill** — *[rule for assigning completed parts to milestones in due-date order]*
- **Per-Rev FIFO** — *[FIFO scoped to a specific rev when in breakdown mode]*
- **Overflow** — *[completed parts beyond a milestone's quantity rolling forward to the next milestone or job total]*
- **Milestone Met** — *[total mode: completed count ≥ quantity; breakdown mode: each rev's count ≥ its sub-target]*
- **Job Due Date** — *[optional job-wide deadline, same informational philosophy as milestones]*
- **Milestone Review Prompt** — *[skippable proactive prompt at rev-up asking planner to revisit open milestones]*

## Requirements

### Requirement 1: Job-Level Delivery Milestone Entity

**User Story:** As a planner, I want to attach delivery milestones to a job (not to a path), so that I can track customer commitments that span all production paths in the job.

#### Acceptance Criteria
*[TODO: WHEN/THEN bullets covering:
- Milestone belongs to exactly one Job
- Required fields: quantity (integer > 0), due date (ISO date)
- Optional fields: name/label, rev breakdown
- A job can have zero or many milestones
- Milestones are user-created; never auto-generated]*

### Requirement 2: Total Mode (Default)

**User Story:** As a planner, I want to enter a milestone with just a quantity and a due date, so that the simplest case requires zero extra decisions.

#### Acceptance Criteria
*[TODO:
- Default form: quantity input + due date picker, no rev breakdown visible
- Submit creates a "Total Mode" milestone (no breakdown set)
- Total Mode question: "Have we made N parts by D, regardless of rev?"
- Any completed part (any rev) counts toward this milestone in FIFO order]*

### Requirement 3: Breakdown Mode (Opt-In)

**User Story:** As a planner, when a customer needs a specific mix of revisions for assembly or matched-set delivery, I want to specify per-rev quantities so the system tracks each rev independently.

#### Acceptance Criteria
*[TODO:
- Breakdown only available on multi-rev jobs (rev pill rule from sub-area 1 R9)
- Toggle "Specify rev breakdown" reveals per-rev quantity inputs (one per rev in `Job.revisions[]`)
- Sum of breakdown values must equal total quantity (validation)
- Rev values come from the Job's `revisions[]` array (sub-area 1 R1)
- Submit creates a "Breakdown Mode" milestone
- Breakdown Mode question: "Have we made N1 of Rev A AND N2 of Rev B by D?"]*

### Requirement 4: FIFO Fill — Total Mode

**User Story:** As an operator/manager, I want completed parts to automatically count toward the earliest-due open milestone, so I don't have to manually assign parts to milestones.

#### Acceptance Criteria
*[TODO:
- Fill order: by due date ascending; ties broken by milestone creation timestamp
- A completed part fills the next open Total-Mode milestone with remaining capacity
- Scrapped parts never fill milestones (per sub-area 1 rules)
- Force-completed parts count as completed for fill purposes
- Re-computation triggers: part status change to/from completed; milestone added/edited/deleted]*

### Requirement 5: FIFO Fill — Breakdown Mode (Per-Rev)

**User Story:** As an operator/manager, I want a Rev A completion to fill the next open Rev A slot (across milestones), and same for Rev B, so that breakdown-mode milestones honor the customer's mix requirement.

#### Acceptance Criteria
*[TODO:
- Per-rev FIFO: a completion of rev R fills the next open milestone with remaining R-capacity
- Order: due date ascending, ties by creation timestamp
- A Total-Mode milestone in the same FIFO queue counts as "any rev"; a Rev A completion can fill it if no Breakdown-Mode milestone has open Rev A capacity earlier in the queue
- A Breakdown-Mode milestone is "met" only when EVERY rev in its breakdown reaches its sub-target
- Excess completions of one rev do not satisfy a breakdown-mode milestone's other-rev shortfall]*

### Requirement 6: Overflow Behavior

**User Story:** As a planner, when production exceeds a milestone's quantity ahead of its due date, I want the extras to roll forward to the next milestone (or just count toward job total) rather than being lost.

#### Acceptance Criteria
*[TODO:
- Overflow rolls to the next milestone in FIFO order (per-rev when in breakdown mode)
- Overflow beyond all milestones counts toward job total (existing job progress)
- Overflow is purely a counter behavior — no UI action required from the planner
- "Early" indicator on overflow contributions to next milestone (e.g., "3 of these 10 are early")]*

### Requirement 7: Mode Transition (Add/Remove/Edit Breakdown)

**User Story:** As a planner, when customer requirements change mid-job (e.g., they relax or tighten the rev mix), I want to add, remove, or edit a milestone's breakdown without recreating the milestone.

#### Acceptance Criteria
*[TODO:
- Edit milestone form: change quantity, due date, add/remove breakdown, edit per-rev values
- Adding a breakdown: validates sum = quantity
- Removing a breakdown: milestone reverts to Total Mode; existing completions re-counted as a single bucket
- Editing per-rev values: re-evaluates fill against current part counts
- Mode transitions never lose progress — they re-bucket existing fills against the new shape]*

### Requirement 8: Milestone Review Prompt at Rev-Up

**User Story:** As a planner, when I rev-up a job, I want a proactive but skippable prompt that lists open milestones, so I can decide whether each one needs a rev breakdown without forgetting it later.

#### Acceptance Criteria
*[TODO:
- Triggered at end of Rev-Up flow (sub-area 1 R4-R7)
- Modal lists all open milestones (not yet met) for the job
- For each: shows current quantity, due date, current mode, suggested breakdown (pre-filled based on planner-supplied or computed defaults)
- Planner can: accept suggested breakdown, customize, leave as Total Mode, or skip entire prompt
- Skip-all option is one click
- Skipped milestones get a "needs review" pill on the job detail page until acknowledged]*

### Requirement 9: Job Due Date (Optional)

**User Story:** As a planner, I want to optionally set a due date on the entire job for high-priority work, so the dashboard can answer "can we deliver the full job by D?" the same way it does for milestones.

#### Acceptance Criteria
*[TODO:
- New optional `Job.dueDate` field
- Editable inline on job detail page; null by default
- No validation against milestone due dates (planner's responsibility — system surfaces conflicts as warnings, not errors)
- Job due date displays alongside priority on the jobs list and dashboard
- Same informational philosophy as milestones — no gating, no sign-off]*

### Requirement 10: Milestone Display

**User Story:** As an operator and as a planner, I want to see milestone status at a glance on the job detail page, so I know what's coming up and whether we're on track.

#### Acceptance Criteria
*[TODO:
- Milestones rendered in a dedicated section on the Job detail page, ordered by due date
- Each milestone shows: name (if any), quantity, due date, current fill (X of N), per-rev fill if breakdown mode
- Visual state: not started / in progress / met / overdue (computed from current date + fill state)
- Met milestones can collapse but remain visible
- Aggregated milestone roll-up appears on the BOM view across contributing jobs (existing BOM mechanism extended)]*

### Requirement 11: Audit Trail for Milestones

**User Story:** As a quality engineer, I want every milestone create / edit / delete recorded so I can trace customer commitment changes over time.

#### Acceptance Criteria
*[TODO:
- New audit action types: `milestone_created`, `milestone_updated`, `milestone_deleted`, `milestone_breakdown_set`, `milestone_breakdown_cleared`, `job_due_date_set`, `job_due_date_cleared`
- Each entry captures: user, timestamp, milestone ID, before/after snapshot of changed fields
- Milestone fill events are NOT audited individually (they're computed; no state change to log)]*

### Requirement 12: Backwards Compatibility

**User Story:** As a developer, I want the milestones feature to be additive only, so all existing jobs render identically and no existing tests break.

#### Acceptance Criteria
*[TODO:
- Migration adds `milestones` table and `jobs.due_date` column (nullable)
- All existing jobs have zero milestones and null due date
- Existing job detail page renders identically when there are zero milestones (no empty section, no placeholder)
- Existing BOM view unchanged for jobs without milestones]*

## Correctness Properties (for property-based testing)

*[TODO:]*

- **CP-1: Total Mode satisfaction** — a Total-Mode milestone is met iff `(sum of completed non-scrapped part counts assigned via FIFO) ≥ quantity`.
- **CP-2: Breakdown Mode satisfaction** — a Breakdown-Mode milestone is met iff for every rev R in its breakdown, `(per-rev completed count assigned via per-rev FIFO) ≥ breakdown[R]`.
- **CP-3: Breakdown sum invariant** — for any Breakdown-Mode milestone, `sum(breakdown.values()) == quantity` always holds (enforced at write).
- **CP-4: FIFO determinism** — the assignment of completed parts to milestones is fully determined by (due date asc, creation timestamp asc) ordering; no randomness.
- **CP-5: Scrap exclusion** — scrapped parts contribute to no milestone fill in any mode.
- **CP-6: Overflow forward-only** — overflow from milestone N can only fill milestones N+1, N+2, ...; never milestone N-1 or earlier.
- **CP-7: Mode transition preserves count** — adding, removing, or editing a breakdown does not change which parts are counted as "completed" for the milestone; only how they bucket.
- **CP-8: No silent goal coupling** — creating, editing, or deleting a milestone never modifies any path goal automatically (couples to sub-area 3 reconciliation).
- **CP-9: Audit completeness** — every milestone create/update/delete and job-due-date change produces exactly one audit entry.

## Open Questions / Deferred to Design Doc

*[TODO:]*

- *[Placeholder: should milestone names be required or optional? My lean: optional, with auto-name "Milestone 1, 2, 3..." if blank.]*
- *[Placeholder: when a Rev gets fully retired (all its parts complete + lineage muted), what happens to its line items in open Breakdown-Mode milestones? Drop, leave with red shortfall warning, or convert to Total Mode? My lean: leave with shortfall warning; planner decides.]*
- *[Placeholder: BOM aggregation — should milestones from contributing jobs aggregate by date (showing "delivery this week from 3 jobs") or by job? Likely a design detail, but flagging here.]*
