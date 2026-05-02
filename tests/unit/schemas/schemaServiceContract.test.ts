/**
 * Schema ↔ Service contract tests.
 *
 * Each test parses a valid payload through the Zod schema used by an API route,
 * then passes the result to the corresponding service method. This catches
 * mismatches where a schema requires/omits fields the service doesn't expect
 * (like the stepId bug in batchAttachCertSchema).
 *
 * Uses real service instances backed by in-memory SQLite — no mocking.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestContext, type TestContext } from '../../integration/helpers'
import { createJobSchema, updateJobSchema, updatePrioritiesSchema } from '~/server/schemas/jobSchemas'
import {
  createPartsSchema,
  scrapPartSchema,
  forceCompleteSchema,
  advanceToStepSchema,
  attachCertSchema,
  batchAdvanceSchema,
  batchAdvanceToSchema,
  batchStepStatusesSchema,
  createOverrideSchema,
  waiveStepSchema,
} from '~/server/schemas/partSchemas'
import { createCertSchema, batchAttachCertSchema } from '~/server/schemas/certSchemas'
import {
  createTemplateSchema,
  updateTemplateSchema,
  applyTemplateSchema,
} from '~/server/schemas/templateSchemas'
import { createUserSchema, updateUserSchema } from '~/server/schemas/userSchemas'
import { updateSettingsSchema } from '~/server/schemas/settingsSchemas'
import {
  createPathSchema,
  updatePathSchema,
  updateAdvancementModeSchema,
  batchDistributionsSchema,
  batchPathOperationsSchema,
  assignStepSchema,
  updateStepConfigSchema,
} from '~/server/schemas/pathSchemas'
import { createBomSchema, updateBomSchema, editBomSchema } from '~/server/schemas/bomSchemas'
import { loginSchema, setupPinSchema, resetPinSchema } from '~/server/schemas/authSchemas'
import { pushJiraCommentSchema, linkJiraTicketSchema, jiraPushSchema } from '~/server/schemas/jiraSchemas'
import { createTagSchema, updateTagSchema, setJobTagsSchema } from '~/server/schemas/tagSchemas'
import { createNoteSchema } from '~/server/schemas/noteSchemas'
import { addLibraryEntrySchema } from '~/server/schemas/librarySchemas'
import {
  queueEventSchema,
} from '~/server/schemas/webhookSchemas'
import { WEBHOOK_PAYLOAD_SCHEMAS } from '~/server/schemas/webhookPayloadSchemas'
import { WEBHOOK_EVENT_TYPES } from '~/server/types/domain'
import { buildTestPayload } from '~/server/utils/webhookTestData'
import { createUserService } from '~/server/services/userService'
import { createSettingsService } from '~/server/services/settingsService'
import { SQLiteSettingsRepository } from '~/server/repositories/sqlite/settingsRepository'

let ctx: TestContext

beforeAll(() => {
  ctx = createTestContext()
})
afterAll(() => {
  ctx.cleanup()
})

/**
 * Helper: parse payload through schema, assert success, return typed data.
 */
function parse<T>(schema: { safeParse: (v: unknown) => { success: boolean, data?: T, error?: unknown } }, payload: unknown): T {
  const result = schema.safeParse(payload)
  expect(result.success, `Schema parse failed: ${JSON.stringify(result.error)}`).toBe(true)
  return result.data as T
}

// ── Jobs ──

describe('Job schemas → jobService', () => {
  it('createJobSchema output is accepted by jobService.createJob', () => {
    const body = parse(createJobSchema, { name: 'Test Job', goalQuantity: 10 })
    const job = ctx.jobService.createJob(body)
    expect(job.name).toBe('Test Job')
    expect(job.goalQuantity).toBe(10)
  })

  it('createJobSchema with Jira fields is accepted', () => {
    const body = parse(createJobSchema, {
      name: 'Jira Job',
      goalQuantity: 5,
      jiraTicketKey: 'PI-123',
      jiraTicketSummary: 'Summary',
      jiraPartNumber: 'PN-001',
      jiraPriority: 'High',
      jiraEpicLink: 'PI-1',
      jiraLabels: ['urgent', 'machining'],
    })
    const job = ctx.jobService.createJob(body)
    expect(job.jiraTicketKey).toBe('PI-123')
  })

  it('updateJobSchema output is accepted by jobService.updateJob', () => {
    const job = ctx.jobService.createJob({ name: 'Original', goalQuantity: 5 })
    const body = parse(updateJobSchema, { name: 'Updated', goalQuantity: 20 })
    const updated = ctx.jobService.updateJob(job.id, body)
    expect(updated.name).toBe('Updated')
    expect(updated.goalQuantity).toBe(20)
  })

  it('updatePrioritiesSchema output is accepted by jobService.updatePriorities', () => {
    const freshCtx = createTestContext()
    const a = freshCtx.jobService.createJob({ name: 'A', goalQuantity: 10 })
    const b = freshCtx.jobService.createJob({ name: 'B', goalQuantity: 10 })
    const body = parse(updatePrioritiesSchema, {
      priorities: [
        { jobId: a.id, priority: 1 },
        { jobId: b.id, priority: 2 },
      ],
    })
    const result = freshCtx.jobService.updatePriorities(body)
    expect(result.length).toBeGreaterThanOrEqual(2)
    freshCtx.cleanup()
  })
})

