# Design Document: Work Queue Shows First Step

## Overview

This design addresses **GitHub Issue #123** — "Feature Request: Work Queue Shows First Step."

Currently, the work queue only displays steps that have parts physically present (i.e., `listPartsByCurrentStepId(stepId)` returns a non-empty list). The sole exception is the `_all` queue endpoint, which already includes step 0 even with zero parts. However, the main grouped work queue endpoint (`/api/operator/work-queue`) and the per-user endpoint (`/api/operator/queue/[userId]`) skip steps with zero parts entirely.

The problem: when a job/path is created but no parts have been created yet at step 0, the job is invisible in the work queue. Operators have no visibility on jobs that need initial part creation. The feature request asks that the first step (step 0) of every path always appear in the work queue until the number of parts at step 0 meets or exceeds the path's `goalQuantity`. This gives operators a clear signal that work needs to begin.

## Architecture

The change is confined to the work queue data assembly layer — the three API routes that build `WorkQueueJob` entries. No new tables, services, or repositories are needed. The `WorkQueueJob` type gains one optional field (`goalQuantity`) so the frontend can display progress context.

```mermaid
graph TD
    subgraph Frontend
        QP[queue.vue Page]
        WQF[WorkQueueFilterBar]
        UOWQ[useOperatorWorkQueue]
    end

    subgraph API Routes
        WQ[work-queue.get.ts]
        ALL[queue/_all.get.ts]
        UID[queue/userId.get.ts]
    end

    subgraph Services
        JS[jobService]
        PS[pathService]
        PTS[partService]
    end

    subgraph Repositories
        JR[JobRepository]
        PR[PathRepository]
        PTR[PartRepository]
    end

    QP --> WQF
    QP --> UOWQ
    UOWQ -->|$fetch| WQ
    UOWQ -->|$fetch| ALL
    UOWQ -->|$fetch| UID

    WQ --> JS
    WQ --> PS
    WQ --> PTS
    ALL --> JS
    ALL --> PS
    ALL --> PTS
    UID --> JS
    UID --> PS
    UID --> PTS

    JS --> JR
    PS --> PR
    PTS --> PTR

```

## Sequence Diagram: Work Queue Entry Assembly

```mermaid
sequenceDiagram
    participant Client as Frontend
    participant API as work-queue.get.ts
    participant JS as jobService
    participant PS as pathService
    participant PTS as partService

    Client->>API: GET /api/operator/work-queue?groupBy=location
    API->>JS: listJobs()
    JS-->>API: Job[]

    loop For each job
        API->>PS: listPathsByJob(job.id)
        PS-->>API: Path[] (with steps, goalQuantity)

        loop For each path
            loop For each step in path.steps
                API->>PTS: listPartsByCurrentStepId(step.id)
                PTS-->>API: Part[]

                alt step.order === 0 AND partCount < path.goalQuantity
                    Note over API: INCLUDE in queue (new behavior)
                    Note over API: Even if partCount === 0
                else partCount > 0
                    Note over API: INCLUDE in queue (existing behavior)
                else partCount === 0 AND step.order !== 0
                    Note over API: SKIP (existing behavior)
                end
            end
        end
    end

    API->>API: groupEntriesByDimension(entries, groupBy, userNameMap)
    API-->>Client: { groups, totalParts }
```

## Components and Interfaces

### Modified Type: WorkQueueJob

The `WorkQueueJob` interface in `server/types/computed.ts` gains one new optional field:

```typescript
export interface WorkQueueJob {
  // ... existing fields unchanged ...
  jobId: string
  jobName: string
  pathId: string
  pathName: string
  stepId: string
  stepName: string
  stepOrder: number
  stepLocation?: string
  totalSteps: number
  partIds: readonly string[]
  partCount: number
  previousStepId?: string
  previousStepName?: string
  nextStepId?: string
  nextStepName?: string
  nextStepLocation?: string
  isFinalStep: boolean
  stepOptional?: boolean
  assignedTo?: string
  jobPriority: number

  // NEW: path goal quantity for first-step progress display
  goalQuantity?: number
}
```

