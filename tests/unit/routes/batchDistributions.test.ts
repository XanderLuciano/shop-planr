/**
 * Unit tests for batchDistributionsSchema and POST /api/paths/batch-distributions route.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { batchDistributionsSchema } from '~/server/schemas/pathSchemas'
import { ValidationError, NotFoundError, ForbiddenError, AuthenticationError } from '~/server/utils/errors'

// ── Schema Tests ──

describe('batchDistributionsSchema', () => {
  it('accepts a valid pathIds array', () => {
    const result = batchDistributionsSchema.safeParse({ pathIds: ['path_1', 'path_2'] })
    expect(result.success).toBe(true)
  })

  it('accepts a single-element array', () => {
    const result = batchDistributionsSchema.safeParse({ pathIds: ['path_1'] })
    expect(result.success).toBe(true)
  })

  it('accepts exactly 100 elements', () => {
    const pathIds = Array.from({ length: 100 }, (_, i) => `path_${i}`)
    const result = batchDistributionsSchema.safeParse({ pathIds })
    expect(result.success).toBe(true)
  })

  it('rejects an empty array', () => {
    const result = batchDistributionsSchema.safeParse({ pathIds: [] })
    expect(result.success).toBe(false)
  })

  it('rejects missing pathIds field', () => {
    const result = batchDistributionsSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects more than 100 elements', () => {
    const pathIds = Array.from({ length: 101 }, (_, i) => `path_${i}`)
    const result = batchDistributionsSchema.safeParse({ pathIds })
    expect(result.success).toBe(false)
  })

  it('rejects an array containing an empty string', () => {
    const result = batchDistributionsSchema.safeParse({ pathIds: ['path_1', '', 'path_3'] })
    expect(result.success).toBe(false)
  })

  it('rejects non-array input for pathIds', () => {
    const result = batchDistributionsSchema.safeParse({ pathIds: 'not-an-array' })
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
  getStepDistribution: vi.fn(),
  getPathCompletedCount: vi.fn(),
}

vi.stubGlobal('getServices', () => ({
  pathService: mockPathService,
}))

vi.stubGlobal('parseBody', vi.fn())
vi.stubGlobal('defineApiHandler', (fn: unknown) => fn)

const handler = (await import('~/server/api/paths/batch-distributions.post')).default

function makeFakeEvent() {
  return {
    node: { req: {}, res: {} },
  } as unknown as Parameters<typeof handler>[0]
}

describe('POST /api/paths/batch-distributions route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Validates: Requirement 5.1, 5.3
   * Route returns correct distribution data for valid paths.
   */
  it('returns distribution and completedCount for each valid path', async () => {
    const distA = [{ stepId: 's1', stepName: 'Cut', partCount: 3, completedCount: 0, isBottleneck: false }]
    const distB = [{ stepId: 's2', stepName: 'Weld', partCount: 1, completedCount: 2, isBottleneck: false }]

    mockPathService.getStepDistribution
      .mockImplementation((id: string) => {
        if (id === 'path_a') return distA
        if (id === 'path_b') return distB
        throw new NotFoundError('Path', id)
      })
    mockPathService.getPathCompletedCount
      .mockImplementation((id: string) => {
        if (id === 'path_a') return 5
        if (id === 'path_b') return 10
        throw new NotFoundError('Path', id)
      })

    vi.mocked(globalThis.parseBody as any).mockResolvedValue({ pathIds: ['path_a', 'path_b'] })

    const result = await handler(makeFakeEvent())

    expect(result).toEqual({
      path_a: { distribution: distA, completedCount: 5 },
      path_b: { distribution: distB, completedCount: 10 },
    })
  })

  /**
   * Validates: Requirement 5.4
   * Missing paths are omitted from the result (no error).
   */
  it('omits missing paths from the result', async () => {
    const distA = [{ stepId: 's1', stepName: 'Cut', partCount: 3, completedCount: 0, isBottleneck: false }]

    mockPathService.getStepDistribution
      .mockImplementation((id: string) => {
        if (id === 'path_a') return distA
        throw new NotFoundError('Path', id)
      })
    mockPathService.getPathCompletedCount
      .mockImplementation((id: string) => {
        if (id === 'path_a') return 5
        throw new NotFoundError('Path', id)
      })

    vi.mocked(globalThis.parseBody as any).mockResolvedValue({ pathIds: ['path_a', 'path_missing'] })

    const result = await handler(makeFakeEvent())

    expect(result).toEqual({
      path_a: { distribution: distA, completedCount: 5 },
    })
    expect(result).not.toHaveProperty('path_missing')
  })

  /**
   * Validates: Requirement 5.3
   * Returns empty object when all paths are missing.
   */
  it('returns empty object when all paths are missing', async () => {
    mockPathService.getStepDistribution.mockImplementation((id: string) => {
      throw new NotFoundError('Path', id)
    })
    mockPathService.getPathCompletedCount.mockImplementation((id: string) => {
      throw new NotFoundError('Path', id)
    })

    vi.mocked(globalThis.parseBody as any).mockResolvedValue({ pathIds: ['missing_1', 'missing_2'] })

    const result = await handler(makeFakeEvent())

    expect(result).toEqual({})
  })

  /**
   * Validates: Requirement 5.1
   * Route calls parseBody with the batchDistributionsSchema for validation.
   */
  it('calls parseBody to validate the request body', async () => {
    vi.mocked(globalThis.parseBody as any).mockResolvedValue({ pathIds: [] })

    await handler(makeFakeEvent())

    expect(globalThis.parseBody).toHaveBeenCalledWith(
      expect.anything(),
      batchDistributionsSchema,
    )
  })
})