// ── Parts ──

describe('Part schemas → partService / lifecycleService', () => {
  let jobId: string
  let pathId: string

  beforeAll(() => {
    const job = ctx.jobService.createJob({ name: 'Part Test Job', goalQuantity: 100 })
    jobId = job.id
    const path = ctx.pathService.createPath({
      jobId,
      name: 'Route A',
      goalQuantity: 100,
      steps: [{ name: 'Step 1' }, { name: 'Step 2' }, { name: 'Step 3' }],
    })
    pathId = path.id
  })

  it('createPartsSchema output is accepted by partService.batchCreateParts', () => {
    const body = parse(createPartsSchema, { jobId, pathId, quantity: 3 })
    const parts = ctx.partService.batchCreateParts(body, 'user_1')
    expect(parts).toHaveLength(3)
  })

  it('createPartsSchema with certId is accepted', () => {
    const cert = ctx.certService.createCert({ type: 'material', name: 'Test Cert' })
    const body = parse(createPartsSchema, { jobId, pathId, quantity: 1, certId: cert.id })
    const parts = ctx.partService.batchCreateParts(body, 'user_1')
    expect(parts).toHaveLength(1)
  })

  it('scrapPartSchema output is accepted by lifecycleService.scrapPart', () => {
    const [part] = ctx.partService.batchCreateParts({ jobId, pathId, quantity: 1 }, 'user_1')
    const body = parse(scrapPartSchema, { reason: 'damaged' })
    const scrapped = ctx.lifecycleService.scrapPart(part.id, { ...body, userId: 'user_1' })
    expect(scrapped.status).toBe('scrapped')
  })

  it('scrapPartSchema with explanation is accepted', () => {
    const [part] = ctx.partService.batchCreateParts({ jobId, pathId, quantity: 1 }, 'user_1')
    const body = parse(scrapPartSchema, { reason: 'other', explanation: 'Dropped on floor' })
    const scrapped = ctx.lifecycleService.scrapPart(part.id, { ...body, userId: 'user_1' })
    expect(scrapped.scrapReason).toBe('other')
  })

  it('forceCompleteSchema output is accepted by lifecycleService.forceComplete', () => {
    const [part] = ctx.partService.batchCreateParts({ jobId, pathId, quantity: 1 }, 'user_1')
    const body = parse(forceCompleteSchema, { reason: 'Customer approved' })
    const completed = ctx.lifecycleService.forceComplete(part.id, { ...body, userId: 'user_1' })
    expect(completed.status).toBe('completed')
  })

  it('forceCompleteSchema with empty body is accepted', () => {
    const [part] = ctx.partService.batchCreateParts({ jobId, pathId, quantity: 1 }, 'user_1')
    const body = parse(forceCompleteSchema, {})
    const completed = ctx.lifecycleService.forceComplete(part.id, { ...body, userId: 'user_1' })
    expect(completed.forceCompleted).toBe(true)
  })

  it('advanceToStepSchema output is accepted by lifecycleService.advanceToStep', () => {
    const [part] = ctx.partService.batchCreateParts({ jobId, pathId, quantity: 1 }, 'user_1')
    const path = ctx.pathService.getPath(pathId)
    const body = parse(advanceToStepSchema, { targetStepId: path.steps[1].id })
    const result = ctx.lifecycleService.advanceToStep(part.id, { ...body, userId: 'user_1' })
    expect(result.serial).toBeDefined()
  })

  it('attachCertSchema output shape matches route usage', () => {
    const body = parse(attachCertSchema, { certId: 'cert_123' })
    expect(body.certId).toBe('cert_123')
  })

  it('batchAdvanceSchema output is accepted by partService.batchAdvanceParts', () => {
    const parts = ctx.partService.batchCreateParts({ jobId, pathId, quantity: 2 }, 'user_1')
    const body = parse(batchAdvanceSchema, { partIds: parts.map(p => p.id) })
    const results = ctx.partService.batchAdvanceParts(body.partIds, 'user_1')
    expect(results.advanced).toBe(2)
  })

  it('batchAdvanceToSchema output is accepted by lifecycleService.advanceToStep (per-part loop)', () => {
    const parts = ctx.partService.batchCreateParts({ jobId, pathId, quantity: 2 }, 'user_1')
    const path = ctx.pathService.getPath(pathId)
    const body = parse(batchAdvanceToSchema, {
      partIds: parts.map(p => p.id),
      targetStepId: path.steps[1].id,
    })
    // Route loops over partIds calling lifecycleService.advanceToStep per part
    for (const partId of body.partIds) {
      const result = ctx.lifecycleService.advanceToStep(partId, {
        targetStepId: body.targetStepId,
        skip: body.skip,
        userId: 'user_1',
      })
      expect(result.serial).toBeDefined()
    }
  })

  it('batchStepStatusesSchema output is accepted by lifecycleService.getStepStatusViews', () => {
    const parts = ctx.partService.batchCreateParts({ jobId, pathId, quantity: 2 }, 'user_1')
    const body = parse(batchStepStatusesSchema, { partIds: parts.map(p => p.id) })
    // Route loops over partIds calling lifecycleService.getStepStatusViews per part
    for (const partId of body.partIds) {
      const views = ctx.lifecycleService.getStepStatusViews(partId)
      expect(views.length).toBeGreaterThan(0)
    }
  })

  it('createOverrideSchema output is accepted by lifecycleService.createStepOverride', () => {
    const parts = ctx.partService.batchCreateParts({ jobId, pathId, quantity: 2 }, 'user_1')
    const path = ctx.pathService.getPath(pathId)
    const body = parse(createOverrideSchema, {
      partIds: parts.map(p => p.id),
      stepId: path.steps[1].id,
      reason: 'Customer waiver',
    })
    // Route uses: body.partIds || body.serialIds!
    const overrides = ctx.lifecycleService.createStepOverride(
      body.partIds || body.serialIds!,
      body.stepId,
      body.reason,
      'user_1',
    )
    expect(overrides.length).toBeGreaterThan(0)
  })

  it('createOverrideSchema with legacy serialIds is accepted', () => {
    const parts = ctx.partService.batchCreateParts({ jobId, pathId, quantity: 1 }, 'user_1')
    const path = ctx.pathService.getPath(pathId)
    const body = parse(createOverrideSchema, {
      serialIds: parts.map(p => p.id),
      stepId: path.steps[2].id,
      reason: 'Legacy compat',
    })
    const overrides = ctx.lifecycleService.createStepOverride(
      body.partIds || body.serialIds!,
      body.stepId,
      body.reason,
      'user_1',
    )
    expect(overrides.length).toBe(1)
  })

  it('waiveStepSchema output is accepted by lifecycleService.waiveStep', () => {
    // Need a flexible path so we can skip ahead to create a deferred step
    const flexPath = ctx.pathService.createPath({
      jobId,
      name: 'Flex Route',
      goalQuantity: 10,
      advancementMode: 'flexible',
      steps: [{ name: 'F1' }, { name: 'F2' }, { name: 'F3' }],
    })
    const [part] = ctx.partService.batchCreateParts({ jobId, pathId: flexPath.id, quantity: 1 }, 'user_1')
    // Advance to step 3, skipping step 2 — step 2 becomes deferred (required)
    ctx.lifecycleService.advanceToStep(part.id, {
      targetStepId: flexPath.steps[2].id,
      skip: true,
      userId: 'user_1',
    })
    // Step 1 (F2) is now deferred — waive it
    const body = parse(waiveStepSchema, { reason: 'Approved by QA' })
    // Route passes: { ...body, approverId: userId }
    const result = ctx.lifecycleService.waiveStep(part.id, flexPath.steps[1].id, {
      ...body,
      approverId: 'user_1',
    })
    expect(result.status).toBe('waived')
  })
})

