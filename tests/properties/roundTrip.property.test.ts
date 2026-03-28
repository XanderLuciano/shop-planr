/**
 * Property 5: Domain Object Round-Trip Serialization
 *
 * For all valid domain objects, `deserialize(serialize(obj))` produces an equivalent object.
 * Also `deserialize(prettyPrint(obj))` round-trips correctly.
 * No data is lost or corrupted during serialization cycles.
 *
 * **Validates: Requirements 12.1, 12.2, 12.3, 12.5**
 */
import { describe, it } from 'vitest'
import fc from 'fast-check'
import { serialize, deserialize, prettyPrint } from '../../server/utils/serialization'
import type {
  Job, Path, ProcessStep, Part, Certificate,
  CertAttachment, TemplateRoute, TemplateStep, BOM, BomEntry,
  AuditEntry, ShopUser, StepNote, AppSettings, JiraConnectionSettings,
  JiraFieldMapping
} from '../../server/types/domain'

// ---- Arbitraries for domain objects ----

const arbId = () => fc.stringMatching(/^[a-zA-Z0-9_-]{5,20}$/)
const arbIsoDate = () =>
  fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-01-01').getTime() })
    .map(ts => new Date(ts).toISOString())
const arbName = () => fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)

const arbProcessStep = (): fc.Arbitrary<ProcessStep> =>
  fc.record({
    id: arbId(),
    name: arbName(),
    order: fc.nat({ max: 20 }),
    location: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined })
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
    updatedAt: arbIsoDate()
  })

const arbPath = (): fc.Arbitrary<Path> =>
  fc.record({
    id: arbId(),
    jobId: arbId(),
    name: arbName(),
    goalQuantity: fc.integer({ min: 1, max: 10000 }),
    steps: fc.array(arbProcessStep(), { minLength: 1, maxLength: 5 }),
    createdAt: arbIsoDate(),
    updatedAt: arbIsoDate()
  })

const arbPart = (): fc.Arbitrary<Part> =>
  fc.record({
    id: arbId(),
    jobId: arbId(),
    pathId: arbId(),
    currentStepIndex: fc.integer({ min: -1, max: 20 }),
    createdAt: arbIsoDate(),
    updatedAt: arbIsoDate()
  })

const arbCertificate = (): fc.Arbitrary<Certificate> =>
  fc.record({
    id: arbId(),
    type: fc.constantFrom('material' as const, 'process' as const),
    name: arbName(),
    createdAt: arbIsoDate()
  })

const arbCertAttachment = (): fc.Arbitrary<CertAttachment> =>
  fc.record({
    partId: arbId(),
    certId: arbId(),
    stepId: arbId(),
    attachedAt: arbIsoDate(),
    attachedBy: arbId()
  })

const arbTemplateStep = (): fc.Arbitrary<TemplateStep> =>
  fc.record({
    name: arbName(),
    order: fc.nat({ max: 20 }),
    location: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined })
  })

const arbTemplateRoute = (): fc.Arbitrary<TemplateRoute> =>
  fc.record({
    id: arbId(),
    name: arbName(),
    steps: fc.array(arbTemplateStep(), { minLength: 1, maxLength: 5 }),
    createdAt: arbIsoDate(),
    updatedAt: arbIsoDate()
  })

const arbBomEntry = (): fc.Arbitrary<BomEntry> =>
  fc.record({
    partType: arbName(),
    requiredQuantityPerBuild: fc.integer({ min: 1, max: 1000 }),
    contributingJobIds: fc.array(arbId(), { maxLength: 5 })
  })

const arbBom = (): fc.Arbitrary<BOM> =>
  fc.record({
    id: arbId(),
    name: arbName(),
    entries: fc.array(arbBomEntry(), { minLength: 1, maxLength: 5 }),
    createdAt: arbIsoDate(),
    updatedAt: arbIsoDate()
  })

const arbAuditEntry = (): fc.Arbitrary<AuditEntry> =>
  fc.record({
    id: arbId(),
    action: fc.constantFrom(
      'cert_attached' as const,
      'part_created' as const,
      'part_advanced' as const,
      'part_completed' as const,
      'note_created' as const
    ),
    userId: arbId(),
    timestamp: arbIsoDate(),
    partId: fc.option(arbId(), { nil: undefined }),
    certId: fc.option(arbId(), { nil: undefined }),
    jobId: fc.option(arbId(), { nil: undefined }),
    pathId: fc.option(arbId(), { nil: undefined }),
    stepId: fc.option(arbId(), { nil: undefined }),
    fromStepId: fc.option(arbId(), { nil: undefined }),
    toStepId: fc.option(arbId(), { nil: undefined }),
    batchQuantity: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined })
  })

