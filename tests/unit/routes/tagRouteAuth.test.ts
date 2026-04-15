/**
 * Route-level admin authorization tests for tag CRUD routes.
 *
 * Validates: Requirement 12.1 (non-admin rejection), 12.2 (non-admin can assign tags)
 *
 * These tests verify that the admin gating logic in the route handlers
 * correctly throws ForbiddenError for non-admin users on tag CRUD,
 * while allowing any authenticated user to assign tags to jobs.
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

// Mock user data
const adminUser = {
  id: 'user_admin',
  username: 'admin',
  displayName: 'Admin',
  isAdmin: true,
  active: true,
  createdAt: '2024-01-01T00:00:00.000Z',
}

const regularUser = {
  id: 'user_regular',
  username: 'regular',
  displayName: 'Regular',
  isAdmin: false,
  active: true,
  createdAt: '2024-01-01T00:00:00.000Z',
}

// Mock services
const mockTagService = {
  listTags: vi.fn(() => []),
  createTag: vi.fn(() => ({ id: 'tag_1', name: 'Test', color: '#ef4444', createdAt: '2024-01-01', updatedAt: '2024-01-01' })),
  updateTag: vi.fn(() => ({ id: 'tag_1', name: 'Updated', color: '#ef4444', createdAt: '2024-01-01', updatedAt: '2024-01-01' })),
  deleteTag: vi.fn(),
  getTagsByJobId: vi.fn(() => []),
}

const mockJobService = {
  setJobTags: vi.fn(() => []),
}

let mockCurrentUser = adminUser

const mockUserService = {
  getUser: vi.fn(() => mockCurrentUser),
}

vi.stubGlobal('getServices', () => ({
  tagService: mockTagService,
  jobService: mockJobService,
  userService: mockUserService,
}))

vi.stubGlobal('getAuthUserId', () => mockCurrentUser.id)
vi.stubGlobal('getRouterParam', (_event: any, _name: string) => 'tag_1')
vi.stubGlobal('setResponseStatus', vi.fn())
vi.stubGlobal('parseBody', vi.fn(async () => ({ name: 'Test', tagIds: ['tag_1'] })))

// defineApiHandler: extract the inner handler and call it directly
vi.stubGlobal('defineApiHandler', (fn: any) => fn)

// --- Import route handlers AFTER stubs ---

const postTagHandler = (await import('~/server/api/tags/index.post')).default
const putTagHandler = (await import('~/server/api/tags/[id].put')).default
const deleteTagHandler = (await import('~/server/api/tags/[id].delete')).default
const putJobTagsHandler = (await import('~/server/api/jobs/[id]/tags.put')).default

// Minimal H3 event mock
function makeFakeEvent() {
  return {
    context: { auth: { user: { sub: mockCurrentUser.id } } },
    node: { req: {}, res: {} },
  } as any
}

describe('tag CRUD route admin gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentUser = adminUser
  })

  /**
   * Validates: Requirement 12.1
   * Non-admin users must be rejected with ForbiddenError on POST /api/tags
   */
  it('POST /api/tags rejects non-admin with ForbiddenError', async () => {
    mockCurrentUser = regularUser
    await expect(postTagHandler(makeFakeEvent())).rejects.toThrow(ForbiddenError)
    expect(mockTagService.createTag).not.toHaveBeenCalled()
  })

  /**
   * Validates: Requirement 12.1
   * Non-admin users must be rejected with ForbiddenError on PUT /api/tags/:id
   */
  it('PUT /api/tags/:id rejects non-admin with ForbiddenError', async () => {
    mockCurrentUser = regularUser
    await expect(putTagHandler(makeFakeEvent())).rejects.toThrow(ForbiddenError)
    expect(mockTagService.updateTag).not.toHaveBeenCalled()
  })

  /**
   * Validates: Requirement 12.1
   * Non-admin users must be rejected with ForbiddenError on DELETE /api/tags/:id
   */
  it('DELETE /api/tags/:id rejects non-admin with ForbiddenError', async () => {
    mockCurrentUser = regularUser
    await expect(deleteTagHandler(makeFakeEvent())).rejects.toThrow(ForbiddenError)
    expect(mockTagService.deleteTag).not.toHaveBeenCalled()
  })

  /**
   * Validates: Requirement 12.1 (positive case)
   * Admin users should be able to create tags
   */
  it('POST /api/tags succeeds for admin user', async () => {
    mockCurrentUser = adminUser
    const result = await postTagHandler(makeFakeEvent())
    expect(result).toBeDefined()
    expect(result.id).toBe('tag_1')
    expect(mockTagService.createTag).toHaveBeenCalled()
  })

  /**
   * Validates: Requirement 12.2
   * Any authenticated user (including non-admin) can assign tags to jobs
   */
  it('PUT /api/jobs/:id/tags succeeds for non-admin user', async () => {
    mockCurrentUser = regularUser
    // Should NOT throw — no admin check on this route
    const result = await putJobTagsHandler(makeFakeEvent())
    expect(mockJobService.setJobTags).toHaveBeenCalled()
    expect(result).toBeDefined()
  })
})