// ── Certificates ──

describe('Cert schemas → certService', () => {
  it('createCertSchema output is accepted by certService.createCert', () => {
    const body = parse(createCertSchema, { type: 'material', name: 'Steel Cert' })
    const cert = ctx.certService.createCert(body)
    expect(cert.name).toBe('Steel Cert')
    expect(cert.type).toBe('material')
  })

  it('createCertSchema with metadata is accepted', () => {
    const body = parse(createCertSchema, {
      type: 'process',
      name: 'Heat Treat',
      metadata: { temperature: 1200, duration: '2h' },
    })
    const cert = ctx.certService.createCert(body)
    expect(cert.metadata).toEqual({ temperature: 1200, duration: '2h' })
  })

  it('batchAttachCertSchema output is accepted by certService.batchAttachCert', () => {
    const cert = ctx.certService.createCert({ type: 'material', name: 'Batch Cert' })
    const job = ctx.jobService.createJob({ name: 'Cert Job', goalQuantity: 10 })
    const path = ctx.pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 10,
      steps: [{ name: 'S1' }],
    })
    const parts = ctx.partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 2 },
      'user_1',
    )
    const body = parse(batchAttachCertSchema, {
      certId: cert.id,
      partIds: parts.map(p => p.id),
    })
    const attachments = ctx.certService.batchAttachCert({ ...body, userId: 'user_1' })
    expect(attachments).toHaveLength(2)
    expect(attachments[0].stepId).toBe(path.steps[0].id)
  })
})

// ── Paths ──

