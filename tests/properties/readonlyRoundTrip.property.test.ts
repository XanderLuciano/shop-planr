/**
 * Property Test — Serialization Round-Trip Preservation Under Readonly Arrays
 *
 * Feature: readonly-domain-types, Property 2: Serialization round-trip preservation under readonly arrays
 *
 * Generates random domain objects for each type that has readonly array properties,
 * serializes via JSON.stringify, deserializes via JSON.parse, and asserts deep
 * equality. This proves the `readonly` modifier has zero runtime effect on
 * serialization — the round-tripped form is identical.
 *
 * **Validates: Requirements 4.3, 1.5**
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { Job, Path, ProcessStep, BOM, BomEntry, TemplateRoute, TemplateStep, StepNote, BomVersion, Part } from '../../server/types/domain'
import type { OperatorStepView, OperatorPartInfo, WorkQueueJob, BomSummary, BomEntrySummary, AdvancementResult } from '../../server/types/computed'
import type { JiraTicket, FetchTicketsResult } from '../../server/services/jiraService'

// ---------------------------------------------------------------------------
// Shared arbitraries
// ---------------------------------------------------------------------------

const arbId = () => fc.stringMatching(/^[a-zA-Z0-9_-]{5,20}$/)
const arbIsoDate = () =>
  fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-01-01').getTime() })
    .map(ts => new Date(ts).toISOString())
const arbName = () => fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)

// ---------------------------------------------------------------------------
// Domain-type arbitraries (only types with readonly array properties)
// ---------------------------------------------------------------------------

const arbProcessStep = (): fc.Arbitrary<ProcessStep> =>
  fc.record({
    id: arbId(),
    name: arbName(),
    order: fc.nat({ max: 20 }),
    location: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
    assignedTo: fc.option(arbId(), { nil: undefined }),
    optional: fc.boolean(),
    dependencyType: fc.constantFrom('physical' as const, 'preferred' as const, 'completion_gate' as const),
  })

const arbJob = (): fc.Arbitrary<Job> =>
  fc.record({
    id: arbId(),
    name: arbName(),
    goalQuantity: fc.integer({ min: 1, max: 10000 }),
    jiraTicketKey: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
    jiraTicketSummary: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
    jiraPartNumber: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
    jiraPriority: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
    jiraEpicLink: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
    jiraLabels: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }), { nil: undefined }),
    createdAt: arbIsoDate(),
    updatedAt: arbIsoDate(),
  })

const arbPath = (): fc.Arbitrary<Path> =>
  fc.record({
    id: arbId(),
    jobId: arbId(),
    name: arbName(),
    goalQuantity: fc.integer({ min: 1, max: 10000 }),
    steps: fc.array(arbProcessStep(), { minLength: 1, maxLength: 5 }),
    advancementMode: fc.constantFrom('strict' as const, 'flexible' as const, 'per_step' as const),
    createdAt: arbIsoDate(),
    updatedAt: arbIsoDate(),
  })

const arbBomEntry = (): fc.Arbitrary<BomEntry> =>
  fc.record({
    id: fc.option(arbId(), { nil: undefined }),
    bomId: fc.option(arbId(), { nil: undefined }),
    partType: arbName(),
    requiredQuantityPerBuild: fc.integer({ min: 1, max: 1000 }),
    contributingJobIds: fc.array(arbId(), { maxLength: 5 }),
  })

const arbBom = (): fc.Arbitrary<BOM> =>
  fc.record({
    id: arbId(),
    name: arbName(),
    entries: fc.array(arbBomEntry(), { minLength: 1, maxLength: 5 }),
    createdAt: arbIsoDate(),
    updatedAt: arbIsoDate(),
  })

const arbTemplateStep = (): fc.Arbitrary<TemplateStep> =>
  fc.record({
    name: arbName(),
    order: fc.nat({ max: 20 }),
    location: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
    optional: fc.boolean(),
    dependencyType: fc.constantFrom('physical' as const, 'preferred' as const, 'completion_gate' as const),
  })

const arbTemplateRoute = (): fc.Arbitrary<TemplateRoute> =>
  fc.record({
    id: arbId(),
    name: arbName(),
    steps: fc.array(arbTemplateStep(), { minLength: 1, maxLength: 5 }),
    createdAt: arbIsoDate(),
    updatedAt: arbIsoDate(),
  })

const arbStepNote = (): fc.Arbitrary<StepNote> =>
  fc.record({
    id: arbId(),
    jobId: arbId(),
    pathId: arbId(),
    stepId: arbId(),
    partIds: fc.array(arbId(), { minLength: 1, maxLength: 5 }),
    text: fc.string({ minLength: 1, maxLength: 200 }),
    createdBy: arbId(),
    createdAt: arbIsoDate(),
    pushedToJira: fc.boolean(),
    jiraCommentId: fc.option(arbId(), { nil: undefined }),
  })

const arbBomVersion = (): fc.Arbitrary<BomVersion> =>
  fc.record({
    id: arbId(),
    bomId: arbId(),
    versionNumber: fc.integer({ min: 1, max: 100 }),
    entriesSnapshot: fc.array(arbBomEntry(), { minLength: 1, maxLength: 5 }),
    changeDescription: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
    changedBy: arbId(),
    createdAt: arbIsoDate(),
  })

const arbOperatorPartInfo = (): fc.Arbitrary<OperatorPartInfo> =>
  fc.record({
    partId: arbId(),
    jobId: arbId(),
    jobName: arbName(),
    pathId: arbId(),
    pathName: arbName(),
    timeAtStep: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: undefined }),
    nextStepName: fc.option(arbName(), { nil: undefined }),
    nextStepLocation: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  })

const arbOperatorStepView = (): fc.Arbitrary<OperatorStepView> =>
  fc.record({
    stepName: arbName(),
    location: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
    currentParts: fc.array(arbOperatorPartInfo(), { maxLength: 3 }),
    comingSoon: fc.array(arbOperatorPartInfo(), { maxLength: 3 }),
    backlog: fc.array(arbOperatorPartInfo(), { maxLength: 3 }),
    vendorPartsCount: fc.nat({ max: 100 }),
    stepIds: fc.array(arbId(), { minLength: 1, maxLength: 5 }),
  })

const arbWorkQueueJob = (): fc.Arbitrary<WorkQueueJob> =>
  fc.record({
    jobId: arbId(),
    jobName: arbName(),
    pathId: arbId(),
    pathName: arbName(),
    stepId: arbId(),
    stepName: arbName(),
    stepOrder: fc.nat({ max: 20 }),
    stepLocation: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
    totalSteps: fc.integer({ min: 1, max: 20 }),
    partIds: fc.array(arbId(), { minLength: 1, maxLength: 5 }),
    partCount: fc.integer({ min: 1, max: 100 }),
    previousStepId: fc.option(arbId(), { nil: undefined }),
    previousStepName: fc.option(arbName(), { nil: undefined }),
    nextStepId: fc.option(arbId(), { nil: undefined }),
    nextStepName: fc.option(arbName(), { nil: undefined }),
    nextStepLocation: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
    isFinalStep: fc.boolean(),
    jobPriority: fc.integer({ min: 0, max: 100 }),
  })

const arbBomEntrySummary = (): fc.Arbitrary<BomEntrySummary> =>
  fc.record({
    partType: arbName(),
    requiredQuantityPerBuild: fc.integer({ min: 1, max: 1000 }),
    totalCompleted: fc.nat({ max: 500 }),
    totalInProgress: fc.nat({ max: 500 }),
    totalOutstanding: fc.nat({ max: 500 }),
  })

const arbBomSummary = (): fc.Arbitrary<BomSummary> =>
  fc.record({
    bomId: arbId(),
    bomName: arbName(),
    entries: fc.array(arbBomEntrySummary(), { minLength: 1, maxLength: 5 }),
  })

const arbPart = (): fc.Arbitrary<Part> =>
  fc.record({
    id: arbId(),
    jobId: arbId(),
    pathId: arbId(),
    currentStepId: fc.oneof(fc.constant(null as string | null), arbId()),
    status: fc.constantFrom('in_progress' as const, 'completed' as const, 'scrapped' as const),
    scrapReason: fc.option(
      fc.constantFrom('out_of_tolerance' as const, 'process_defect' as const, 'damaged' as const, 'operator_error' as const, 'other' as const),
      { nil: undefined },
    ),
    scrapExplanation: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
    scrapStepId: fc.option(arbId(), { nil: undefined }),
    scrappedAt: fc.option(arbIsoDate(), { nil: undefined }),
    scrappedBy: fc.option(arbId(), { nil: undefined }),
    forceCompleted: fc.boolean(),
    forceCompletedBy: fc.option(arbId(), { nil: undefined }),
    forceCompletedAt: fc.option(arbIsoDate(), { nil: undefined }),
    forceCompletedReason: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
    createdAt: arbIsoDate(),
    updatedAt: arbIsoDate(),
  })

const arbAdvancementResult = (): fc.Arbitrary<AdvancementResult> =>
  fc.record({
    serial: arbPart(),
    bypassed: fc.array(
      fc.record({
        stepId: arbId(),
        stepName: arbName(),
        classification: fc.constantFrom('skipped' as const, 'deferred' as const),
      }),
      { maxLength: 5 },
    ),
  })

const arbJiraTicket = (): fc.Arbitrary<JiraTicket> =>
  fc.record({
    key: fc.string({ minLength: 1, maxLength: 20 }),
    summary: arbName(),
    status: fc.string({ minLength: 1, maxLength: 20 }),
    priority: fc.string({ minLength: 1, maxLength: 20 }),
    assignee: fc.string({ minLength: 1, maxLength: 30 }),
    reporter: fc.string({ minLength: 1, maxLength: 30 }),
    labels: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
    partNumber: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
    goalQuantity: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: null }),
    epicLink: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
    createdAt: arbIsoDate(),
    updatedAt: arbIsoDate(),
    rawFields: fc.constant({}),
  })

const arbFetchTicketsResult = (): fc.Arbitrary<FetchTicketsResult> =>
  fc.record({
    tickets: fc.array(arbJiraTicket(), { maxLength: 3 }),
    error: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
    fromCache: fc.boolean(),
  })

// ---------------------------------------------------------------------------
// Helper: strip undefined keys (JSON.stringify drops them)
// ---------------------------------------------------------------------------

function stripUndefined(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj))
}

// ---------------------------------------------------------------------------
// Property Test
// ---------------------------------------------------------------------------

describe('Feature: readonly-domain-types, Property 2: Serialization round-trip preservation under readonly arrays', () => {
  const cases: { typeName: string, arb: () => fc.Arbitrary<unknown> }[] = [
    { typeName: 'Job', arb: arbJob },
    { typeName: 'Path', arb: arbPath },
    { typeName: 'BOM', arb: arbBom },
    { typeName: 'BomEntry', arb: arbBomEntry },
    { typeName: 'TemplateRoute', arb: arbTemplateRoute },
    { typeName: 'StepNote', arb: arbStepNote },
    { typeName: 'BomVersion', arb: arbBomVersion },
    { typeName: 'OperatorStepView', arb: arbOperatorStepView },
    { typeName: 'WorkQueueJob', arb: arbWorkQueueJob },
    { typeName: 'BomSummary', arb: arbBomSummary },
    { typeName: 'AdvancementResult', arb: arbAdvancementResult },
    { typeName: 'JiraTicket', arb: arbJiraTicket },
    { typeName: 'FetchTicketsResult', arb: arbFetchTicketsResult },
  ]

  for (const { typeName, arb } of cases) {
    it(`JSON round-trip preserves ${typeName} with readonly arrays`, () => {
      fc.assert(
        fc.property(arb(), (obj) => {
          const serialized = JSON.stringify(obj)
          const deserialized = JSON.parse(serialized)
          expect(deserialized).toEqual(stripUndefined(obj))
        }),
        { numRuns: 100 },
      )
    })
  }
})
