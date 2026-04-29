/**
 * Route-level wiring tests for webhook API routes.
 *
 * Validates: route handlers correctly forward to webhookService methods,
 * Zod validation is applied on POST/PATCH routes, and query params are parsed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ValidationError, NotFoundError, ForbiddenError, AuthenticationError } from '~/server/utils/errors'

// --- Stub Nitro auto-imports ---

vi.stubGlobal('ValidationError', ValidationError)
vi.stubGlobal('NotFoundError', NotFoundError)
vi.stubGlobal('ForbiddenError', ForbiddenError)
vi.stubGlobal('AuthenticationError', AuthenticationError)

const mockWebhookService = {
  getConfig: vi.fn(() => ({
    id: 'default',
    endpointUrl: 'https://example.com/hook',
    enabledEventTypes: ['part_advanced'],
    isActive: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  })),
  updateConfig: vi.fn((_userId: string, input: any) => ({
    id: 'default',
    ...input,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02',
  })),
  queueEvent: vi.fn((input: any) => ({
    id: 'whe_1',
    ...input,
    status: 'queued',
    createdAt: '2024-01-01',
    retryCount: 0,
  })),
  listEvents: vi.fn(() => []),
  listQueuedEvents: vi.fn(() => []),
  markSent: vi.fn((id: string) => ({ id, status: 'sent' })),
  markFailed: vi.fn((id: string, error: string) => ({ id, status: 'failed', lastError: error })),
  requeueEvent: vi.fn((id: string) => ({ id, status: 'queued' })),
  requeueAllFailed: vi.fn((_userId: string) => 3),
  deleteEvent: vi.fn(),
  getQueueStats: vi.fn(() => ({ queued: 5, sent: 10, failed: 2 })),
}

vi.stubGlobal('getServices', () => ({ webhookService: mockWebhookService }))
vi.stubGlobal('getAuthUserId', () => 'user_1')

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

const configGetHandler = (await import('~/server/api/webhooks/config.get')).default
const configPatchHandler = (await import('~/server/api/webhooks/config.patch')).default
const eventsGetHandler = (await import('~/server/api/webhooks/events/index.get')).default
const eventsPostHandler = (await import('~/server/api/webhooks/events/index.post')).default
const eventPatchHandler = (await import('~/server/api/webhooks/events/[id].patch')).default
const eventDeleteHandler = (await import('~/server/api/webhooks/events/[id].delete')).default
const batchStatusHandler = (await import('~/server/api/webhooks/events/batch-status.post')).default
const queuedGetHandler = (await import('~/server/api/webhooks/events/queued.get')).default
const retryAllHandler = (await import('~/server/api/webhooks/events/retry-all.post')).default
const statsGetHandler = (await import('~/server/api/webhooks/events/stats.get')).default

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

  // ---- Config routes ----

  it('GET /api/webhooks/config calls webhookService.getConfig', async () => {
    const result = await configGetHandler(makeFakeEvent())
    expect(mockWebhookService.getConfig).toHaveBeenCalledOnce()
    expect(result.endpointUrl).toBe('https://example.com/hook')
  })

  it('PATCH /api/webhooks/config calls webhookService.updateConfig with userId and parsed body', async () => {
    currentBody = { endpointUrl: 'https://new.com', isActive: false }
    await configPatchHandler(makeFakeEvent())
    expect(mockWebhookService.updateConfig).toHaveBeenCalledWith('user_1', currentBody)
  })

  // ---- Event CRUD routes ----

  it('GET /api/webhooks/events calls listEvents with default pagination', async () => {
    await eventsGetHandler(makeFakeEvent())
    expect(mockWebhookService.listEvents).toHaveBeenCalledWith({ limit: 200, offset: 0 })
  })

  it('GET /api/webhooks/events respects limit/offset query params', async () => {
    currentQuery = { limit: '50', offset: '10' }
    await eventsGetHandler(makeFakeEvent())
    expect(mockWebhookService.listEvents).toHaveBeenCalledWith({ limit: 50, offset: 10 })
  })

  it('POST /api/webhooks/events calls queueEvent with parsed body', async () => {
    currentBody = { eventType: 'part_advanced', payload: { partId: 'p1' }, summary: 'test' }
    await eventsPostHandler(makeFakeEvent())
    expect(mockWebhookService.queueEvent).toHaveBeenCalledWith(currentBody)
  })

  it('PATCH /api/webhooks/events/:id with status=sent calls markSent', async () => {
    currentBody = { status: 'sent' }
    await eventPatchHandler(makeFakeEvent())
    expect(mockWebhookService.markSent).toHaveBeenCalledWith('whe_1')
  })

  it('PATCH /api/webhooks/events/:id with status=failed calls markFailed', async () => {
    currentBody = { status: 'failed', error: 'timeout' }
    await eventPatchHandler(makeFakeEvent())
    expect(mockWebhookService.markFailed).toHaveBeenCalledWith('whe_1', 'timeout')
  })

  it('PATCH /api/webhooks/events/:id with status=failed uses default error when none provided', async () => {
    currentBody = { status: 'failed' }
    await eventPatchHandler(makeFakeEvent())
    expect(mockWebhookService.markFailed).toHaveBeenCalledWith('whe_1', 'Unknown error')
  })

  it('PATCH /api/webhooks/events/:id with status=queued calls requeueEvent', async () => {
    currentBody = { status: 'queued' }
    await eventPatchHandler(makeFakeEvent())
    expect(mockWebhookService.requeueEvent).toHaveBeenCalledWith('whe_1')
  })

  it('PATCH /api/webhooks/events/:id throws ValidationError when id is missing', async () => {
    currentRouterParam = undefined
    currentBody = { status: 'sent' }
    await expect(eventPatchHandler(makeFakeEvent())).rejects.toThrow(ValidationError)
  })

  it('DELETE /api/webhooks/events/:id calls deleteEvent', async () => {
    const result = await eventDeleteHandler(makeFakeEvent())
    expect(mockWebhookService.deleteEvent).toHaveBeenCalledWith('whe_1')
    expect(result).toEqual({ success: true })
  })

  it('DELETE /api/webhooks/events/:id throws ValidationError when id is missing', async () => {
    currentRouterParam = undefined
    await expect(eventDeleteHandler(makeFakeEvent())).rejects.toThrow(ValidationError)
  })

  // ---- Batch & queue routes ----

  it('POST /api/webhooks/events/batch-status processes all events', async () => {
    currentBody = {
      events: [
        { id: 'whe_1', status: 'sent' },
        { id: 'whe_2', status: 'failed', error: 'err' },
      ],
    }
    const result = await batchStatusHandler(makeFakeEvent())
    expect(result).toHaveLength(2)
    expect(mockWebhookService.markSent).toHaveBeenCalledWith('whe_1')
    expect(mockWebhookService.markFailed).toHaveBeenCalledWith('whe_2', 'err')
  })

  it('GET /api/webhooks/events/queued calls listQueuedEvents with default limit', async () => {
    await queuedGetHandler(makeFakeEvent())
    expect(mockWebhookService.listQueuedEvents).toHaveBeenCalledWith(100)
  })

  it('GET /api/webhooks/events/queued respects limit query param', async () => {
    currentQuery = { limit: '25' }
    await queuedGetHandler(makeFakeEvent())
    expect(mockWebhookService.listQueuedEvents).toHaveBeenCalledWith(25)
  })

  it('POST /api/webhooks/events/retry-all calls requeueAllFailed with userId', async () => {
    const result = await retryAllHandler(makeFakeEvent())
    expect(mockWebhookService.requeueAllFailed).toHaveBeenCalledWith('user_1')
    expect(result).toEqual({ requeued: 3 })
  })

  it('GET /api/webhooks/events/stats calls getQueueStats', async () => {
    const result = await statsGetHandler(makeFakeEvent())
    expect(mockWebhookService.getQueueStats).toHaveBeenCalledOnce()
    expect(result).toEqual({ queued: 5, sent: 10, failed: 2 })
  })
})