describe('Path schemas → pathService', () => {
  let jobId: string

  beforeAll(() => {
    const job = ctx.jobService.createJob({ name: 'Path Test Job', goalQuantity: 50 })
    jobId = job.id
  })

  it('createPathSchema output is accepted by pathService.createPath', () => {
    const body = parse(createPathSchema, {
      jobId,
      name: 'Main Route',
      goalQuantity: 50,
      steps: [{ name: 'Cut' }, { name: 'Weld', location: 'Bay 3' }],
    })
    const path = ctx.pathService.createPath(body)
    expect(path.name).toBe('Main Route')
    expect(path.steps).toHaveLength(2)
  })

  it('createPathSchema with all step options is accepted', () => {
    const body = parse(createPathSchema, {
      jobId,
      name: 'Full Options',
      goalQuantity: 10,
      advancementMode: 'flexible',
      steps: [{
        name: 'Inspect',
        location: 'QC Lab',
        optional: true,
        dependencyType: 'completion_gate',
      }],
    })
    const path = ctx.pathService.createPath(body)
    expect(path.advancementMode).toBe('flexible')
    expect(path.steps[0].optional).toBe(true)
    expect(path.steps[0].dependencyType).toBe('completion_gate')
  })

  it('updatePathSchema output is accepted by pathService.updatePath', () => {
    const path = ctx.pathService.createPath({
      jobId,
      name: 'Before',
      goalQuantity: 10,
      steps: [{ name: 'S1' }],
    })
    const body = parse(updatePathSchema, { name: 'After', goalQuantity: 20 })
    const updated = ctx.pathService.updatePath(path.id, body)
    expect(updated.name).toBe('After')
    expect(updated.goalQuantity).toBe(20)
  })

  it('updateAdvancementModeSchema output is accepted by pathService.updatePath', () => {
    const path = ctx.pathService.createPath({
      jobId,
      name: 'Mode Test',
      goalQuantity: 10,
      steps: [{ name: 'S1' }],
    })
    const body = parse(updateAdvancementModeSchema, { advancementMode: 'per_step' })
    // Route calls: pathService.updatePath(id, { advancementMode: body.advancementMode })
    const updated = ctx.pathService.updatePath(path.id, { advancementMode: body.advancementMode })
    expect(updated.advancementMode).toBe('per_step')
  })

  it('batchDistributionsSchema output is accepted by pathService.getStepDistribution', () => {
    const path = ctx.pathService.createPath({
      jobId,
      name: 'Dist Test',
      goalQuantity: 10,
      steps: [{ name: 'S1' }],
    })
    const body = parse(batchDistributionsSchema, { pathIds: [path.id] })
    // Route loops over pathIds
    for (const pathId of body.pathIds) {
      const dist = ctx.pathService.getStepDistribution(pathId)
      expect(dist).toBeDefined()
      const count = ctx.pathService.getPathCompletedCount(pathId)
      expect(count).toBe(0)
    }
  })

  it('assignStepSchema output is accepted by pathService.assignStep', () => {
    const path = ctx.pathService.createPath({
      jobId,
      name: 'Assign Test',
      goalQuantity: 10,
      steps: [{ name: 'S1' }],
    })
    // Assign null (unassign)
    const body = parse(assignStepSchema, { userId: null })
    const step = ctx.pathService.assignStep(path.steps[0].id, body.userId)
    expect(step.assignedTo).toBeUndefined()
  })

  it('updateStepConfigSchema output is accepted by pathService.updateStep', () => {
    const path = ctx.pathService.createPath({
      jobId,
      name: 'Config Test',
      goalQuantity: 10,
      steps: [{ name: 'S1' }],
    })
    const body = parse(updateStepConfigSchema, {
      optional: true,
      dependencyType: 'physical',
      location: 'Bay 5',
    })
    // Route builds partial from body fields
    const update: Record<string, unknown> = {}
    if (typeof body.optional === 'boolean') update.optional = body.optional
    if (typeof body.location === 'string') update.location = body.location.trim() || undefined
    if (body.dependencyType) update.dependencyType = body.dependencyType
    const step = ctx.pathService.updateStep(path.steps[0].id, update)
    expect(step.optional).toBe(true)
    expect(step.dependencyType).toBe('physical')
  })

  it('batchPathOperationsSchema output is accepted by pathService.batchPathOperations', () => {
    const freshCtx = createTestContext()
    const job = freshCtx.jobService.createJob({ name: 'Batch Op Job', goalQuantity: 10 })
    // Create an admin user for delete operations
    const admin = freshCtx.repos.users.create({
      id: 'admin_1',
      username: 'admin_batch',
      displayName: 'Admin',
      isAdmin: true,
      active: true,
      pinHash: null,
      createdAt: new Date().toISOString(),
    })
    const body = parse(batchPathOperationsSchema, {
      create: [{ name: 'New Path', goalQuantity: 10, steps: [{ name: 'S1' }] }],
      update: [],
      delete: [],
    })
    const result = freshCtx.pathService.batchPathOperations({
      jobId: job.id,
      userId: admin.id,
      create: body.create,
      update: body.update,
      delete: body.delete,
    })
    expect(result.created).toHaveLength(1)
    freshCtx.cleanup()
  })
})

// ── Templates ──