const arbShopUser = (): fc.Arbitrary<ShopUser> =>
  fc.record({
    id: arbId(),
    name: arbName(),
    department: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
    active: fc.boolean(),
    createdAt: arbIsoDate()
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
    jiraCommentId: fc.option(arbId(), { nil: undefined })
  })

const arbJiraConnectionSettings = (): fc.Arbitrary<JiraConnectionSettings> =>
  fc.record({
    baseUrl: fc.string({ minLength: 1, maxLength: 50 }),
    projectKey: fc.string({ minLength: 1, maxLength: 10 }),
    username: fc.string({ minLength: 1, maxLength: 30 }),
    apiToken: fc.string({ minLength: 1, maxLength: 50 }),
    enabled: fc.boolean(),
    pushEnabled: fc.boolean()
  })

const arbJiraFieldMapping = (): fc.Arbitrary<JiraFieldMapping> =>
  fc.record({
    id: arbId(),
    jiraFieldId: fc.string({ minLength: 1, maxLength: 30 }),
    label: arbName(),
    shopErpField: fc.string({ minLength: 1, maxLength: 30 }),
    isDefault: fc.boolean()
  })

const arbAppSettings = (): fc.Arbitrary<AppSettings> =>
  fc.record({
    id: arbId(),
    jiraConnection: arbJiraConnectionSettings(),
    jiraFieldMappings: fc.array(arbJiraFieldMapping(), { maxLength: 5 }),
    updatedAt: arbIsoDate()
  })

// ---- Helper: strip undefined keys for comparison ----
// JSON.stringify drops undefined values, so round-tripped objects won't have them.
function stripUndefined(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj))
}

// ---- Tests ----

describe('Property 5: Domain Object Round-Trip Serialization', () => {
  const cases: Array<{ typeName: string, arb: () => fc.Arbitrary<unknown>, domainType: string }> = [
    { typeName:
'Job', arb: arbJob, domainType: 'Job' },
    { typeName: 'Path', arb: arbPath, domainType: 'Path' },
    { typeName: 'ProcessStep', arb: arbProcessStep, domainType: 'ProcessStep' },
    { typeName: 'Part', arb: arbPart, domainType: 'Part' },
    { typeName: 'Certificate', arb: arbCertificate, domainType: 'Certificate' },
    { typeName: 'CertAttachment', arb: arbCertAttachment, domainType: 'CertAttachment' },
    { typeName: 'TemplateRoute', arb: arbTemplateRoute, domainType: 'TemplateRoute' },
    { typeName: 'TemplateStep', arb: arbTemplateStep, domainType: 'TemplateStep' },
    { typeName: 'BOM', arb: arbBom, domainType: 'BOM' },
    { typeName: 'BomEntry', arb: arbBomEntry, domainType: 'BomEntry' },
    { typeName: 'AuditEntry', arb: arbAuditEntry, domainType: 'AuditEntry' },
    { typeName: 'ShopUser', arb: arbShopUser, domainType: 'ShopUser' },
    { typeName: 'StepNote', arb: arbStepNote, domainType: 'StepNote' },
    { typeName: 'AppSettings', arb: arbAppSettings, domainType: 'AppSettings' },
    { typeName: 'JiraConnectionSettings', arb: arbJiraConnectionSettings, domainType: 'JiraConnectionSettings' },
    { typeName: 'JiraFieldMapping', arb: arbJiraFieldMapping, domainType: 'JiraFieldMapping' }
  ]

  for (const { typeName, arb, domainType } of cases) {
    it(`serialize → deserialize round-trip for ${typeName}`, () => {
      fc.assert(
        fc.property(arb(), (obj) => {
          const json = serialize(obj)
          const result = deserialize(json, domainType as any)
          expect(result).toEqual(stripUndefined(obj))
        }),
        { numRuns: 100 }
      )
    })

    it(`prettyPrint → deserialize round-trip for ${typeName}`, () => {
      fc.assert(
        fc.property(arb(), (obj) => {
          const json = prettyPrint(obj)
          const result = deserialize(json, domainType as any)
          expect(result).toEqual(stripUndefined(obj))
        }),
        { numRuns: 100 }
      )
    })
  }
})
