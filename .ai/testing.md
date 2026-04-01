# Testing Strategy — SHOP_ERP

> Property-based tests, integration tests, unit tests, and seed data.

## Test Stack

- Vitest 3.2 (test runner)
- `happy-dom` (DOM environment)
- `fast-check` (property-based testing, planned)
- Isolated temp SQLite databases for integration tests

## Commands

| Command | What it does |
|---------|-------------|
| `npm run test` | `vitest run` — single pass, all tests (857 tests, 148 files) |
| `npm run typecheck` | `nuxt typecheck` — full TypeScript type checking (run after tests pass) |
| `npm run test:watch` | `vitest` — watch mode |
| `npx vitest run tests/properties` | Property tests only |
| `npx vitest run tests/unit` | Unit tests only |
| `npx vitest run tests/integration` | Integration tests only |

## Verification Order

After making changes, always verify in this order:
1. `npm run test` — all tests must pass first
2. `npm run typecheck` — zero type errors required before committing

## Test File Organization

```
tests/
  unit/
    services/           → jobService, pathService, serialService, reconcileSteps, etc. (11 files)
    utils/              → serialization, validation, idGenerator, errors, progressBar, services (6 files)
    composables/        → useBarcode, useViewFilters, useJobForm, workQueueSearch (4 files)
    components/         → SerialCreationPanel, serialNoteAdd, EndpointCard, DocsSidebar, JobEditNavigation, JobViewToolbar (6 files)
    repositories/       → hasStepDependents (1 file)
    repositories/sqlite/ → migrations (1 file)
  properties/
    jobPartCount.property.test.ts        → CP-1: Job part count invariant
    serialUniqueness.property.test.ts    → CP-2: SN uniqueness
    stepAdvancement.property.test.ts     → CP-3: Sequential advancement
    countConservation.property.test.ts   → CP-4: Step count conservation
    roundTrip.property.test.ts           → CP-5: Serialization round-trip (32 sub-tests)
    auditTrail.property.test.ts          → CP-6: Audit immutability (2 sub-tests)
    progressBar.property.test.ts         → CP-7: Progress accuracy (2 sub-tests)
    templateIndependence.property.test.ts → CP-8: Template independence (2 sub-tests)
    batchIdempotence.property.test.ts    → CP-10: Cert batch idempotence
    inputValidation.property.test.ts     → CP-11: Invalid input rejection (4 sub-tests)
    malformedJson.property.test.ts       → CP-12: Malformed JSON errors (8 sub-tests)
    pageToggleMerge.property.test.ts     → P5-8: mergePageToggles + isPageEnabled (4 properties)
    pageToggleRouteAccess.property.test.ts → P1,3: Route access + always-visible invariant (5 tests)
    pageToggleSidebar.property.test.ts   → P2,4: Sidebar filtering consistency + bounds (2 tests)
    stepViewAlwaysEnabled.property.test.ts → Step view routes always enabled regardless of parts toggle (2 tests)
    partsToggleRespected.property.test.ts → Non-step /parts routes respect parts toggle (2 tests)
    otherTogglesUnaffected.property.test.ts → Other toggle-mapped routes unaffected by always-enabled fix (2 tests)
    dashboardSettingsAlwaysEnabled.property.test.ts → Dashboard + Settings always enabled (2 tests)
    docsDirectoryCompleteness.property.test.ts → P2: Content directory structure completeness (2 tests)
    docsFrontmatterValidity.property.test.ts → P3: Endpoint frontmatter validity (2 tests)
    docsMethodBadgeColor.property.test.ts → P8: Method badge color mapping (3 tests)
    docsNavOrdering.property.test.ts → P6: Navigation tree ordering (3 tests)
    docsSearchScoping.property.test.ts → P7: Search result scoping (4 tests)
    docsSlugResolution.property.test.ts → P5: Slug resolution correctness (5 tests)
    editRouteToggle.property.test.ts → Edit route toggle inheritance (1 test)
    stepIdPreservation.property.test.ts → FK-P1: Step ID preservation during reconciliation (1 test)
    reconciliationCompleteness.property.test.ts → FK-P2: Count conservation (3 tests)
    appendOnlyInserts.property.test.ts → FK-P3: Append-only inserts (3 tests)
    sequentialOrderInvariant.property.test.ts → FK-P4: Sequential order invariant (1 test)
    idempotentUpdate.property.test.ts → FK-P5: Idempotent update (1 test)
    pathDoneCount.property.test.ts       → CP-DONE-1/2: Path completed count + distribution completedCount always 0 (2 tests)
    jobViewCachePreservation.property.test.ts → PBT-JV1: Cache preservation on collapse (1 test)
    jobViewBulkExpand.property.test.ts   → PBT-JV3: Bulk expand populates all distributions (1 test)
    jobViewExpandedState.property.test.ts → PBT-JV2: ExpandedState validity (2 tests)
  integration/
    helpers.ts                           → createTestContext() with all services
    jobLifecycle.test.ts                 → Full job lifecycle (6 tests)
    templateApplication.test.ts          → Template apply + independence (4 tests)
    certTraceability.test.ts             → Cert attach + audit trail (5 tests)
    progressTracking.test.ts             → Done count correctness: completedCount vs distribution (2 tests)
    operatorView.test.ts                 → Current/coming/backlog (4 tests)
    noteAndDefect.test.ts                → Step notes per-step/per-serial (4 tests)
    fkSafePathUpdate.test.ts             → FK-safe path update: ID preservation, append, delete guard, idempotent (6 tests)
    jobViewUtilities.test.ts             → Job view expand/collapse orchestration + path expansion flow (15 tests)
```