describe('Template schemas → templateService', () => {
  it('createTemplateSchema output is accepted by templateService.createTemplate', () => {
    const body = parse(createTemplateSchema, {
      name: 'Standard Route',
      steps: [{ name: 'Machining' }, { name: 'Inspection', location: 'QC Lab' }],
    })
    const tmpl = ctx.templateService.createTemplate(body)
    expect(tmpl.name).toBe('Standard Route')
    expect(tmpl.steps).toHaveLength(2)
  })

  it('updateTemplateSchema output is accepted by templateService.updateTemplate', () => {
    const tmpl = ctx.templateService.createTemplate({
      name: 'Original',
      steps: [{ name: 'S1' }],
    })
    const body = parse(updateTemplateSchema, {
      name: 'Updated',
      steps: [{ name: 'S1' }, { name: 'S2', optional: true, dependencyType: 'preferred' }],
    })
    const updated = ctx.templateService.updateTemplate(tmpl.id, body)
    expect(updated.name).toBe('Updated')
    expect(updated.steps).toHaveLength(2)
  })

  it('applyTemplateSchema output is accepted by templateService.applyTemplate', () => {
    const tmpl = ctx.templateService.createTemplate({
      name: 'Apply Test',
      steps: [{ name: 'S1' }],
    })
    const job = ctx.jobService.createJob({ name: 'Apply Job', goalQuantity: 10 })
    const body = parse(applyTemplateSchema, {
      jobId: job.id,
      goalQuantity: 10,
      pathName: 'Custom Path',
    })
    const path = ctx.templateService.applyTemplate(tmpl.id, body)
    expect(path.name).toBe('Custom Path')
  })
})

// ── BOM ──

describe('BOM schemas → bomService', () => {
  let jobId: string

  beforeAll(() => {
    const job = ctx.jobService.createJob({ name: 'BOM Test Job', goalQuantity: 10 })
    jobId = job.id
  })

  it('createBomSchema output is accepted by bomService.createBom', () => {
    const body = parse(createBomSchema, {
      name: 'Assembly BOM',
      entries: [{ jobId, requiredQuantity: 5 }],
    })
    const bom = ctx.bomService.createBom(body)
    expect(bom.name).toBe('Assembly BOM')
    expect(bom.entries).toHaveLength(1)
    expect(bom.entries[0].requiredQuantity).toBe(5)
  })

  it('createBomSchema with default requiredQuantity is accepted', () => {
    const body = parse(createBomSchema, {
      name: 'Default Qty BOM',
      entries: [{ jobId }],
    })
    const bom = ctx.bomService.createBom(body)
    // Schema defaults requiredQuantity to 1
    expect(bom.entries[0].requiredQuantity).toBe(1)
  })

  it('updateBomSchema output is accepted by bomService.updateBom', () => {
    const bom = ctx.bomService.createBom({
      name: 'Before',
      entries: [{ jobId, requiredQuantity: 1 }],
    })
    const body = parse(updateBomSchema, { name: 'After' })
    const updated = ctx.bomService.updateBom(bom.id, body)
    expect(updated.name).toBe('After')
  })

  it('editBomSchema output is accepted by bomService.editBom', () => {
    const bom = ctx.bomService.createBom({
      name: 'Edit Test',
      entries: [{ jobId, requiredQuantity: 1 }],
    })
    const body = parse(editBomSchema, {
      entries: [{ jobId, requiredQuantity: 10 }],
      changeDescription: 'Increased quantity',
    })
    // Route passes: { ...body, userId }
    const updated = ctx.bomService.editBom(bom.id, { ...body, userId: 'user_1' })
    expect(updated.entries[0].requiredQuantity).toBe(10)
  })
})

// ── Users ──

describe('User schemas → userService', () => {
  it('createUserSchema output is accepted by userService.createUser', () => {
    const body = parse(createUserSchema, {
      username: 'contract_jdoe',
      displayName: 'John Doe',
      isAdmin: false,
    })
    const userService = createUserService({ users: ctx.repos.users })
    const user = userService.createUser(body)
    expect(user.username).toBe('contract_jdoe')
    expect(user.displayName).toBe('John Doe')
  })

  it('createUserSchema with isAdmin=true is accepted', () => {
    const body = parse(createUserSchema, {
      username: 'contract_admin1',
      displayName: 'Admin User',
      isAdmin: true,
    })
    const userService = createUserService({ users: ctx.repos.users })
    const user = userService.createUser(body)
    expect(user.isAdmin).toBe(true)
  })

  it('updateUserSchema output is accepted by userService.updateUser', () => {
    const userService = createUserService({ users: ctx.repos.users })
    const user = userService.createUser({ username: 'contract_update_test', displayName: 'Before' })
    const body = parse(updateUserSchema, { displayName: 'After', isAdmin: true })
    const updated = userService.updateUser(user.id, body)
    expect(updated.displayName).toBe('After')
    expect(updated.isAdmin).toBe(true)
  })
})

// ── Settings ──

const TEST_SETTINGS_RUNTIME_CONFIG = {
  jiraBaseUrl: '',
  jiraProjectKey: 'PI',
  jiraUsername: '',
  jiraApiToken: '',
  n8nBaseUrl: '',
  n8nApiKey: '',
}

