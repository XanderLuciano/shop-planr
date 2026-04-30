/**
 * Route-level wiring tests for webhook API routes.
 *
 * Validates: route handlers correctly forward to webhookService methods,
 * Zod validation is applied on POST/PATCH routes, and query params are parsed.
 * Also validates registration CRUD, delivery status, and event action routes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ValidationError, NotFoundError, ForbiddenError, AuthenticationError } from '~/server/utils/errors'

// Stub auto-imported test data generators
import { buildTestPayload, buildTestSummary } from '~/server/utils/webhookTestData'

// --- Stub Nitro auto-imports ---

vi.stubGlobal('ValidationError', ValidationError)
vi.stubGlobal('NotFoundError', NotFoundError)
vi.stubGlobal('ForbiddenError', ForbiddenError)
vi.stubGlobal('AuthenticationError', AuthenticationError)

const mockWebhookService = {
  queueEvent: vi.fn((input: any) => ({
    id: 'whe_1',
    ...input,
    createdAt: '2024-01-01',
  })),
  listEvents: vi.fn(() => []),
  listEventsWithDeliveries: vi.fn(() => []),
  deleteEvent: vi.fn(),
  clearAllEvents: vi.fn((_userId: string) => 2),
  getQueueStats: vi.fn(() => ({ total: 5 })),
  getEvent: vi.fn((id: string) => ({ id, eventType: 'part_advanced', payload: {}, summary: 'test', createdAt: '2024-01-01' })),
}

const mockWebhookRegistrationService = {
  create: vi.fn((_userId: string, input: any) => ({
    id: 'whr_1',
    ...input,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  })),
  list: vi.fn(() => []),
  update: vi.fn((_userId: string, _id: string, input: any) => ({
    id: 'whr_1',
    name: 'Updated',
    url: 'https://example.com/hook',
    eventTypes: ['part_advanced'],
    ...input,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02',
  })),
  delete: vi.fn(),
}

const mockWebhookDeliveryService = {
  listQueued: vi.fn(() => []),
  batchUpdateStatus: vi.fn(),
  updateStatus: vi.fn((_id: string, status: string, error?: string) => ({
    id: 'whd_1',
    eventId: 'whe_1',
    registrationId: 'whr_1',
    status,
    error,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02',
  })),
  replayEvent: vi.fn((_userId: string, _eventId: string) => []),
  retryFailed: vi.fn((_userId: string, _eventId: string) => []),
}

vi.stubGlobal('getServices', () => ({
  webhookService: mockWebhookService,
  webhookRegistrationService: mockWebhookRegistrationService,
  webhookDeliveryService: mockWebhookDeliveryService,
}))

vi.stubGlobal('getAuthUserId', () => 'user_1')
vi.stubGlobal('sendNoContent', vi.fn())
vi.stubGlobal('buildTestPayload', buildTestPayload)
vi.stubGlobal('buildTestSummary', buildTestSummary)

let currentRouterParam: string | undefined = 'whe_1'
vi.stubGlobal('getRouterParam', (_event: unknown, _name: string) => currentRouterParam)

let currentQuery: Record<string, string> = {}
vi.stubGlobal('getQuery', () => currentQuery)

let currentBody: any = {}
vi.stubGlobal('parseBody', vi.fn(async () => currentBody))
vi.stubGlobal('parseQuery', vi.fn((_event: unknown, schema: any) => {
  return schema.parse(currentQuery)
}))

vi.stubGlobal('defineApiHandler', (fn: unknown) => fn)
vi.stubGlobal('defineRouteMeta', () => {})
vi.stubGlobal('zodRequestBody', () => ({}))

// --- Import route handlers AFTER stubs ---

const eventsGetHandler = (await import('~/server/api/webhooks/events/index.get')).default
const eventsPostHandler = (await import('~/server/api/webhooks/events/index.post')).default
const eventDeleteHandler = (await import('~/server/api/webhooks/events/[id].delete')).default
const statsGetHandler = (await import('~/server/api/webhooks/events/stats.get')).default
const testEventHandler = (await import('~/server/api/webhooks/events/test.post')).default

// Registration CRUD routes
const registrationsGetHandler = (await import('~/server/api/webhooks/registrations/index.get')).default
const registrationsPostHandler = (await import('~/server/api/webhooks/registrations/index.post')).default
const registrationPatchHandler = (await import('~/server/api/webhooks/registrations/[id].patch')).default
const registrationDeleteHandler = (await import('~/server/api/webhooks/registrations/[id].delete')).default

// Delivery routes
const deliveriesQueuedGetHandler = (await import('~/server/api/webhooks/deliveries/queued.get')).default
const deliveriesBatchStatusPostHandler = (await import('~/server/api/webhooks/deliveries/batch-status.post')).default
const deliveryPatchHandler = (await import('~/server/api/webhooks/deliveries/[id].patch')).default

// Event action routes
const replayPostHandler = (await import('~/server/api/webhooks/events/[eventId]/replay.post')).default
const retryFailedPostHandler = (await import('~/server/api/webhooks/events/[eventId]/retry-failed.post')).default

function makeFakeEvent() {
  return {
    context: { auth: { user: { sub: 'user_1' } } },
    node: { req: {}, res: {} },
  } as any
}

describe('webhook route wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentRouterParam = 'whe_1'
    currentQuery = {}
    currentBody = {}
  })

  // ---- Event CRUD routes ----

  it('GET /api/webhooks/events calls listEventsWithDeliveries with default pagination', async () => {
    await eventsGetHandler(makeFakeEvent())
    expect(mockWebhookService.listEventsWithDeliveries).toHaveBeenCalledWith({ limit: 200, offset: 0 })
  })

  it('GET /api/webhooks/events respects limit/offset query params', async () => {
    currentQuery = { limit: '50', offset: '10' }
    await eventsGetHandler(makeFakeEvent())
    expect(mockWebhookService.listEventsWithDeliveries).toHaveBeenCalledWith({ limit: 50, offset: 10 })
  })

  it('GET /api/webhooks/events returns the service result directly', async () => {
    const enrichedEvents = [
      {
        id: 'whe_1',
        eventType: 'part_advanced',
        payload: { partId: 'p1' },
        summary: 'Part advanced',
        createdAt: '2024-01-01',
        deliverySummary: { total: 4, queued: 1, delivering: 0, delivered: 2, failed: 1, canceled: 0 },
      },
    ]
    mockWebhookService.listEventsWithDeliveries.mockReturnValueOnce(enrichedEvents)

    const result = await eventsGetHandler(makeFakeEvent())
    expect(result).toEqual(enrichedEvents)
  })

  it('GET /api/webhooks/events returns empty array when no events', async () => {
    mockWebhookService.listEventsWithDeliveries.mockReturnValueOnce([])
    const result = await eventsGetHandler(makeFakeEvent())
    expect(result).toEqual([])
  })

  it('POST /api/webhooks/events calls queueEvent with parsed body', async () => {
    currentBody = { eventType: 'part_advanced', payload: { partId: 'p1' }, summary: 'test' }
    await eventsPostHandler(makeFakeEvent())
    expect(mockWebhookService.queueEvent).toHaveBeenCalledWith(currentBody)
  })

  it('DELETE /api/webhooks/events/:id calls deleteEvent', async () => {
    const result = await eventDeleteHandler(makeFakeEvent())
    expect(mockWebhookService.deleteEvent).toHaveBeenCalledWith('user_1', 'whe_1')
    expect(result).toEqual({ success: true })
  })

  it('DELETE /api/webhooks/events/:id throws ValidationError when id is missing', async () => {
    currentRouterParam = undefined
    await expect(eventDeleteHandler(makeFakeEvent())).rejects.toThrow(ValidationError)
  })

  it('GET /api/webhooks/events/stats calls getQueueStats', async () => {
    const result = await statsGetHandler(makeFakeEvent())
    expect(mockWebhookService.getQueueStats).toHaveBeenCalledOnce()
    expect(result).toEqual({ total: 5 })
  })
})

// ---- Test event route ----

describe('webhook test event route wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentBody = {}
  })

  it('POST /api/webhooks/events/test calls queueEvent with test payload', async () => {
    currentBody = { eventType: 'part_advanced' }
    const result = await testEventHandler(makeFakeEvent())
    expect(mockWebhookService.queueEvent).toHaveBeenCalledOnce()
    const call = mockWebhookService.queueEvent.mock.calls[0][0]
    expect(call.eventType).toBe('part_advanced')
    expect(call.summary).toMatch(/^\[TEST\]/)
    expect(call.payload).toBeDefined()
    expect(call.payload.user).toBe('Test User')
    expect(result).toBeDefined()
  })

  it('POST /api/webhooks/events/test generates correct payload for each event type', async () => {
    const eventTypes = [
      'part_advanced', 'part_completed', 'part_created', 'part_scrapped',
      'part_force_completed', 'step_skipped', 'step_deferred', 'step_waived',
      'job_created', 'job_deleted', 'path_deleted', 'note_created', 'cert_attached',
    ]

    for (const eventType of eventTypes) {
      vi.clearAllMocks()
      currentBody = { eventType }
      await testEventHandler(makeFakeEvent())
      expect(mockWebhookService.queueEvent).toHaveBeenCalledOnce()
      const call = mockWebhookService.queueEvent.mock.calls[0][0]
      expect(call.eventType).toBe(eventType)
      expect(call.summary).toContain('[TEST]')
      expect(call.payload.time).toBeUndefined()
    }
  })

  it('POST /api/webhooks/events/test includes expected fields for part_advanced', async () => {
    currentBody = { eventType: 'part_advanced' }
    await testEventHandler(makeFakeEvent())
    const payload = mockWebhookService.queueEvent.mock.calls[0][0].payload
    expect(payload.partId).toBe('SN-00042')
    expect(payload.fromStep).toBe('Machining')
    expect(payload.toStep).toBe('Inspection')
    expect(payload.skip).toBe(false)
  })

  it('POST /api/webhooks/events/test includes expected fields for job_created', async () => {
    currentBody = { eventType: 'job_created' }
    await testEventHandler(makeFakeEvent())
    const payload = mockWebhookService.queueEvent.mock.calls[0][0].payload
    expect(payload.jobId).toBe('job_sample1')
    expect(payload.jobName).toBe('Test Job Alpha')
    expect(payload.goalQuantity).toBe(50)
  })

  it('POST /api/webhooks/events/test includes expected fields for cert_attached', async () => {
    currentBody = { eventType: 'cert_attached' }
    await testEventHandler(makeFakeEvent())
    const payload = mockWebhookService.queueEvent.mock.calls[0][0].payload
    expect(payload.certId).toBe('cert_sample1')
    expect(payload.certName).toBe('Material Test Report')
    expect(payload.certType).toBe('material')
    expect(payload.partIds).toEqual(['SN-00042', 'SN-00043'])
    expect(payload.count).toBe(2)
  })
})

// ---- Registration CRUD routes ----

describe('webhook registration route wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentRouterParam = 'whr_1'
    currentQuery = {}
    currentBody = {}
  })

  it('GET /api/webhooks/registrations calls list()', async () => {
    const registrations = [
      { id: 'whr_1', name: 'Slack', url: 'https://slack.com/hook', eventTypes: ['part_advanced'], createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    ]
    mockWebhookRegistrationService.list.mockReturnValueOnce(registrations)

    const result = await registrationsGetHandler(makeFakeEvent())
    expect(mockWebhookRegistrationService.list).toHaveBeenCalledOnce()
    expect(result).toEqual(registrations)
  })

  it('POST /api/webhooks/registrations calls create with userId and body', async () => {
    currentBody = { name: 'Slack', url: 'https://slack.com/hook', eventTypes: ['part_advanced'] }
    const result = await registrationsPostHandler(makeFakeEvent())
    expect(mockWebhookRegistrationService.create).toHaveBeenCalledWith('user_1', currentBody)
    expect(result).toMatchObject({ id: 'whr_1', name: 'Slack' })
  })

  it('POST /api/webhooks/registrations calls getAuthUserId for admin check', async () => {
    currentBody = { name: 'Test', url: 'https://example.com', eventTypes: ['job_created'] }
    await registrationsPostHandler(makeFakeEvent())
    expect(mockWebhookRegistrationService.create).toHaveBeenCalledWith('user_1', expect.any(Object))
  })

  it('PATCH /api/webhooks/registrations/:id calls update with userId, id, and body', async () => {
    currentBody = { name: 'Updated Name' }
    const result = await registrationPatchHandler(makeFakeEvent())
    expect(mockWebhookRegistrationService.update).toHaveBeenCalledWith('user_1', 'whr_1', currentBody)
    expect(result).toMatchObject({ name: 'Updated Name' })
  })

  it('PATCH /api/webhooks/registrations/:id throws ValidationError when id is missing', async () => {
    currentRouterParam = undefined
    currentBody = { name: 'Updated' }
    await expect(registrationPatchHandler(makeFakeEvent())).rejects.toThrow(ValidationError)
  })

  it('PATCH /api/webhooks/registrations/:id calls getAuthUserId for admin check', async () => {
    currentBody = { url: 'https://new-url.com' }
    await registrationPatchHandler(makeFakeEvent())
    expect(mockWebhookRegistrationService.update).toHaveBeenCalledWith('user_1', 'whr_1', expect.any(Object))
  })

  it('DELETE /api/webhooks/registrations/:id calls delete with userId and id', async () => {
    await registrationDeleteHandler(makeFakeEvent())
    expect(mockWebhookRegistrationService.delete).toHaveBeenCalledWith('user_1', 'whr_1')
  })

  it('DELETE /api/webhooks/registrations/:id throws ValidationError when id is missing', async () => {
    currentRouterParam = undefined
    await expect(registrationDeleteHandler(makeFakeEvent())).rejects.toThrow(ValidationError)
  })

  it('DELETE /api/webhooks/registrations/:id calls getAuthUserId for admin check', async () => {
    await registrationDeleteHandler(makeFakeEvent())
    expect(mockWebhookRegistrationService.delete).toHaveBeenCalledWith('user_1', expect.any(String))
  })

  it('DELETE /api/webhooks/registrations/:id returns no content', async () => {
    await registrationDeleteHandler(makeFakeEvent())
    expect(sendNoContent).toHaveBeenCalled()
  })
})

// ---- Delivery routes ----

describe('webhook delivery route wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentRouterParam = 'whd_1'
    currentQuery = {}
    currentBody = {}
  })

  it('GET /api/webhooks/deliveries/queued calls listQueued with no limit by default', async () => {
    await deliveriesQueuedGetHandler(makeFakeEvent())
    expect(mockWebhookDeliveryService.listQueued).toHaveBeenCalledWith(undefined)
  })

  it('GET /api/webhooks/deliveries/queued passes limit query param', async () => {
    currentQuery = { limit: '25' }
    await deliveriesQueuedGetHandler(makeFakeEvent())
    expect(mockWebhookDeliveryService.listQueued).toHaveBeenCalledWith(25)
  })

  it('POST /api/webhooks/deliveries/batch-status calls batchUpdateStatus with body', async () => {
    currentBody = {
      deliveries: [
        { id: 'whd_1', status: 'delivering' },
        { id: 'whd_2', status: 'delivered' },
      ],
    }
    const result = await deliveriesBatchStatusPostHandler(makeFakeEvent())
    expect(mockWebhookDeliveryService.batchUpdateStatus).toHaveBeenCalledWith(currentBody.deliveries)
    expect(result).toEqual({ ok: true })
  })

  it('PATCH /api/webhooks/deliveries/:id calls updateStatus with id, status, and error', async () => {
    currentBody = { status: 'failed', error: 'Connection refused' }
    const result = await deliveryPatchHandler(makeFakeEvent())
    expect(mockWebhookDeliveryService.updateStatus).toHaveBeenCalledWith('whd_1', 'failed', 'Connection refused')
    expect(result).toMatchObject({ id: 'whd_1', status: 'failed', error: 'Connection refused' })
  })

  it('PATCH /api/webhooks/deliveries/:id calls updateStatus without error when not provided', async () => {
    currentBody = { status: 'delivering' }
    await deliveryPatchHandler(makeFakeEvent())
    expect(mockWebhookDeliveryService.updateStatus).toHaveBeenCalledWith('whd_1', 'delivering', undefined)
  })

  it('PATCH /api/webhooks/deliveries/:id throws ValidationError when id is missing', async () => {
    currentRouterParam = undefined
    currentBody = { status: 'delivering' }
    await expect(deliveryPatchHandler(makeFakeEvent())).rejects.toThrow(ValidationError)
  })
})

// ---- Event action routes (replay, retry-failed) ----

describe('webhook event action route wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentRouterParam = 'whe_42'
    currentQuery = {}
    currentBody = {}
  })

  it('POST /api/webhooks/events/:eventId/replay calls replayEvent with userId and eventId', async () => {
    await replayPostHandler(makeFakeEvent())
    expect(mockWebhookDeliveryService.replayEvent).toHaveBeenCalledWith('user_1', 'whe_42')
  })

  it('POST /api/webhooks/events/:eventId/replay throws ValidationError when eventId is missing', async () => {
    currentRouterParam = undefined
    await expect(replayPostHandler(makeFakeEvent())).rejects.toThrow(ValidationError)
  })

  it('POST /api/webhooks/events/:eventId/replay calls getAuthUserId for admin check', async () => {
    await replayPostHandler(makeFakeEvent())
    expect(mockWebhookDeliveryService.replayEvent).toHaveBeenCalledWith('user_1', expect.any(String))
  })

  it('POST /api/webhooks/events/:eventId/retry-failed calls retryFailed with userId and eventId', async () => {
    await retryFailedPostHandler(makeFakeEvent())
    expect(mockWebhookDeliveryService.retryFailed).toHaveBeenCalledWith('user_1', 'whe_42')
  })

  it('POST /api/webhooks/events/:eventId/retry-failed throws ValidationError when eventId is missing', async () => {
    currentRouterParam = undefined
    await expect(retryFailedPostHandler(makeFakeEvent())).rejects.toThrow(ValidationError)
  })

  it('POST /api/webhooks/events/:eventId/retry-failed calls getAuthUserId for admin check', async () => {
    await retryFailedPostHandler(makeFakeEvent())
    expect(mockWebhookDeliveryService.retryFailed).toHaveBeenCalledWith('user_1', expect.any(String))
  })
})
