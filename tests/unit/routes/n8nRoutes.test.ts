/**
 * Route-level wiring tests for n8n automation API routes.
 *
 * Validates: route handlers correctly forward to n8nAutomationService methods,
 * Zod validation is applied on POST/PATCH routes, and router params are parsed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ValidationError, NotFoundError, ForbiddenError, AuthenticationError } from '~/server/utils/errors'

// --- Stub Nitro auto-imports ---

vi.stubGlobal('ValidationError', ValidationError)
vi.stubGlobal('NotFoundError', NotFoundError)
vi.stubGlobal('ForbiddenError', ForbiddenError)
vi.stubGlobal('AuthenticationError', AuthenticationError)

const mockN8nAutomationService = {
  list: vi.fn(() => []),
  getById: vi.fn((id: string) => ({
    id,
    name: 'Test Automation',
    description: '',
    eventTypes: ['part_advanced'],
    workflowJson: { nodes: [], connections: {} },
    enabled: true,
    n8nWorkflowId: null,
    linkedRegistrationId: null,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  })),
  create: vi.fn((input: any, _userId: string) => ({
    id: 'auto_new',
    ...input,
    n8nWorkflowId: null,
    linkedRegistrationId: null,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  })),
  update: vi.fn((_id: string, updates: any, _userId: string) => ({
    id: 'auto_1',
    name: 'Updated',
    ...updates,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02',
  })),
  delete: vi.fn(),
  deploy: vi.fn(async (id: string, _userId: string) => ({
    id,
    name: 'Deployed',
    n8nWorkflowId: 'wf_123',
    linkedRegistrationId: 'whr_linked',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02',
  })),
  getN8nStatus: vi.fn(async () => ({ connected: true, baseUrl: 'http://localhost:5678' })),
}

const mockSettingsService = {
  getN8nConnection: vi.fn(() => ({
    baseUrl: 'http://localhost:5678',
    apiKey: 'test-key',
    enabled: true,
  })),
}

vi.stubGlobal('getServices', () => ({
  n8nAutomationService: mockN8nAutomationService,
  settingsService: mockSettingsService,
}))

vi.stubGlobal('getAuthUserId', () => 'user_admin')
vi.stubGlobal('getRepositories', () => ({ users: {} }))
vi.stubGlobal('requireAdmin', vi.fn())

let currentRouterParam: string | undefined = 'auto_1'
vi.stubGlobal('getRouterParam', (_event: unknown, _name: string) => currentRouterParam)

let currentBody: any = {}
vi.stubGlobal('parseBody', vi.fn(async () => currentBody))

vi.stubGlobal('defineApiHandler', (fn: unknown) => fn)
vi.stubGlobal('defineRouteMeta', () => {})
vi.stubGlobal('zodRequestBody', () => ({}))

// Mock $fetch for test-connection route
vi.stubGlobal('$fetch', vi.fn(async () => ({ data: [] })))

// --- Import route handlers AFTER stubs ---

const listHandler = (await import('~/server/api/n8n/automations/index.get')).default
const createHandler = (await import('~/server/api/n8n/automations/index.post')).default
const getByIdHandler = (await import('~/server/api/n8n/automations/[id].get')).default
const updateHandler = (await import('~/server/api/n8n/automations/[id].patch')).default
const deleteHandler = (await import('~/server/api/n8n/automations/[id].delete')).default
const deployHandler = (await import('~/server/api/n8n/automations/[id]/deploy.post')).default
const statusHandler = (await import('~/server/api/n8n/status.get')).default

function makeFakeEvent() {
  return {
    context: { auth: { user: { sub: 'user_admin' } } },
    node: { req: {}, res: {} },
  } as any
}

describe('n8n automation route wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentRouterParam = 'auto_1'
    currentBody = {}
  })

  // ---- List ----

  it('GET /api/n8n/automations calls list()', async () => {
    const result = await listHandler(makeFakeEvent())
    expect(mockN8nAutomationService.list).toHaveBeenCalledOnce()
    expect(result).toEqual([])
  })

  it('GET /api/n8n/automations returns service result', async () => {
    const automations = [{ id: 'auto_1', name: 'A' }, { id: 'auto_2', name: 'B' }]
    mockN8nAutomationService.list.mockReturnValueOnce(automations)
    const result = await listHandler(makeFakeEvent())
    expect(result).toEqual(automations)
  })

  // ---- Get by ID ----

  it('GET /api/n8n/automations/:id calls getById with id', async () => {
    await getByIdHandler(makeFakeEvent())
    expect(mockN8nAutomationService.getById).toHaveBeenCalledWith('auto_1')
  })

  it('GET /api/n8n/automations/:id throws ValidationError when id is missing', async () => {
    currentRouterParam = undefined
    await expect(getByIdHandler(makeFakeEvent())).rejects.toThrow(ValidationError)
  })

  // ---- Create ----

  it('POST /api/n8n/automations calls create with body and userId', async () => {
    currentBody = {
      name: 'New Automation',
      eventTypes: ['part_advanced'],
      workflowJson: { nodes: [], connections: {} },
    }
    await createHandler(makeFakeEvent())
    expect(mockN8nAutomationService.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Automation' }),
      'user_admin',
    )
  })

  it('POST /api/n8n/automations returns created automation', async () => {
    currentBody = {
      name: 'New',
      eventTypes: ['job_created'],
      workflowJson: { nodes: [], connections: {} },
    }
    const result = await createHandler(makeFakeEvent())
    expect(result).toMatchObject({ id: 'auto_new' })
  })

  // ---- Update ----

  it('PATCH /api/n8n/automations/:id calls update with id, body, and userId', async () => {
    currentBody = { name: 'Renamed' }
    await updateHandler(makeFakeEvent())
    expect(mockN8nAutomationService.update).toHaveBeenCalledWith(
      'auto_1',
      expect.objectContaining({ name: 'Renamed' }),
      'user_admin',
    )
  })

  it('PATCH /api/n8n/automations/:id throws ValidationError when id is missing', async () => {
    currentRouterParam = undefined
    currentBody = { name: 'X' }
    await expect(updateHandler(makeFakeEvent())).rejects.toThrow(ValidationError)
  })

  // ---- Delete ----

  it('DELETE /api/n8n/automations/:id calls delete with id and userId', async () => {
    await deleteHandler(makeFakeEvent())
    expect(mockN8nAutomationService.delete).toHaveBeenCalledWith('auto_1', 'user_admin')
  })

  it('DELETE /api/n8n/automations/:id returns success', async () => {
    const result = await deleteHandler(makeFakeEvent())
    expect(result).toEqual({ success: true })
  })

  it('DELETE /api/n8n/automations/:id throws ValidationError when id is missing', async () => {
    currentRouterParam = undefined
    await expect(deleteHandler(makeFakeEvent())).rejects.toThrow(ValidationError)
  })

  // ---- Deploy ----

  it('POST /api/n8n/automations/:id/deploy calls deploy with id and userId', async () => {
    await deployHandler(makeFakeEvent())
    expect(mockN8nAutomationService.deploy).toHaveBeenCalledWith('auto_1', 'user_admin')
  })

  it('POST /api/n8n/automations/:id/deploy returns deployed automation', async () => {
    const result = await deployHandler(makeFakeEvent())
    expect(result).toMatchObject({ n8nWorkflowId: 'wf_123' })
  })

  it('POST /api/n8n/automations/:id/deploy throws ValidationError when id is missing', async () => {
    currentRouterParam = undefined
    await expect(deployHandler(makeFakeEvent())).rejects.toThrow(ValidationError)
  })

  // ---- Status ----

  it('GET /api/n8n/status calls getN8nStatus()', async () => {
    const result = await statusHandler(makeFakeEvent())
    expect(mockN8nAutomationService.getN8nStatus).toHaveBeenCalledOnce()
    expect(result).toEqual({ connected: true, baseUrl: 'http://localhost:5678' })
  })

  it('GET /api/n8n/status returns disconnected status', async () => {
    mockN8nAutomationService.getN8nStatus.mockResolvedValueOnce({
      connected: false,
      baseUrl: 'http://localhost:5678',
      error: 'Connection refused',
    })
    const result = await statusHandler(makeFakeEvent())
    expect(result).toEqual({
      connected: false,
      baseUrl: 'http://localhost:5678',
      error: 'Connection refused',
    })
  })
})