Optional property tests (skipped for MVP):
- CP-9: BOM Roll-Up Consistency (`bomRollUp.property.test.ts`)
- CP-13: Jira Ticket Filtering (`jiraFiltering.property.test.ts`)

## Property Test Pattern

Each property test uses `fast-check` with minimum 100 iterations:

```typescript
import fc from 'fast-check'
describe('Property N: Title', () => {
  it('should hold for all valid inputs', () => {
    fc.assert(
      fc.property(arbitraryDomainObject(), (obj) => {
        // exercise system, assert property
      }),
      { numRuns: 100 }
    )
  })
})
```

## Integration Test Isolation

Each test creates a fresh temp SQLite database:

```typescript
export function createTestDb() {
  const dir = mkdtempSync(join(tmpdir(), 'shop-erp-test-'))
  const dbPath = join(dir, 'test.db')
  const repos = createRepositories({ type: 'sqlite', dbPath })
  return { repos, dbPath, cleanup: () => unlinkSync(dbPath) }
}
```

No shared state between tests.

## Seed Data

- All seed data uses `SAMPLE-` prefix
- `npm run seed` — idempotent (skips if SAMPLE- data exists)
- `npm run seed:reset` — deletes SAMPLE- records, then re-seeds
- Creates: 3 templates, 3-4 jobs with paths/serials at various stages, certs, notes
- Example jobs: `SAMPLE-Launch Lock Body`, `SAMPLE-Bracket Assembly`, `SAMPLE-Control Board Rev C`

## 13 Correctness Properties

| # | Property | Validates |
|---|----------|-----------|
| 1 | Job Part Count Invariant | Req 1.4, 7.5 |
| 2 | Serial Number Uniqueness | Req 4.1, 4.2 |
| 3 | Sequential Step Advancement | Req 3.1, 3.2, 3.3 |
| 4 | Process Step Count Conservation | Req 3.4, 2.4, 7.4 |
| 5 | Domain Object Round-Trip Serialization | Req 12.1, 12.2, 12.3, 12.5 |
| 6 | Audit Trail Immutability + Completeness | Req 5.4, 13.1–13.5 |
| 7 | Progress Bar Accuracy | Req 1.3, 1.5, 7.1, 7.6 |
| 8 | Template Route Independence | Req 8.2, 8.3, 8.4 |
| 9 | BOM Roll-Up Consistency | Req 11.2, 11.3, 11.5 |
| 10 | Batch Cert Application Idempotence | Req 5.3, 5.6 |
| 11 | Invalid Input Rejection | Req 1.6, 2.6, 4.6, 5.5 |
| 12 | Malformed JSON Error Reporting | Req 12.4 |
| 13 | Jira Ticket Filtering | Req 9.1, 9.5 |
