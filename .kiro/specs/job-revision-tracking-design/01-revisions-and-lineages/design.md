# Design — Sub-Area 1: Revisions and Path Lineages

> Design document for the requirements in `01-revisions-and-lineages/requirements.md`. Covers schema, flows, components, terminology mapping, migration, and alternatives considered.
> Out of sub-area scope: delivery milestones (sub-area 2), reconciliation prompts and step-1 operator UX (sub-area 3).

## 1. Overview

*[TODO: 1-2 paragraph summary of the design approach. Schema strategy (new `path_lineages` table), code/UI terminology choice (Strategy A), lineage-always-exists, job-owned catalog, Rev-Up as unified flow with classification. Reference to the three guiding principles.]*

## 2. Key Design Decisions

*[TODO: numbered bulleted list of the 8–10 biggest design calls, each with 2–3 sentences. Draws from our discussion: Strategy A over B, new table over self-FK, always-exists over lazy-create, single Rev-Up modal with classification, muted = computed, etc.]*

## 3. Architecture

*[TODO: where this sub-area lands in the existing layered architecture. New service (revisionService), new repository (pathLineageRepository), extensions to jobService and pathService, new API routes, new UI components. Mermaid diagram of the high-level dependency flow.]*

## 4. Data Model

### 4.1 New Table: `path_lineages`
*[TODO: CREATE TABLE SQL + column explanations.]*

### 4.2 Modified Table: `jobs`
*[TODO: new `revisions` JSON column.]*

### 4.3 Modified Table: `paths`
*[TODO: new `lineage_id` FK + `revision` column.]*

### 4.4 Modified Table: `parts`
*[TODO: new `revision` column.]*

### 4.5 Constraints and Indexes
*[TODO: summary of FKs, NOT NULL constraints, new indexes.]*

## 5. Domain Types

*[TODO: TypeScript type additions/changes to `server/types/domain.ts`, `api.ts`, `computed.ts`. Show the new `PathLineage` type, `Job` extension, `Path` extension, `Part` extension, `AuditAction` extension, new input types (`RevUpInput`, etc.).]*

## 6. Services and Repositories

### 6.1 New Service: `revisionService`
*[TODO: public interface (function signatures) + responsibilities.]*

### 6.2 New Repository: `pathLineageRepository`
*[TODO: interface methods (create, get, listByJob, updateName, delete).]*

### 6.3 Extensions to `jobService`
*[TODO: new methods for catalog management.]*

### 6.4 Extensions to `pathService`
*[TODO: auto-create lineage on path create; clone-for-revision method.]*

## 7. API Routes

*[TODO: new endpoints — `POST /api/jobs/:id/rev-up`, `PATCH /api/path-lineages/:id`, `GET /api/path-lineages/:id`. Request/response shapes + Zod schemas.]*

## 8. Key Flows

### 8.1 Path Creation (Simple Case, Auto-Lineage)
*[TODO: mermaid sequence diagram.]*

### 8.2 Rev-Up with Work (Introduce Sub-type)
*[TODO: mermaid sequence diagram showing classify → transaction → clone → scrap cascade → audit.]*

### 8.3 Rev-Up without Work (In-Place)
*[TODO: mermaid sequence diagram.]*

### 8.4 Rev-Up Propagate (Existing Rev to New Lineage)
*[TODO: mermaid sequence diagram showing how propagate differs from introduce.]*

### 8.5 Muted Rev Computation
*[TODO: pseudocode showing how the UI computes muted state on read.]*

## 9. UI Design

### 9.1 Rev-Up Modal
*[TODO: wireframe or structured description — header, rev input, per-Lineage section with collapsible blocks.]*

### 9.2 Lineage Grouping on Job Detail
*[TODO: how single-rev vs multi-rev renders differently. Dimming for muted revs. Expand/collapse controls.]*

### 9.3 Rev Pill Component
*[TODO: visual treatment distinct from tag pills. Color, shape, placement.]*

### 9.4 Rev Change Banner
*[TODO: inline banner for in-place Rev-Up events so users see something happened.]*

## 10. Error Handling

*[TODO: validation errors, 400/409 responses, transaction rollback behavior, permission checks (admin-gated Rev-Up).]*

## 11. Migration Strategy

*[TODO: detailed steps for migration `014_path_lineages_and_revisions.sql`. SQLite-specific constraints (can't ALTER to NOT NULL easily — new-table-copy-drop-rename pattern). Backfill logic.]*

## 12. Testing Strategy

*[TODO: which correctness properties become property-based tests, which scenarios become integration tests, which flows become Playwright E2E tests. Unit test targets.]*

## 13. Terminology Mapping (Code ↔ UI)

*[TODO: short table clarifying the Strategy A mismatch — code `Path` = one rev, UI "Path" = a Lineage. Guidance for future contributors.]*

## 14. Alternatives Considered

*[TODO: brief write-ups of rejected options — Strategy B (rename), self-FK chain, denormalized `lineage_name`, lazy-create lineage. Why we rejected each.]*

## 15. Open Questions

*[TODO: design-level items flagged for future decision. Modal single vs multi-step. Lineage delete cascade. Catalog garbage collection (probably never — append-only). Rev pill color scheme.]*