describe('Settings schema → settingsService', () => {
  it('updateSettingsSchema output is accepted by settingsService.updateSettings', () => {
    const settingsRepo = new SQLiteSettingsRepository(ctx.db)
    const settingsService = createSettingsService(
      { settings: settingsRepo },
      TEST_SETTINGS_RUNTIME_CONFIG,
    )
    const body = parse(updateSettingsSchema, {
      pageToggles: { jobs: false, audit: true },
    })
    const result = settingsService.updateSettings(body)
    expect(result.pageToggles.jobs).toBe(false)
    expect(result.pageToggles.audit).toBe(true)
  })

  it('updateSettingsSchema with jiraConnection is accepted', () => {
    const settingsRepo = new SQLiteSettingsRepository(ctx.db)
    const settingsService = createSettingsService(
      { settings: settingsRepo },
      TEST_SETTINGS_RUNTIME_CONFIG,
    )
    const body = parse(updateSettingsSchema, {
      jiraConnection: { enabled: true, baseUrl: 'https://jira.example.com' },
    })
    const result = settingsService.updateSettings(body)
    expect(result.jiraConnection.enabled).toBe(true)
  })

  it('updateSettingsSchema with jiraFieldMappings is accepted', () => {
    const settingsRepo = new SQLiteSettingsRepository(ctx.db)
    const settingsService = createSettingsService(
      { settings: settingsRepo },
      TEST_SETTINGS_RUNTIME_CONFIG,
    )
    const body = parse(updateSettingsSchema, {
      jiraFieldMappings: [{
        id: 'map_1',
        jiraFieldId: 'customfield_10900',
        label: 'Goal Quantity',
        shopErpField: 'goalQuantity',
        isDefault: true,
      }],
    })
    const result = settingsService.updateSettings(body)
    expect(result.jiraFieldMappings).toHaveLength(1)
  })
})

// ── Auth ──

describe('Auth schemas → authService', () => {
  it('loginSchema output shape matches authService.login signature', () => {
    const body = parse(loginSchema, { username: 'testuser', pin: '1234' })
    expect(body.username).toBe('testuser')
    expect(body.pin).toBe('1234')
    // authService.login(username, pin) — both strings, matches schema output
  })

  it('setupPinSchema output shape matches authService.setupPin signature', () => {
    const body = parse(setupPinSchema, { userId: 'user_123', pin: '5678' })
    expect(body.userId).toBe('user_123')
    expect(body.pin).toBe('5678')
    // authService.setupPin(userId, pin) — both strings, matches schema output
  })

  it('resetPinSchema output shape matches authService.resetPin signature', () => {
    const body = parse(resetPinSchema, { targetUserId: 'user_456' })
    expect(body.targetUserId).toBe('user_456')
    // authService.resetPin(adminUserId, targetUserId) — string, matches schema output
  })

  it('setupPinSchema → authService.setupPin end-to-end', async () => {
    const freshCtx = createTestContext()
    await freshCtx.authService.ensureKeyPair()
    const user = freshCtx.repos.users.create({
      id: 'pin_test_user',
      username: 'pintest',
      displayName: 'Pin Test',
      isAdmin: false,
      active: true,
      pinHash: null,
      createdAt: new Date().toISOString(),
    })
    const body = parse(setupPinSchema, { userId: user.id, pin: '9999' })
    const token = await freshCtx.authService.setupPin(body.userId, body.pin)
    expect(token).toBeTruthy()
    freshCtx.cleanup()
  })

  it('loginSchema → authService.login end-to-end', async () => {
    const freshCtx = createTestContext()
    await freshCtx.authService.ensureKeyPair()
    const user = freshCtx.repos.users.create({
      id: 'login_test_user',
      username: 'logintest',
      displayName: 'Login Test',
      isAdmin: false,
      active: true,
      pinHash: null,
      createdAt: new Date().toISOString(),
    })
    await freshCtx.authService.setupPin(user.id, '1234')
    const body = parse(loginSchema, { username: 'logintest', pin: '1234' })
    const token = await freshCtx.authService.login(body.username, body.pin)
    expect(token).toBeTruthy()
    freshCtx.cleanup()
  })
})

// ── Notes ──

describe('Note schemas → noteService', () => {
  it('createNoteSchema output is accepted by noteService.createNote', () => {
    const job = ctx.jobService.createJob({ name: 'Note Job', goalQuantity: 10 })
    const path = ctx.pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 10,
      steps: [{ name: 'S1' }],
    })
    const parts = ctx.partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 2 },
      'user_1',
    )
    const body = parse(createNoteSchema, {
      jobId: job.id,
      pathId: path.id,
      stepId: path.steps[0].id,
      partIds: parts.map(p => p.id),
      text: 'Surface defect observed',
    })
    // Route passes: { ...body, userId }
    const note = ctx.noteService.createNote({ ...body, userId: 'user_1' })
    expect(note.text).toBe('Surface defect observed')
    expect(note.partIds).toHaveLength(2)
  })
})

