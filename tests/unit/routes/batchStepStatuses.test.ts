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
  getStepStatusViews: vi.fn(),
}

vi.stubGlobal('getServices', () => ({
  lifecycleService: mockLifecycleService,
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
  })

  /**
   * Validates: Requirement 4.1, 4.3
   * Route returns correct step statuses for valid parts via lifecycleService.getStepStatusViews.
   */
  it('returns step statuses for each valid part', async () => {
    const viewsA = [
      { stepId: 's1', stepName: 'Cut', stepOrder: 0, status: 'completed', optional: false, dependencyType: 'preferred', hasOverride: false },
      { stepId: 's2', stepName: 'Weld', stepOrder: 1, status: 'pending', optional: false, dependencyType: 'preferred', hasOverride: false },
    ]
    const viewsB = [
      { stepId: 's3', stepName: 'Paint', stepOrder: 0, status: 'in_progress', optional: false, dependencyType: 'preferred', hasOverride: false },
    ]

    mockLifecycleService.getStepStatusViews
      .mockImplementation((id: string) => {
        if (id === 'part_a') return viewsA
        if (id === 'part_b') return viewsB
        throw new NotFoundError('Part', id)
      })

    vi.mocked(globalThis.parseBody as any).mockResolvedValue({ partIds: ['part_a', 'part_b'] })

    const result = await handler(makeFakeEvent())

    expect(result).toEqual({
      part_a: viewsA,
      part_b: viewsB,
    })
  })

  /**
   * Validates: Requirement 4.4
   * Missing parts are omitted from the result (no error).
   */
  it('omits missing parts from the result', async () => {
    const viewsA = [
      { stepId: 's1', stepName: 'Cut', stepOrder: 0, status: 'completed', optional: false, dependencyType: 'preferred', hasOverride: false },
    ]

    mockLifecycleService.getStepStatusViews
      .mockImplementation((id: string) => {
        if (id === 'part_a') return viewsA
        throw new NotFoundError('Part', id)
      })

    vi.mocked(globalThis.parseBody as any).mockResolvedValue({ partIds: ['part_a', 'part_missing'] })

    const result = await handler(makeFakeEvent())

    expect(result).toEqual({ part_a: viewsA })
    expect(result).not.toHaveProperty('part_missing')
  })

  /**
   * Validates: Requirement 4.3
   * Returns empty object when all parts are missing.
   */
  it('returns empty object when all parts are missing', async () => {
    mockLifecycleService.getStepStatusViews.mockImplementation((id: string) => {
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