### Modified API Routes

Three routes need the same logic change:

| Route | File | Current First-Step Behavior | New Behavior |
|-------|------|-----------------------------|--------------|
| `GET /api/operator/work-queue` | `server/api/operator/work-queue.get.ts` | Skips steps with 0 parts | Include step 0 if `partCount < goalQuantity` |
| `GET /api/operator/queue/_all` | `server/api/operator/queue/_all.get.ts` | Includes step 0 with 0 parts (already) | Add `goalQuantity` field; keep existing behavior |
| `GET /api/operator/queue/[userId]` | `server/api/operator/queue/[userId].get.ts` | Skips steps with 0 parts | Include step 0 if `partCount < goalQuantity` |

### Unchanged Components

- `WorkQueueGroup`, `WorkQueueGroupedResponse`, `WorkQueueResponse` — no structural changes
- `groupEntriesByDimension()` — operates on `WorkQueueJob[]`, transparent to new field
- `useOperatorWorkQueue` composable — passes data through, no logic changes needed
- `useWorkQueueFilters` composable — filtering logic is field-agnostic
- `queue.vue` — minor optional enhancement to show goal context on first-step entries

## Data Models

No schema changes. The feature uses existing data:

| Entity | Field | Usage |
|--------|-------|-------|
| `Path` | `goalQuantity` | Threshold: first step included until `partCount >= goalQuantity` |
| `Path` | `steps[0]` | The first step (order 0) to always include |
| `Part` | `currentStepId` | Used by `listPartsByCurrentStepId()` to count parts at step |
| `ProcessStep` | `order` | Identifies step 0 (first step) |

## Key Functions with Formal Specifications

### Function: shouldIncludeStep()

```typescript
function shouldIncludeStep(
  step: ProcessStep,
  partCount: number,
  pathGoalQuantity: number,
): boolean
```

**Preconditions:**
- `step` is a valid, non-soft-deleted `ProcessStep`
- `partCount >= 0`
- `pathGoalQuantity > 0` (enforced by `assertPositive` on path creation)

**Postconditions:**
- Returns `true` if `partCount > 0` (existing behavior — step has work)
- Returns `true` if `step.order === 0 AND partCount < pathGoalQuantity` (new behavior — first step needs parts)
- Returns `false` otherwise (non-first step with no parts)

**Loop Invariants:** N/A (pure predicate, no loops)

### Function: buildWorkQueueEntry()

```typescript
function buildWorkQueueEntry(
  job: Job,
  path: Path,
  step: ProcessStep,
  parts: Part[],
): WorkQueueJob
```

**Preconditions:**
- `job`, `path`, `step` are valid domain objects
- `step` belongs to `path.steps`
- `parts` is the result of `listPartsByCurrentStepId(step.id)`

**Postconditions:**
- Returns a `WorkQueueJob` with all existing fields populated
- If `step.order === 0`: `goalQuantity` is set to `path.goalQuantity`
- `partCount === parts.length`
- `partIds` contains exactly the IDs from `parts`

## Algorithmic Pseudocode

### Work Queue Entry Assembly (Updated)

