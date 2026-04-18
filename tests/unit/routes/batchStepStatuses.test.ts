/**
 * Unit tests for batchStepStatusesSchema and POST /api/parts/batch-step-statuses route.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { batchStepStatusesSchema } from '~/server/schemas/partSchemas'
import { ValidationError, NotFoundError, ForbiddenError, AuthenticationError } from '~/server/utils/errors'

// ── Schema Tests ──

describe('batchStepStatusesSchema', () => {
  it('accepts a valid partIds array', () => {
    const result = batchStepStatusesSchema.safeParse({ partIds: ['part_1', 'part_2'] })
    expect(result.success).toBe(true)
  })

  it('accepts a single-element array', () => {
    const result = batchStepStatusesSchema.safeParse({ partIds: ['part_1'] })
    expect(result.success).toBe(true)
  })

  it('accepts exactly 500 elements', () => {
    const partIds = Array.from({ length: 500 }, (_, i) => `part_${i}`)
    const result = batchStepStatusesSchema.safeParse({ partIds })
    expect(result.success).toBe(true)
  })

  it('rejects an empty array', () => {
    const result = batchStepStatusesSchema.safeParse({ partIds: [] })
    expect(result.success).toBe(false)
  })

  it('rejects more than 500 elements', () => {
    const partIds = Array.from({ length: 501 }, (_, i) => `part_${i}`)
    const result = batchStepStatusesSchema.safeParse({ partIds })
    expect(result.success).toBe(false)
  })

  it('rejects an array containing an empty string', () => {
    const result = batchStepStatusesSchema.safeParse({ partIds: ['part_1', '', 'part_3'] })
    expect(result.success).toBe(false)
  })

  it('rejects non-array input for partIds', () => {
    const result = batchStepStatusesSchema.safeParse({ partIds: 'not-an-array' })
    expect(result.success).toBe(false)
  })

  it('rejects missing partIds field', () => {
    const result = batchStepStatusesSchema.safeParse({})
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

const mockLifecycleService = {
  getStepStatuses: vi.fn(),
}

const mockPartsRepo = {
  getById: vi.fn(),
}

const mockPathsRepo = {
  getById: vi.fn(),
}

const mockPartStepOverridesRepo = {
  listByPartId: vi.fn().mockReturnValue([]),
}

vi.stubGlobal('getServices', () => ({
  lifecycleService: mockLifecycleService,
}))

vi.stubGlobal('getRepositories', () => ({
  parts: mockPartsRepo,
  paths: mockPathsRepo,
  partStepOverrides: mockPartStepOverridesRepo,
}))

vi.stubGlobal('parseBody', vi.fn())
vi.stubGlobal('defineApiHandler', (fn: unknown) => fn)

const handler = (await import('~/server/api/parts/batch-step-statuses.post')).default

function makeFakeEvent() {
  return {
    node: { req: {}, res: {} },
  } as unknown as Parameters<typeof handler>[0]
}

describe('POST /api/parts/batch-step-statuses route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPartStepOverridesRepo.listByPartId.mockReturnValue([])
  })

  /**
   * Validates: Requirement 4.1, 4.3
   * Route returns correct step statuses for valid parts.
   */
  it('returns step statuses for each valid part', async () => {
    const rawStatusesA = [
      { stepId: 's1', status: 'completed', sequenceNumber: 1 },
      { stepId: 's2', status: 'pending', sequenceNumber: 1 },
    ]
    const rawStatusesB = [
      { stepId: 's3', status: 'in_progress', sequenceNumber: 1 },
    ]

    mockLifecycleService.getStepStatuses
      .mockImplementation((id: string) => {
        if (id === 'part_a') return rawStatusesA
        if (id === 'part_b') return rawStatusesB
        throw new NotFoundError('Part', id)
      })

    mockPartsRepo.getById.mockImplementation((id: string) => {
      if (id === 'part_a') return { id: 'part_a', pathId: 'path_a' }
      if (id === 'part_b') return { id: 'part_b', pathId: 'path_b' }
      return null
    })

    mockPathsRepo.getById.mockImplementation((id: string) => {
      if (id === 'path_a') return { id: 'path_a', steps: [{ id: 's1', name: 'Cut', order: 0, optional: false, dependencyType: 'preferred' }, { id: 's2', name: 'Weld', order: 1, optional: false, dependencyType: 'preferred' }] }
      if (id === 'path_b') return { id: 'path_b', steps: [{ id: 's3', name: 'Paint', order: 0, optional: false, dependencyType: 'preferred' }] }
      return null
    })

    vi.mocked(globalThis.parseBody as any).mockResolvedValue({ partIds: ['part_a', 'part_b'] })

    const result = await handler(makeFakeEvent())

    expect(result).toEqual({
      part_a: [
        { stepId: 's1', stepName: 'Cut', stepOrder: 0, status: 'completed', optional: false, dependencyType: 'preferred', hasOverride: false },
        { stepId: 's2', stepName: 'Weld', stepOrder: 1, status: 'pending', optional: false, dependencyType: 'preferred', hasOverride: false },
      ],
      part_b: [
        { stepId: 's3', stepName: 'Paint', stepOrder: 0, status: 'in_progress', optional: false, dependencyType: 'preferred', hasOverride: false },
      ],
    })
  })

  /**
   * Validates: Requirement 4.4
   * Missing parts are omitted from the result (no error).
   */
  it('omits missing parts from the result', async () => {
    const rawStatusesA = [
      { stepId: 's1', status: 'completed', sequenceNumber: 1 },
    ]

    mockLifecycleService.getStepStatuses
      .mockImplementation((id: string) => {
        if (id === 'part_a') return rawStatusesA
        throw new NotFoundError('Part', id)
      })

    mockPartsRepo.getById.mockImplementation((id: string) => {
      if (id === 'part_a') return { id: 'part_a', pathId: 'path_a' }
      return null
    })

    mockPathsRepo.getById.mockImplementation((id: string) => {
      if (id === 'path_a') return { id: 'path_a', steps: [{ id: 's1', name: 'Cut', order: 0, optional: false, dependencyType: 'preferred' }] }
      return null
    })

    vi.mocked(globalThis.parseBody as any).mockResolvedValue({ partIds: ['part_a', 'part_missing'] })

    const result = await handler(makeFakeEvent())

    expect(result).toEqual({
      part_a: [
        { stepId: 's1', stepName: 'Cut', stepOrder: 0, status: 'completed', optional: false, dependencyType: 'preferred', hasOverride: false },
      ],
    })
    expect(result).not.toHaveProperty('part_missing')
  })

  /**
   * Validates: Requirement 4.3
   * Returns empty object when all parts are missing.
   */
  it('returns empty object when all parts are missing', async () => {
    mockLifecycleService.getStepStatuses.mockImplementation((id: string) => {
      throw new NotFoundError('Part', id)
    })

    vi.mocked(globalThis.parseBody as any).mockResolvedValue({ partIds: ['missing_1', 'missing_2'] })

    const result = await handler(makeFakeEvent())

    expect(result).toEqual({})
  })

  /**
   * Validates: Requirement 4.2
   * Route calls parseBody with the batchStepStatusesSchema for validation.
   */
  it('calls parseBody to validate the request body', async () => {
    vi.mocked(globalThis.parseBody as any).mockResolvedValue({ partIds: [] })

    await handler(makeFakeEvent())

    expect(globalThis.parseBody).toHaveBeenCalledWith(
      expect.anything(),
      batchStepStatusesSchema,
    )
  })
})
