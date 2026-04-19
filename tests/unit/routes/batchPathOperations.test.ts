/**
 * Unit tests for batchPathOperationsSchema and POST /api/jobs/:id/paths/batch route.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { batchPathOperationsSchema } from '~/server/schemas/pathSchemas'
import { ValidationError, NotFoundError, ForbiddenError, AuthenticationError } from '~/server/utils/errors'

// ── Schema Tests ──

describe('batchPathOperationsSchema', () => {
  const validStep = { name: 'Cut', location: 'Bay 1' }

  const validCreate = {
    name: 'Path A',
    goalQuantity: 10,
    steps: [validStep],
  }

  const validUpdate = {
    pathId: 'path_1',
    name: 'Updated Path',
  }

  /**
   * Validates: Requirement 1.1
   * Schema accepts create-only operations.
   */
  it('accepts create-only operations', () => {
    const result = batchPathOperationsSchema.safeParse({
      create: [validCreate],
    })
    expect(result.success).toBe(true)
  })

  /**
   * Validates: Requirement 1.3
   * Schema accepts update-only operations.
   */
  it('accepts update-only operations', () => {
    const result = batchPathOperationsSchema.safeParse({
      update: [validUpdate],
    })
    expect(result.success).toBe(true)
  })

  /**
   * Validates: Requirement 1.4
   * Schema accepts delete-only operations.
   */
  it('accepts delete-only operations', () => {
    const result = batchPathOperationsSchema.safeParse({
      delete: ['path_1', 'path_2'],
    })
    expect(result.success).toBe(true)
  })

  /**
   * Validates: Requirements 1.1, 1.3, 1.4
   * Schema accepts mixed create/update/delete operations.
   */
  it('accepts mixed create, update, and delete operations', () => {
    const result = batchPathOperationsSchema.safeParse({
      create: [validCreate],
      update: [validUpdate],
      delete: ['path_99'],
    })
    expect(result.success).toBe(true)
  })

  /**
   * Validates: Requirement 1.5
   * Schema rejects when all arrays are empty (refine check).
   */
  it('rejects when all arrays are empty', () => {
    const result = batchPathOperationsSchema.safeParse({
      create: [],
      update: [],
      delete: [],
    })
    expect(result.success).toBe(false)
  })

  /**
   * Validates: Requirement 1.5
   * Schema rejects an empty body (defaults all to [] then refine fails).
   */
  it('rejects an empty body', () => {
    const result = batchPathOperationsSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  /**
   * Validates: Requirement 1.2
   * Create items require name.
   */
  it('rejects create item missing name', () => {
    const result = batchPathOperationsSchema.safeParse({
      create: [{ goalQuantity: 10, steps: [validStep] }],
    })
    expect(result.success).toBe(false)
  })

  /**
   * Validates: Requirement 1.2
   * Create items require goalQuantity.
   */
  it('rejects create item missing goalQuantity', () => {
    const result = batchPathOperationsSchema.safeParse({
      create: [{ name: 'Path A', steps: [validStep] }],
    })
    expect(result.success).toBe(false)
  })

  /**
   * Validates: Requirement 1.2
   * Create items require at least one step.
   */
  it('rejects create item with empty steps array', () => {
    const result = batchPathOperationsSchema.safeParse({
      create: [{ name: 'Path A', goalQuantity: 10, steps: [] }],
    })
    expect(result.success).toBe(false)
  })

  /**
   * Validates: Requirement 1.2
   * Steps require a name.
   */
  it('rejects create item with step missing name', () => {
    const result = batchPathOperationsSchema.safeParse({
      create: [{ name: 'Path A', goalQuantity: 10, steps: [{ location: 'Bay 1' }] }],
    })
    expect(result.success).toBe(false)
  })

  /**
   * Validates: Requirement 1.3
   * Update items require pathId.
   */
  it('rejects update item missing pathId', () => {
    const result = batchPathOperationsSchema.safeParse({
      update: [{ name: 'Updated' }],
    })
    expect(result.success).toBe(false)
  })

  /**
   * Validates: Requirement 1.3
   * Update items with steps require at least one step.
   */
  it('rejects update item with empty steps array', () => {
    const result = batchPathOperationsSchema.safeParse({
      update: [{ pathId: 'path_1', steps: [] }],
    })
    expect(result.success).toBe(false)
  })

  /**
   * Validates: Requirement 1.4
   * Delete items must be non-empty strings.
   */
  it('rejects delete array containing empty string', () => {
    const result = batchPathOperationsSchema.safeParse({
      delete: ['path_1', ''],
    })
    expect(result.success).toBe(false)
  })

  /**
   * Validates: Requirement 1.2
   * Create items accept optional advancementMode.
   */
  it('accepts create item with optional advancementMode', () => {
    const result = batchPathOperationsSchema.safeParse({
      create: [{
        name: 'Path A',
        goalQuantity: 10,
        advancementMode: 'flexible',
        steps: [validStep],
      }],
    })
    expect(result.success).toBe(true)
  })

  /**
   * Validates: Requirement 1.2
   * goalQuantity must be a positive integer.
   */
  it('rejects create item with non-positive goalQuantity', () => {
    const result = batchPathOperationsSchema.safeParse({
      create: [{ name: 'Path A', goalQuantity: 0, steps: [validStep] }],
    })
    expect(result.success).toBe(false)
  })
})

// ── Route Tests ──

// Stub Nitro auto-imports before importing the route handler
vi.stubGlobal('ValidationError', ValidationError)
vi.stubGlobal('NotFoundError', NotFoundError)
vi.stubGlobal('ForbiddenError', ForbiddenError)
vi.stubGlobal('AuthenticationError', AuthenticationError)
vi.stubGlobal('createError', (await import('h3')).createError)

