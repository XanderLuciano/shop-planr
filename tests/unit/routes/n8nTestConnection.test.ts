/**
 * Route-level wiring tests for POST /api/n8n/test-connection.
 *
 * This route has more complex logic than the other n8n routes:
 * it probes an n8n instance with ad-hoc credentials, falling back
 * to stored credentials when not provided.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ValidationError, ForbiddenError, AuthenticationError } from '~/server/utils/errors'

// Mock the auth module BEFORE importing the route handler
const mockRequireAdmin = vi.fn()
vi.mock('~/server/utils/auth', () => ({
  requireAdmin: (...args: any[]) => mockRequireAdmin(...args),
  getAuthUserId: () => 'user_admin',
}))

// --- Stub Nitro auto-imports ---

vi.stubGlobal('ValidationError', ValidationError)
vi.stubGlobal('ForbiddenError', ForbiddenError)
vi.stubGlobal('AuthenticationError', AuthenticationError)
vi.stubGlobal('requireAdmin', mockRequireAdmin)

const mockSettingsService = {
  getN8nConnection: vi.fn(() => ({
    baseUrl: 'http://stored.example.com:5678',
    apiKey: 'stored-key-123',
    enabled: true,
  })),
}

vi.stubGlobal('getServices', () => ({
  settingsService: mockSettingsService,
}))

vi.stubGlobal('getRepositories', () => ({ users: {} }))
vi.stubGlobal('getAuthUserId', () => 'user_admin')

let currentBody: any = {}
vi.stubGlobal('parseBody', vi.fn(async () => currentBody))

vi.stubGlobal('defineApiHandler', (fn: unknown) => fn)
vi.stubGlobal('defineRouteMeta', () => {})
vi.stubGlobal('zodRequestBody', () => ({}))

// Mock $fetch
const mock$fetch = vi.fn()
vi.stubGlobal('$fetch', mock$fetch)

// --- Import route handler AFTER stubs ---

const testConnectionHandler = (await import('~/server/api/n8n/test-connection.post')).default

function makeFakeEvent() {
  return {
    context: { auth: { user: { sub: 'user_admin' } } },
    node: { req: {}, res: {} },
  } as any
}

describe('POST /api/n8n/test-connection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentBody = {}
    mock$fetch.mockResolvedValue({ data: [] })
  })

  it('uses provided baseUrl and apiKey when both are given', async () => {
    currentBody = { baseUrl: 'http://custom:5678', apiKey: 'custom-key' }
    await testConnectionHandler(makeFakeEvent())

    expect(mock$fetch).toHaveBeenCalledWith(
      'http://custom:5678/api/v1/workflows',
      expect.objectContaining({
        method: 'GET',
        headers: { 'X-N8N-API-KEY': 'custom-key' },
      }),
    )
  })

  it('falls back to stored baseUrl when not provided', async () => {
    currentBody = { apiKey: 'custom-key' }
    await testConnectionHandler(makeFakeEvent())

    expect(mock$fetch).toHaveBeenCalledWith(
      'http://stored.example.com:5678/api/v1/workflows',
      expect.objectContaining({
        headers: { 'X-N8N-API-KEY': 'custom-key' },
      }),
    )
  })

  it('falls back to stored apiKey when not provided', async () => {
    currentBody = { baseUrl: 'http://custom:5678' }
    await testConnectionHandler(makeFakeEvent())

    expect(mock$fetch).toHaveBeenCalledWith(
      'http://custom:5678/api/v1/workflows',
      expect.objectContaining({
        headers: { 'X-N8N-API-KEY': 'stored-key-123' },
      }),
    )
  })

  it('returns connected: true on successful fetch', async () => {
    currentBody = { baseUrl: 'http://n8n:5678', apiKey: 'key' }
    mock$fetch.mockResolvedValue({ data: [{ id: '1' }] })

    const result = await testConnectionHandler(makeFakeEvent())
    expect(result).toEqual({ connected: true, baseUrl: 'http://n8n:5678' })
  })

  it('returns connected: false with error on fetch failure', async () => {
    currentBody = { baseUrl: 'http://n8n:5678', apiKey: 'key' }
    mock$fetch.mockRejectedValue(Object.assign(new Error('Connection refused'), { statusCode: 502 }))

    const result = await testConnectionHandler(makeFakeEvent())
    expect(result.connected).toBe(false)
    expect(result.error).toContain('Connection refused')
  })

  it('returns connected: false when both baseUrl and apiKey are empty', async () => {
    mockSettingsService.getN8nConnection.mockReturnValue({
      baseUrl: '',
      apiKey: '',
      enabled: true,
    })
    currentBody = {}

    const result = await testConnectionHandler(makeFakeEvent())
    expect(result.connected).toBe(false)
    expect(result.error).toContain('Provide both')
  })

  it('returns connected: false when only baseUrl is empty', async () => {
    mockSettingsService.getN8nConnection.mockReturnValue({
      baseUrl: '',
      apiKey: 'key',
      enabled: true,
    })
    currentBody = {}

    const result = await testConnectionHandler(makeFakeEvent())
    expect(result.connected).toBe(false)
    expect(result.error).toContain('Provide both')
  })

  it('strips trailing slashes from baseUrl', async () => {
    currentBody = { baseUrl: 'http://n8n:5678///', apiKey: 'key' }
    await testConnectionHandler(makeFakeEvent())

    expect(mock$fetch).toHaveBeenCalledWith(
      'http://n8n:5678/api/v1/workflows',
      expect.anything(),
    )
  })

  it('trims whitespace from baseUrl and apiKey', async () => {
    currentBody = { baseUrl: '  http://n8n:5678  ', apiKey: '  key  ' }
    await testConnectionHandler(makeFakeEvent())

    expect(mock$fetch).toHaveBeenCalledWith(
      'http://n8n:5678/api/v1/workflows',
      expect.objectContaining({
        headers: { 'X-N8N-API-KEY': 'key' },
      }),
    )
  })

  it('calls requireAdmin for authorization', async () => {
    currentBody = { baseUrl: 'http://n8n:5678', apiKey: 'key' }
    await testConnectionHandler(makeFakeEvent())
    expect(mockRequireAdmin).toHaveBeenCalled()
  })

  it('extracts n8n error details from response body', async () => {
    currentBody = { baseUrl: 'http://n8n:5678', apiKey: 'bad-key' }
    mock$fetch.mockRejectedValue(Object.assign(new Error('fetch failed'), {
      data: { message: 'Invalid API key' },
    }))

    const result = await testConnectionHandler(makeFakeEvent())
    expect(result.connected).toBe(false)
    expect(result.error).toBe('Invalid API key')
  })
})
