# Requirements — Sub-Area 3: Reconciliation and Step 1 Operator UX

> Sub-area scope: demand-vs-supply reconciliation between milestones and path goals, one-click reconcile prompts, multi-rev step 1 operator creation cards, single-rev step 1 UX preservation.
> Out of sub-area scope: revision tagging and path lineages (sub-area 1), milestone definition and FIFO fill (sub-area 2).

## Introduction

*[TODO: 2-3 paragraph framing. Why reconciliation exists (milestones describe demand, path goals describe production capacity, the two can drift apart and operators won't know to make more parts unless path goals reflect reality). Why we don't auto-sync (the "no behind-your-back actions" principle). How the step 1 UX uses path goals to decide what to show operators.]*

### Guiding Principles (apply to all sub-areas)

1. **No behind-your-back actions** — only nudges, reminders, warnings, and deliberate user actions. **Reconciliation is the canonical example: every prompt is one-click but never automatic.**
2. **Progressive disclosure** — single-rev jobs see no reconciliation UI at all (there's nothing to reconcile); only multi-rev jobs surface the gauge and prompts.
3. **Informational tracker, not workflow engine** — reconciliation prompts are nudges, not blockers; planner can always proceed without resolving them.

## Glossary

*[TODO:]*

- **Demand** — *[total quantity committed via open milestones, optionally per-rev when breakdowns are set]*
- **Supply** — *[sum of path goals across the lineages that produce a given rev]*
- **Per-Rev Demand** — *[milestone demand for a specific rev, summed across all breakdown-mode milestones plus a share of Total-Mode milestones]*
- **Per-Rev Supply** — *[sum of `path.goalQuantity` for all paths in the job with `path.revision = R`]*
- **Demand vs Supply Gauge** — *[per-rev visual indicator on Job detail showing whether supply covers demand]*
- **Reconciliation Prompt** — *[modal or inline prompt offering one-click goal adjustments when a mismatch is detected]*
- **Step 1 Card** — *[the operator-facing UI on the Parts View / Step View that allows creation of new parts at the first step of a path]*
- **Remaining Count** — *[`path.goalQuantity − created parts on path`; drives step 1 visibility]*

## Requirements

### Requirement 1: Demand vs Supply Computation

**User Story:** As a planner, I want the system to continuously compute the gap between milestone demand and path goal supply per rev, so I always know whether my production targets cover my customer commitments.

#### Acceptance Criteria
*[TODO:
- Per rev R in `Job.revisions[]`: compute `demand(R)` = sum of breakdown-mode milestone quantities for R (Total-Mode milestones do NOT contribute to per-rev demand — they form a separate rev-agnostic demand figure)
- Rev-agnostic demand: sum of Total-Mode milestone quantities across the job
- Per rev R: compute `supply(R)` = sum of `path.goalQuantity` for paths in this job with `path.revision = R`
- Total supply: sum of `path.goalQuantity` across all paths in the job
- Compute `gap(R) = demand(R) − supply(R)` (positive = shortfall, zero or negative = covered)
- Rev-agnostic gap = `revAgnosticDemand − totalSupply` (but showing this is tricky if per-rev revs are already using some of that supply; design-doc detail)
- Recomputed on read (no stored aggregate); cheap because of bounded job size
- Single-rev jobs: gauge not displayed (per progressive disclosure)]*

### Requirement 2: Demand vs Supply Visual Gauge

**User Story:** As a planner reviewing a job, I want a small at-a-glance gauge per rev showing whether supply covers demand, so I can spot problems without manually summing milestones.

#### Acceptance Criteria
*[TODO:
- Visible only on multi-rev jobs (`Job.revisions.length > 1`) OR on single-rev jobs with at least one Total-Mode milestone
- Shows per-rev rows: `Rev A: supply 10 / demand 12 (short 2)`; `Rev B: supply 20 / demand 18 (covered)`
- Shows one additional rev-agnostic row when Total-Mode milestones exist: `Total-Mode demand: 15 (covered by total supply 30)` — distinct visual treatment from per-rev rows
- Color: green (covered, gap ≤ 0), yellow (shortfall ≤ 20% of demand), red (shortfall > 20%)
- Click on a row opens the Reconciliation Prompt for that rev (rev-agnostic row click opens a "raise any path goal" prompt — design detail)]*

### Requirement 3: Reconciliation Prompt — Demand Exceeds Supply

**User Story:** As a planner, when I increase a milestone's per-rev quantity beyond what my path goals can produce, I want an inline prompt offering one-click resolution rather than navigating elsewhere to fix it.

#### Acceptance Criteria
*[TODO:
- Triggered automatically when a milestone edit causes `gap(R) > 0` for some rev R
- Prompt appears inline near the milestone edit form (toast or banner — design detail)
- Prompt text: "Rev A demand across milestones is now 12, but Rev A path goal is 10. Increase Rev A goal to 12?"
- One-click "Increase to 12" → bumps the relevant path goal by the gap (per-lineage choice if multiple Rev A paths exist — design detail)
- Skip / dismiss option: planner can ignore; gauge remains red until resolved
- All resolution actions are explicit clicks; no auto-bump]*

### Requirement 4: Reconciliation Prompt — Supply Reduction Below Committed Demand

**User Story:** As a planner, when I lower a path goal below committed milestone demand, I want a warning that surfaces the conflict before I save, so I don't silently underpromise without realizing.

#### Acceptance Criteria
*[TODO:
- Triggered when a path goal edit would cause `gap(R) > 0`
- Modal warning: "Reducing Rev A goal to 4 will leave 8 units committed to milestones short."
- Options: (a) Proceed anyway (gap remains, gauge red), (b) Reduce milestones too (opens milestone edit), (c) Cancel
- No silent prevention — planner can always proceed]*

### Requirement 5: One-Click Goal Adjustment Action

**User Story:** As a planner clicking "Increase Rev A goal to 12" on a reconciliation prompt, I want the system to atomically update the goal and refresh the affected views, so the change is immediate and obvious.

#### Acceptance Criteria
*[TODO:
- Single API call adjusts the path goal
- Audit trail entry: `path_goal_adjusted_for_reconciliation` with before/after values + triggering milestone reference
- Affected views (job detail, gauge, step 1 cards) refresh automatically
- If multiple paths produce the same rev (e.g., in-house Rev A + outsource Rev A), the prompt asks the planner which lineage(s) absorb the increase (multi-select with default = first lineage by display order)
- Default split when multiple lineages selected: equal distribution rounded with remainder to first lineage]*

### Requirement 6: Multi-Rev Step 1 Operator UI

**User Story:** As an operator on the Parts View, when a job has multiple revs in flight, I want to see a separate step 1 creation card per rev with each one's remaining count, so I know exactly which rev to make and how many.

#### Acceptance Criteria
*[TODO:
- For multi-rev jobs: each rev's path renders its own Step 1 card on the Parts View (when on step 1)
- Each card shows: rev label, lineage/path name, remaining count (`goalQuantity − createdCount`), batch creation form
- Cards ordered by lineage display order, then by rev creation order within lineage
- Operator selects which card to work on; behavior identical to today's single Step 1 card except for the rev-aware identity]*

### Requirement 7: Single-Rev Step 1 UI Preservation

**User Story:** As an operator on a single-rev job, I want Step 1 to look and behave exactly as it does today, so the rev infrastructure adds zero friction to the common case.

#### Acceptance Criteria
*[TODO:
- For single-rev jobs: Step 1 card identical to current implementation (no rev label, no rev pill, single card)
- No additional fields, no new buttons, no rev selection
- Operator workflow unchanged]*

### Requirement 8: Step 1 Card Visibility Rules

**User Story:** As an operator, I want completed step 1 cards to disappear so I'm not distracted by paths that don't need more parts created.

#### Acceptance Criteria
*[TODO:
- Step 1 card is visible iff `path.goalQuantity > createdCount` (createdCount excludes scrapped — verify against existing behavior)
- When `createdCount >= goalQuantity`, the card disappears (current behavior; preserved)
- No "Goal met" muted-state placeholder — clean removal (per user direction during design discussion)
- Card re-appears if path goal is later raised above createdCount (e.g., after reconciliation prompt action)]*

### Requirement 9: Audit Trail for Reconciliation Actions

**User Story:** As a quality engineer, I want every goal adjustment driven by a reconciliation prompt to be distinguishable from manual edits in the audit trail, so I can trace why a change happened.

#### Acceptance Criteria
*[TODO:
- New audit action type: `path_goal_adjusted_for_reconciliation` (distinct from existing path goal edits)
- Captures: user, timestamp, path ID, before/after goal values, triggering milestone ID, gap before adjustment
- Manual path goal edits continue to use existing audit action (no double-logging)]*

### Requirement 10: Backwards Compatibility

**User Story:** As a developer, I want this sub-area to be additive only, so single-rev jobs (the common case) see no behavior change and existing tests pass unchanged.

#### Acceptance Criteria
*[TODO:
- No schema changes in this sub-area (relies on sub-areas 1 and 2 schema)
- All single-rev jobs render Step 1 identically to today
- All single-rev jobs see no reconciliation gauge or prompts
- Existing path goal edit endpoint behavior preserved (only the audit action distinguishes new reconciliation-driven edits)]*

## Correctness Properties (for property-based testing)

*[TODO:]*

- **CP-1: Demand-supply gap definition** — for any job and rev R, `gap(R) = demand(R) − supply(R)`; gauge state derives purely from this number.
- **CP-2: No silent goal mutation** — no operation in any sub-area mutates a path goal without an explicit user action (form submit or reconciliation prompt click). Property: a randomized sequence of milestone create/edit/delete operations never changes any `path.goalQuantity` value.
- **CP-3: One-click reconciliation correctness** — clicking "Increase Rev A goal to N" results in `path.goalQuantity = N` (or sum across selected lineages = N) for the affected paths, and `gap(R) ≤ 0` immediately after.
- **CP-4: Single-rev UI parity** — for any single-rev job, no reconciliation gauge, no reconciliation prompts, and no multi-card Step 1 UI is rendered.
- **CP-5: Step 1 visibility** — Step 1 card visible iff `goalQuantity > createdCount`. Property: toggling goal across the threshold flips visibility deterministically.
- **CP-6: Audit distinctness** — every reconciliation-driven goal change produces a `path_goal_adjusted_for_reconciliation` entry; every manual goal change produces the existing path-edit entry. No double-logging.

## Open Questions / Deferred to Design Doc

*[TODO:]*

- *[Placeholder: when multiple lineages produce the same rev (in-house Rev A + outsource Rev A), how does the reconciliation prompt let the planner split the goal increase? Default = first lineage absorbs all, with a "Split across lineages" advanced option? My lean: yes.]*
- *[Placeholder: should the demand-vs-supply gauge appear on the Jobs list page (compact form) or only on the Job detail page? My lean: detail page only; jobs list stays clean.]*

### Resolved During Requirements Discussion

- **Total-Mode milestone demand is rev-agnostic**: it does not contribute to any rev's per-rev demand figure. The gauge shows per-rev supply/demand on separate rows plus one additional "rev-agnostic demand" row aggregating Total-Mode milestones. Planners reading the gauge see "Rev A short by 2, Rev B covered, Rev-agnostic 15 covered by total supply 30" clearly. Captured in R1 and R2.