```pascal
ALGORITHM buildWorkQueueEntries(jobs, pathService, partService)
INPUT: jobs: Job[], pathService, partService
OUTPUT: entries: WorkQueueEntry[]

BEGIN
  entries ← []

  FOR EACH job IN jobs DO
    paths ← pathService.listPathsByJob(job.id)

    FOR EACH path IN paths DO
      totalSteps ← LENGTH(path.steps)

      FOR EACH step IN path.steps DO
        parts ← partService.listPartsByCurrentStepId(step.id)
        partCount ← LENGTH(parts)

        // CHANGED: First-step inclusion logic
        IF partCount = 0 THEN
          IF step.order = 0 AND partCount < path.goalQuantity THEN
            // Include first step — needs parts created
            // (partCount is 0, which is < goalQuantity since goalQuantity > 0)
          ELSE
            CONTINUE  // Skip non-first steps with no parts
          END IF
        END IF

        isFinalStep ← (step.order = totalSteps - 1)
        nextStep ← path.steps[step.order + 1] IF NOT isFinalStep ELSE NULL
        prevStep ← path.steps[step.order - 1] IF step.order > 0 ELSE NULL

        entry ← {
          jobId: job.id,
          jobName: job.name,
          pathId: path.id,
          pathName: path.name,
          stepId: step.id,
          stepName: step.name,
          stepOrder: step.order,
          stepLocation: step.location,
          totalSteps: totalSteps,
          partIds: MAP(parts, p → p.id),
          partCount: partCount,
          assignedTo: step.assignedTo,
          nextStepName: nextStep?.name,
          nextStepLocation: nextStep?.location,
          isFinalStep: isFinalStep,
          jobPriority: job.priority,
          goalQuantity: path.goalQuantity IF step.order = 0 ELSE UNDEFINED
        }

        APPEND entry TO entries
      END FOR
    END FOR
  END FOR

  RETURN entries
END
```

**Preconditions:**
- All jobs are valid with `goalQuantity > 0`
- All paths have at least one step
- `pathService` and `partService` are initialized

**Postconditions:**
- Every step with `partCount > 0` is included (backward compatible)
- Every first step (order 0) where `partCount < path.goalQuantity` is included (new)
- No duplicate entries (keyed by `jobId|pathId|stepOrder`)

**Loop Invariants:**
- `entries` contains only valid `WorkQueueJob` objects
- Each entry corresponds to exactly one step in one path of one job

### First-Step Inclusion Predicate

```pascal
ALGORITHM shouldIncludeStep(step, partCount, pathGoalQuantity)
INPUT: step: ProcessStep, partCount: Integer, pathGoalQuantity: Integer
OUTPUT: include: Boolean

BEGIN
  // Existing behavior: always include steps with parts
  IF partCount > 0 THEN
    RETURN TRUE
  END IF

  // New behavior: include first step until goal is met
  IF step.order = 0 AND partCount < pathGoalQuantity THEN
    RETURN TRUE
  END IF

  RETURN FALSE
END
```

**Preconditions:**
- `partCount >= 0`
- `pathGoalQuantity > 0`

**Postconditions:**
- `TRUE` iff step has parts OR is first step below goal
- When `partCount >= pathGoalQuantity` and step is first: returns `FALSE` (goal met, no longer needs visibility)
- Backward compatible: non-first steps with 0 parts still excluded

## Example Usage

```typescript
// Before (work-queue.get.ts):
const parts = partService.listPartsByCurrentStepId(step.id)
if (parts.length === 0) continue  // ← skips ALL empty steps

// After:
const parts = partService.listPartsByCurrentStepId(step.id)
if (parts.length === 0 && !(step.order === 0 && parts.length < path.goalQuantity)) continue

// Simplified (since parts.length === 0 is already checked):
const parts = partService.listPartsByCurrentStepId(step.id)
if (parts.length === 0 && step.order !== 0) continue
// But we also need to stop showing step 0 once goal is met:
if (parts.length === 0 && (step.order !== 0 || parts.length >= path.goalQuantity)) continue

// Clearest form:
const parts = partService.listPartsByCurrentStepId(step.id)
const isFirstStepBelowGoal = step.order === 0 && parts.length < path.goalQuantity
if (parts.length === 0 && !isFirstStepBelowGoal) continue

// Add goalQuantity to the entry for first steps:
const entry: WorkQueueJob = {
  // ... existing fields ...
  ...(step.order === 0 && { goalQuantity: path.goalQuantity }),
}
```

## Correctness Properties