const mockPathService = {
  batchPathOperations: vi.fn(),
}

const mockJobService = {
  getJob: vi.fn(),
}

vi.stubGlobal('getServices', () => ({
  pathService: mockPathService,
  jobService: mockJobService,
}))

vi.stubGlobal('parseBody', vi.fn())
vi.stubGlobal('getAuthUserId', vi.fn().mockReturnValue('user_1'))
vi.stubGlobal('getRouterParam', vi.fn().mockReturnValue('job_1'))
vi.stubGlobal('defineApiHandler', (fn: unknown) => fn)

const handler = (await import('~/server/api/jobs/[id]/paths/batch.post')).default

function makeFakeEvent() {
  return {
    node: { req: {}, res: {} },
  } as unknown as Parameters<typeof handler>[0]
}

describe('POST /api/jobs/:id/paths/batch route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockJobService.getJob.mockReturnValue({ id: 'job_1', name: 'Test Job' })
  })

  /**
   * Validates: Requirement 1.5
   * Route calls parseBody with the batchPathOperationsSchema for validation.
   */
  it('calls parseBody to validate the request body', async () => {
    vi.mocked(globalThis.parseBody as any).mockResolvedValue({
      create: [], update: [], delete: [],
    })
    mockPathService.batchPathOperations.mockReturnValue({
      created: [], updated: [], deleted: [],
    })

    await handler(makeFakeEvent())

    expect(globalThis.parseBody).toHaveBeenCalledWith(
      expect.anything(),
      batchPathOperationsSchema,
    )
  })

  /**
   * Validates: Requirement 1.8
   * Route verifies job exists before processing operations.
   */
  it('verifies job exists via jobService.getJob', async () => {
    vi.mocked(globalThis.parseBody as any).mockResolvedValue({
      create: [], update: [], delete: [],
    })
    mockPathService.batchPathOperations.mockReturnValue({
      created: [], updated: [], deleted: [],
    })

    await handler(makeFakeEvent())

    expect(mockJobService.getJob).toHaveBeenCalledWith('job_1')
  })

  /**
   * Validates: Requirement 1.7
   * Route delegates to pathService.batchPathOperations with correct input.
   */
  it('delegates to pathService.batchPathOperations with correct input', async () => {
    const batchResult = {
      created: [{ id: 'path_new', name: 'New Path' }],
      updated: [{ id: 'path_2', name: 'Updated Path' }],
      deleted: ['path_99'],
    }
    mockPathService.batchPathOperations.mockReturnValue(batchResult)

    const body = {
      create: [{ name: 'New Path', goalQuantity: 5, steps: [{ name: 'Step 1' }] }],
      update: [{ pathId: 'path_2', name: 'Updated Path' }],
      delete: ['path_99'],
    }
    vi.mocked(globalThis.parseBody as any).mockResolvedValue(body)

    const result = await handler(makeFakeEvent())

    expect(mockPathService.batchPathOperations).toHaveBeenCalledWith({
      jobId: 'job_1',
      userId: 'user_1',
      create: body.create,
      update: body.update,
      delete: body.delete,
    })
    expect(result).toEqual(batchResult)
  })

  /**
   * Validates: Requirement 1.8
   * If the service method fails, the error propagates (transaction rollback).
   */
  it('propagates errors from batchPathOperations', async () => {
    mockPathService.batchPathOperations.mockImplementation(() => {
      throw new NotFoundError('Path', 'path_missing')
    })

    vi.mocked(globalThis.parseBody as any).mockResolvedValue({
      create: [],
      update: [],
      delete: ['path_missing'],
    })

    await expect(handler(makeFakeEvent())).rejects.toThrow('Path not found')
  })

  /**
   * Validates: Requirement 1.8
   * Job not found propagates as error before any operations.
   */
  it('throws when job does not exist', async () => {
    mockJobService.getJob.mockImplementation(() => {
      throw new NotFoundError('Job', 'job_missing')
    })

    vi.mocked(globalThis.parseBody as any).mockResolvedValue({
      create: [{ name: 'New', goalQuantity: 1, steps: [{ name: 'S1' }] }],
      update: [],
      delete: [],
    })

    await expect(handler(makeFakeEvent())).rejects.toThrow('Job not found')
    expect(mockPathService.batchPathOperations).not.toHaveBeenCalled()
  })

  /**
   * Validates: Requirement 1.7
   * Route handles create-only operations correctly.
   */
  it('handles create-only operations', async () => {
    const batchResult = {
      created: [{ id: 'path_new', name: 'New Path' }],
      updated: [],
      deleted: [],
    }
    mockPathService.batchPathOperations.mockReturnValue(batchResult)

    vi.mocked(globalThis.parseBody as any).mockResolvedValue({
      create: [{ name: 'New Path', goalQuantity: 5, steps: [{ name: 'S1' }] }],
      update: [],
      delete: [],
    })

    const result = await handler(makeFakeEvent())

    expect(result).toEqual(batchResult)
  })

  /**
   * Validates: Requirement 1.7
   * Route handles delete-only operations correctly.
   */
  it('handles delete-only operations', async () => {
    const batchResult = {
      created: [],
      updated: [],
      deleted: ['path_1', 'path_2'],
    }
    mockPathService.batchPathOperations.mockReturnValue(batchResult)

    vi.mocked(globalThis.parseBody as any).mockResolvedValue({
      create: [],
      update: [],
      delete: ['path_1', 'path_2'],
    })

    const result = await handler(makeFakeEvent())

    expect(result).toEqual(batchResult)
  })
})