// ── Library ──

describe('Library schemas → libraryService', () => {
  it('addLibraryEntrySchema output is accepted by libraryService.addProcess', () => {
    const body = parse(addLibraryEntrySchema, { name: 'CNC Milling' })
    const entry = ctx.libraryService.addProcess(body.name)
    expect(entry.name).toBe('CNC Milling')
  })

  it('addLibraryEntrySchema output is accepted by libraryService.addLocation', () => {
    const body = parse(addLibraryEntrySchema, { name: 'Bay 7' })
    const entry = ctx.libraryService.addLocation(body.name)
    expect(entry.name).toBe('Bay 7')
  })
})

// ── Tags ──

describe('Tag schemas → tagService / jobService', () => {
  let adminId: string
  let tagService: ReturnType<typeof import('~/server/services/tagService').createTagService>

  beforeAll(async () => {
    const { createTagService } = await import('~/server/services/tagService')
    const { SQLiteTagRepository } = await import('~/server/repositories/sqlite/tagRepository')
    const { SQLiteJobTagRepository } = await import('~/server/repositories/sqlite/jobTagRepository')
    const tagRepo = new SQLiteTagRepository(ctx.db)
    const jobTagRepo = new SQLiteJobTagRepository(ctx.db)
    tagService = createTagService(
      { tags: tagRepo, jobTags: jobTagRepo, jobs: ctx.repos.jobs, users: ctx.repos.users },
      ctx.auditService,
    )
    const admin = ctx.repos.users.create({
      id: 'tag_admin',
      username: 'tag_admin',
      displayName: 'Tag Admin',
      isAdmin: true,
      active: true,
      pinHash: null,
      createdAt: new Date().toISOString(),
    })
    adminId = admin.id
  })

  it('createTagSchema output is accepted by tagService.createTag', () => {
    const body = parse(createTagSchema, { name: 'Urgent', color: '#ef4444' })
    const tag = tagService.createTag(adminId, body)
    expect(tag.name).toBe('Urgent')
    expect(tag.color).toBe('#ef4444')
  })

  it('updateTagSchema output is accepted by tagService.updateTag', () => {
    const tag = tagService.createTag(adminId, { name: 'Rename Me' })
    const body = parse(updateTagSchema, { name: 'Renamed', color: '#22c55e' })
    const updated = tagService.updateTag(adminId, tag.id, body)
    expect(updated.name).toBe('Renamed')
    expect(updated.color).toBe('#22c55e')
  })

  it('setJobTagsSchema output shape matches route usage', () => {
    const body = parse(setJobTagsSchema, { tagIds: ['tag_1', 'tag_2'] })
    expect(body.tagIds).toHaveLength(2)
    // Route calls: jobService.setJobTags(userId, id, body.tagIds)
    // tagIds is string[] — matches the service signature
  })
})

// ── Jira (schema shape validation only — service requires HTTP) ──

describe('Jira schemas → shape validation', () => {
  it('pushJiraCommentSchema output shape matches route usage', () => {
    const body = parse(pushJiraCommentSchema, { jobId: 'job_1', noteId: 'note_1' })
    expect(body.jobId).toBe('job_1')
    expect(body.noteId).toBe('note_1')
  })

  it('pushJiraCommentSchema without noteId is accepted', () => {
    const body = parse(pushJiraCommentSchema, { jobId: 'job_1' })
    expect(body.jobId).toBe('job_1')
    expect(body.noteId).toBeUndefined()
  })

  it('linkJiraTicketSchema output shape matches route usage', () => {
    const body = parse(linkJiraTicketSchema, {
      ticketKey: 'PI-42',
      goalQuantity: 100,
      templateId: 'tmpl_1',
    })
    expect(body.ticketKey).toBe('PI-42')
    expect(body.goalQuantity).toBe(100)
    expect(body.templateId).toBe('tmpl_1')
  })

  it('linkJiraTicketSchema with minimal fields is accepted', () => {
    const body = parse(linkJiraTicketSchema, { ticketKey: 'PI-1' })
    expect(body.ticketKey).toBe('PI-1')
    expect(body.goalQuantity).toBeUndefined()
    expect(body.templateId).toBeUndefined()
  })

  it('jiraPushSchema output shape matches route usage', () => {
    const body = parse(jiraPushSchema, { jobId: 'job_1' })
    expect(body.jobId).toBe('job_1')
  })
})

// ── Schema rejection tests (invalid payloads must fail) ──