1. **First-Step Visibility (CP-WQ-FS1):** For all paths where `partCountAtStep0 < path.goalQuantity`, step 0 MUST appear in the work queue response, even when `partCountAtStep0 === 0`.

2. **First-Step Disappearance (CP-WQ-FS2):** For all paths where `partCountAtStep0 >= path.goalQuantity`, step 0 MUST NOT appear in the work queue unless it has parts (standard inclusion rule).

3. **Backward Compatibility (CP-WQ-FS3):** For all non-first steps (order > 0), the inclusion rule is unchanged: include if and only if `partCount > 0`.

4. **Goal Quantity Propagation (CP-WQ-FS4):** For all `WorkQueueJob` entries where `stepOrder === 0`, the `goalQuantity` field MUST equal the parent path's `goalQuantity`. For entries where `stepOrder > 0`, `goalQuantity` MUST be `undefined`.

5. **Consistency Across Endpoints (CP-WQ-FS5):** The `_all`, `work-queue`, and `[userId]` endpoints MUST produce identical first-step inclusion decisions for the same job/path/step data.

## Error Handling

### Edge Case: Path with No Steps

**Condition:** A path has an empty `steps` array (should not happen due to `assertNonEmptyArray` validation on creation).
**Response:** The inner loop simply doesn't execute. No first-step entry is created.
**Recovery:** N/A — this is a data integrity issue handled at the service layer.

### Edge Case: Soft-Deleted First Step

**Condition:** Step 0 has `removedAt` set (soft-deleted).
**Response:** The current code iterates `path.steps` which includes soft-deleted steps. The existing behavior already handles this — soft-deleted steps are included in the steps array but may have no parts. The first-step logic should respect soft-deletion: if step 0 is soft-deleted, it should NOT be force-included.
**Recovery:** Filter on `!step.removedAt` before applying the first-step inclusion rule.

### Edge Case: Goal Quantity Already Met at Step 0

**Condition:** `partCountAtStep0 >= path.goalQuantity`.
**Response:** Step 0 is treated like any other step — included only if it has parts. The "always show first step" behavior stops once the goal is met.

## Testing Strategy

### Unit Testing Approach

- Test the `shouldIncludeStep` predicate with boundary values: 0 parts, 1 part, goalQuantity-1 parts, goalQuantity parts, goalQuantity+1 parts
- Test that non-first steps are never force-included
- Test the `goalQuantity` field is set only on step 0 entries

### Property-Based Testing Approach

**Property Test Library:** fast-check

- **CP-WQ-FS1:** Generate arbitrary jobs/paths/steps with random part counts. Assert that step 0 always appears when `partCount < goalQuantity`.
- **CP-WQ-FS2:** Generate paths where step 0 has `partCount >= goalQuantity`. Assert step 0 only appears if it has parts.
- **CP-WQ-FS3:** Generate non-first steps with 0 parts. Assert they never appear in the queue.
- **CP-WQ-FS5:** Run the same input through all three endpoint logic paths. Assert identical inclusion decisions.

### Integration Testing Approach

- Create a job with a path and 0 parts. Verify step 0 appears in all three queue endpoints.
- Create parts at step 0 up to `goalQuantity`. Verify step 0 disappears from the queue (assuming all parts advanced past step 0).
- Create parts at step 0 equal to `goalQuantity - 1`. Verify step 0 still appears.

## Performance Considerations

No performance impact. The change adds a single integer comparison (`step.order === 0 && parts.length < path.goalQuantity`) to the existing loop. The `path.goalQuantity` is already loaded as part of the path object — no additional DB queries.

## Security Considerations

No security implications. The feature exposes the same data (job names, step names, part counts) that is already visible in the work queue. The `goalQuantity` field is not sensitive.

## Dependencies

No new dependencies. The feature uses existing:
- `Path.goalQuantity` (already on the domain type)
- `ProcessStep.order` (already used for step ordering)
- `partService.listPartsByCurrentStepId()` (already called in the loop)
