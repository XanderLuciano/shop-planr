/**
 * Route-level wiring tests for tag CRUD routes.
 *
 * Validates: Requirement 12.1 (admin-gated CRUD), 12.2 (any auth'd user can assign tags)
 *
 * Admin enforcement itself lives in `tagService` — see `tests/unit/services/tagService.test.ts`.
 * These tests verify that the route handlers correctly forward the caller's userId to the
 * service, and that `ForbiddenError` thrown by the service propagates through to the caller.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createError } from 'h3'
import { ValidationError, NotFoundError, ForbiddenError, AuthenticationError } from '~/server/utils/errors'

// --- Stub Nitro auto-imports ---

vi.stubGlobal('ValidationError', ValidationError)
vi.stubGlobal('NotFoundError', NotFoundError)
vi.stubGlobal('ForbiddenError', ForbiddenError)
vi.stubGlobal('AuthenticationError', AuthenticationError)
vi.stubGlobal('createError', createError)

const ADMIN_ID = 'user_admin'
const REGULAR_ID = 'user_regular'

let currentUserId = ADMIN_ID
let isCurrentUserAdmin = true

// Mock services: service throws ForbiddenError when caller is not admin —
// mirrors the real tagService behavior under test.
const mockTagService = {
  listTags: vi.fn(() => []),
  createTag: vi.fn((userId: string) => {
    if (!isCurrentUserAdmin) throw new ForbiddenError('Admin access required to create tags')
    return { id: 'tag_1', name: 'Test', color: '#ef4444', createdAt: '2024-01-01', updatedAt: '2024-01-01', _userId: userId }
  }),
  updateTag: vi.fn((userId: string) => {
    if (!isCurrentUserAdmin) throw new ForbiddenError('Admin access required to update tags')
    return { id: 'tag_1', name: 'Updated', color: '#ef4444', createdAt: '2024-01-01', updatedAt: '2024-01-01', _userId: userId }
  }),
  deleteTag: vi.fn((_userId: string) => {
    if (!isCurrentUserAdmin) throw new ForbiddenError('Admin access required to delete tags')
  }),
  getTagsByJobId: vi.fn(() => []),
}

const mockJobService = {
  setJobTags: vi.fn((_userId: string) => {
    // Tag assignment is open to any authenticated user (Requirement 12.2)
    return []
  }),
}

vi.stubGlobal('getServices', () => ({
  tagService: mockTagService,
  jobService: mockJobService,
}))

vi.stubGlobal('getAuthUserId', () => currentUserId)
vi.stubGlobal('getRouterParam', (_event: unknown, _name: string) => 'tag_1')
vi.stubGlobal('getQuery', () => ({}))
vi.stubGlobal('parseQuery', (_event: unknown, _schema: unknown) => ({ force: false }))
vi.stubGlobal('setResponseStatus', vi.fn())
vi.stubGlobal('sendNoContent', vi.fn())
vi.stubGlobal('parseBody', vi.fn(async () => ({ name: 'Test', tagIds: ['tag_1'] })))

vi.stubGlobal('defineApiHandler', (fn: unknown) => fn)

// --- Import route handlers AFTER stubs ---

const postTagHandler = (await import('~/server/api/tags/index.post')).default
const putTagHandler = (await import('~/server/api/tags/[id].put')).default
const deleteTagHandler = (await import('~/server/api/tags/[id].delete')).default
const putJobTagsHandler = (await import('~/server/api/jobs/[id]/tags.put')).default

function makeFakeEvent() {
  return {
    context: { auth: { user: { sub: currentUserId } } },
    node: { req: {}, res: {} },
  } as unknown as Parameters<typeof postTagHandler>[0]
}

function asAdmin() {
  currentUserId = ADMIN_ID
  isCurrentUserAdmin = true
}

function asRegular() {
  currentUserId = REGULAR_ID
  isCurrentUserAdmin = false
}

describe('tag CRUD route wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    asAdmin()
  })

  /**
   * Validates: Requirement 12.1 — non-admin POST /api/tags rejected
   */
  it('POST /api/tags propagates ForbiddenError thrown by tagService', async () => {
    asRegular()
    await expect(postTagHandler(makeFakeEvent())).rejects.toThrow(ForbiddenError)
    // The route still calls the service — the service decides, not the route.
    expect(mockTagService.createTag).toHaveBeenCalledWith(REGULAR_ID, expect.any(Object))
  })

  /**
   * Validates: Requirement 12.1 — non-admin PUT /api/tags/:id rejected
   */
  it('PUT /api/tags/:id propagates ForbiddenError thrown by tagService', async () => {
    asRegular()
    await expect(putTagHandler(makeFakeEvent())).rejects.toThrow(ForbiddenError)
    expect(mockTagService.updateTag).toHaveBeenCalledWith(REGULAR_ID, 'tag_1', expect.any(Object))
  })

  /**
   * Validates: Requirement 12.1 — non-admin DELETE /api/tags/:id rejected
   */
  it('DELETE /api/tags/:id propagates ForbiddenError thrown by tagService', async () => {
    asRegular()
    await expect(deleteTagHandler(makeFakeEvent())).rejects.toThrow(ForbiddenError)
    expect(mockTagService.deleteTag).toHaveBeenCalledWith(REGULAR_ID, 'tag_1', false)
  })

  /**
   * Validates: Requirement 12.1 (positive case) — admin users can create tags
   */
  it('POST /api/tags succeeds for admin user', async () => {
    asAdmin()
    const result = await postTagHandler(makeFakeEvent())
    expect(result).toBeDefined()
    expect(mockTagService.createTag).toHaveBeenCalledWith(ADMIN_ID, expect.any(Object))
  })

  /**
   * Validates: Requirement 12.2 — any auth'd user can assign tags to jobs
   */
  it('PUT /api/jobs/:id/tags succeeds for non-admin user', async () => {
    asRegular()
    const result = await putJobTagsHandler(makeFakeEvent())
    expect(mockJobService.setJobTags).toHaveBeenCalledWith(REGULAR_ID, 'tag_1', expect.any(Array))
    expect(result).toBeDefined()
  })

  /**
   * Validates: admin users can also assign tags to jobs
   */
  it('PUT /api/jobs/:id/tags succeeds for admin user', async () => {
    asAdmin()
    const result = await putJobTagsHandler(makeFakeEvent())
    expect(mockJobService.setJobTags).toHaveBeenCalledWith(ADMIN_ID, 'tag_1', expect.any(Array))
    expect(result).toBeDefined()
  })
})