describe('Schema rejection — invalid payloads are rejected', () => {
  it('createJobSchema rejects empty name', () => {
    expect(createJobSchema.safeParse({ name: '', goalQuantity: 10 }).success).toBe(false)
  })

  it('createJobSchema rejects zero goalQuantity', () => {
    expect(createJobSchema.safeParse({ name: 'X', goalQuantity: 0 }).success).toBe(false)
  })

  it('createJobSchema rejects negative goalQuantity', () => {
    expect(createJobSchema.safeParse({ name: 'X', goalQuantity: -1 }).success).toBe(false)
  })

  it('createJobSchema rejects fractional goalQuantity', () => {
    expect(createJobSchema.safeParse({ name: 'X', goalQuantity: 1.5 }).success).toBe(false)
  })

  it('createPathSchema rejects empty steps array', () => {
    expect(createPathSchema.safeParse({ jobId: 'j', name: 'P', goalQuantity: 1, steps: [] }).success).toBe(false)
  })

  it('scrapPartSchema rejects invalid reason', () => {
    expect(scrapPartSchema.safeParse({ reason: 'invalid_reason' }).success).toBe(false)
  })

  it('createCertSchema rejects invalid type', () => {
    expect(createCertSchema.safeParse({ type: 'invalid', name: 'X' }).success).toBe(false)
  })

  it('batchAttachCertSchema rejects empty partIds', () => {
    expect(batchAttachCertSchema.safeParse({ certId: 'c', partIds: [] }).success).toBe(false)
  })

  it('loginSchema rejects non-4-digit pin', () => {
    expect(loginSchema.safeParse({ username: 'u', pin: '123' }).success).toBe(false)
    expect(loginSchema.safeParse({ username: 'u', pin: '12345' }).success).toBe(false)
    expect(loginSchema.safeParse({ username: 'u', pin: 'abcd' }).success).toBe(false)
  })

  it('createNoteSchema rejects empty partIds', () => {
    expect(createNoteSchema.safeParse({
      jobId: 'j', pathId: 'p', stepId: 's', partIds: [], text: 'note',
    }).success).toBe(false)
  })

  it('createNoteSchema rejects empty text', () => {
    expect(createNoteSchema.safeParse({
      jobId: 'j', pathId: 'p', stepId: 's', partIds: ['p1'], text: '',
    }).success).toBe(false)
  })

  it('addLibraryEntrySchema rejects empty name', () => {
    expect(addLibraryEntrySchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('createOverrideSchema rejects missing both partIds and serialIds', () => {
    expect(createOverrideSchema.safeParse({ stepId: 's', reason: 'r' }).success).toBe(false)
  })

  it('updateStepConfigSchema rejects empty object', () => {
    expect(updateStepConfigSchema.safeParse({}).success).toBe(false)
  })

  it('batchPathOperationsSchema rejects all-empty operations', () => {
    expect(batchPathOperationsSchema.safeParse({ create: [], update: [], delete: [] }).success).toBe(false)
  })

  // ── Webhook schemas ──

  it('queueEventSchema rejects invalid event type', () => {
    expect(queueEventSchema.safeParse({
      eventType: 'bogus_event',
      payload: {},
      summary: 'test',
    }).success).toBe(false)
  })

  it('queueEventSchema rejects empty summary', () => {
    expect(queueEventSchema.safeParse({
      eventType: 'part_advanced',
      payload: {},
      summary: '',
    }).success).toBe(false)
  })

  it('queueEventSchema rejects missing payload', () => {
    expect(queueEventSchema.safeParse({
      eventType: 'part_advanced',
      summary: 'test',
    }).success).toBe(false)
  })
})

// ── Webhook schemas → webhookService ──

describe('Webhook schemas → webhookService', () => {
  const adminUserId = 'admin-contract-test'

  beforeAll(() => {
    ctx.repos.users.create({
      id: adminUserId,
      username: 'webhook_admin',
      displayName: 'Webhook Admin',
      isAdmin: true,
      active: true,
      createdAt: new Date().toISOString(),
    })
  })

  it('queueEventSchema output is accepted by webhookService.queueEvent', () => {
    const body = parse(queueEventSchema, {
      eventType: 'part_advanced',
      payload: { partId: 'p1', stepId: 's1' },
      summary: 'Part advanced',
    })
    const event = ctx.webhookService.queueEvent(body)
    expect(event.eventType).toBe('part_advanced')
    expect(event.createdAt).toBeTruthy()
  })

  it('all event types are accepted by queueEventSchema', () => {
    for (const eventType of WEBHOOK_EVENT_TYPES) {
      const result = queueEventSchema.safeParse({
        eventType,
        payload: {},
        summary: `Test ${eventType}`,
      })
      expect(result.success, `Expected ${eventType} to be valid`).toBe(true)
    }
  })

  it('buildTestPayload output validates against the payload schema for every event type', () => {
    for (const eventType of WEBHOOK_EVENT_TYPES) {
      const payload = buildTestPayload(eventType)
      const schema = WEBHOOK_PAYLOAD_SCHEMAS[eventType]
      const result = schema.safeParse(payload)
      expect(result.success, `Test payload for ${eventType} failed schema validation: ${JSON.stringify((result as any).error?.flatten?.()?.fieldErrors)}`).toBe(true)
    }
  })

  it('every WEBHOOK_EVENT_TYPES entry has a corresponding payload schema', () => {
    for (const eventType of WEBHOOK_EVENT_TYPES) {
      expect(WEBHOOK_PAYLOAD_SCHEMAS[eventType], `Missing payload schema for ${eventType}`).toBeDefined()
    }
  })
})
