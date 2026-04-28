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
} from '~/server/schemas/partSchemas'
import { createCertSchema, batchAttachCertSchema } from '~/server/schemas/certSchemas'
import {
  createTemplateSchema,
  updateTemplateSchema,
  applyTemplateSchema,
} from '~/server/schemas/templateSchemas'
import { createUserSchema, updateUserSchema } from '~/server/schemas/userSchemas'
import { updateSettingsSchema } from '~/server/schemas/settingsSchemas'
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
    // Create a fresh context so we control the exact job count
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
  let _stepId: string

  beforeAll(() => {
    const job = ctx.jobService.createJob({ name: 'Part Test Job', goalQuantity: 100 })
    jobId = job.id
    const path = ctx.pathService.createPath({
      jobId,
      name: 'Route A',
      goalQuantity: 100,
      steps: [{ name: 'Step 1' }, { name: 'Step 2' }],
    })
    pathId = path.id
    _stepId = path.steps[0].id
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
    // The schema output + userId is what the route passes to the service
    // Part starts at step[0], advancing to step[1] should work
    const result = ctx.lifecycleService.advanceToStep(part.id, { ...body, userId: 'user_1' })
    expect(result.serial).toBeDefined()
  })

  it('attachCertSchema output is accepted (certId field matches service expectation)', () => {
    const body = parse(attachCertSchema, { certId: 'cert_123' })
    expect(body.certId).toBe('cert_123')
    // The route handler uses body.certId to call certService.attachCertToSerial
    // We just verify the schema output shape is correct
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
    // Service now resolves step IDs internally — no route-level workaround needed
    const attachments = ctx.certService.batchAttachCert({ ...body, userId: 'user_1' })
    expect(attachments).toHaveLength(2)
    expect(attachments[0].stepId).toBe(path.steps[0].id)
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

// ── Users ──

describe('User schemas → userService', () => {
  it('createUserSchema output is accepted by userService.createUser', () => {
    const body = parse(createUserSchema, {
      username: 'jdoe',
      displayName: 'John Doe',
      isAdmin: false,
    })
    const userService = createUserService({ users: ctx.repos.users })
    const user = userService.createUser(body)
    expect(user.username).toBe('jdoe')
    expect(user.displayName).toBe('John Doe')
  })

  it('createUserSchema with isAdmin=true is accepted', () => {
    const body = parse(createUserSchema, {
      username: 'admin1',
      displayName: 'Admin User',
      isAdmin: true,
    })
    const userService = createUserService({ users: ctx.repos.users })
    const user = userService.createUser(body)
    expect(user.isAdmin).toBe(true)
  })

  it('updateUserSchema output is accepted by userService.updateUser', () => {
    const userService = createUserService({ users: ctx.repos.users })
    const user = userService.createUser({ username: 'update_test', displayName: 'Before' })
    const body = parse(updateUserSchema, { displayName: 'After', isAdmin: true })
    const updated = userService.updateUser(user.id, body)
    expect(updated.displayName).toBe('After')
    expect(updated.isAdmin).toBe(true)
  })
})

// ── Settings ──

describe('Settings schema → settingsService', () => {
  it('updateSettingsSchema output is accepted by settingsService.updateSettings', () => {
    const settingsRepo = new SQLiteSettingsRepository(ctx.db)
    const settingsService = createSettingsService(
      { settings: settingsRepo },
      { jiraBaseUrl: '', jiraProjectKey: 'PI', jiraUsername: '', jiraApiToken: '' },
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
      { jiraBaseUrl: '', jiraProjectKey: 'PI', jiraUsername: '', jiraApiToken: '' },
    )
    const body = parse(updateSettingsSchema, {
      jiraConnection: { enabled: true, baseUrl: 'https://jira.example.com' },
    })
    const result = settingsService.updateSettings(body)
    expect(result.jiraConnection.enabled).toBe(true)
  })
})
