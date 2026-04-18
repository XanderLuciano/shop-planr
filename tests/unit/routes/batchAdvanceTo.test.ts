/**
 * Unit tests for batchAdvanceToSchema and POST /api/parts/advance-to route.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { batchAdvanceToSchema } from '~/server/schemas/partSchemas'
import { ValidationError, NotFoundError, ForbiddenError, AuthenticationError } from '~/server/utils/errors'

// ── Schema Tests ──

describe('batchAdvanceToSchema', () => {
  it('accepts valid input with partIds and targetStepId', () => {
    const result = batchAdvanceToSchema.safeParse({
      partIds: ['part_1', 'part_2'],
      targetStepId: 'step_1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid input with optional skip flag', () => {
    const result = batchAdvanceToSchema.safeParse({
      partIds: ['part_1'],
      targetStepId: 'step_1',
      skip: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.skip).toBe(true)
    }
  })

  it('accepts input without skip (defaults to undefined)', () => {
    const result = batchAdvanceToSchema.safeParse({
      partIds: ['part_1'],
      targetStepId: 'step_1',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.skip).toBeUndefined()
    }
  })

  it('accepts exactly 100 partIds', () => {
    const partIds = Array.from({ length: 100 }, (_, i) => `part_${i}`)
    const result = batchAdvanceToSchema.safeParse({ partIds, targetStepId: 'step_1' })
    expect(result.success).toBe(true)
  })

  it('rejects missing targetStepId', () => {
    const result = batchAdvanceToSchema.safeParse({ partIds: ['part_1'] })
    expect(result.success).toBe(false)
  })

  it('rejects empty targetStepId', () => {
    const result = batchAdvanceToSchema.safeParse({ partIds: ['part_1'], targetStepId: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty partIds array', () => {
    const result = batchAdvanceToSchema.safeParse({ partIds: [], targetStepId: 'step_1' })
    expect(result.success).toBe(false)
  })

  it('rejects more than 100 partIds', () => {
    const partIds = Array.from({ length: 101 }, (_, i) => `part_${i}`)
    const result = batchAdvanceToSchema.safeParse({ partIds, targetStepId: 'step_1' })
    expect(result.success).toBe(false)
  })

  it('rejects missing partIds field', () => {
    const result = batchAdvanceToSchema.safeParse({ targetStepId: 'step_1' })
    expect(result.success).toBe(false)
  })

  it('rejects an array containing an empty string', () => {
    const result = batchAdvanceToSchema.safeParse({
      partIds: ['part_1', '', 'part_3'],
      targetStepId: 'step_1',
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

const mockLifecycleService = {
  advanceToStep: vi.fn(),
}

vi.stubGlobal('getServices', () => ({
  lifecycleService: mockLifecycleService,
}))

vi.stubGlobal('parseBody', vi.fn())
vi.stubGlobal('defineApiHandler', (fn: unknown) => fn)
vi.stubGlobal('getAuthUserId', () => 'test-user-id')

const handler = (await import('~/server/api/parts/advance-to.post')).default

function makeFakeEvent() {
  return {
    node: { req: {}, res: {} },
  } as unknown as Parameters<typeof handler>[0]
}

describe('POST /api/parts/advance-to route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Validates: Requirement 2.3, 2.4
   * Route returns correct advanced/failed counts for all-success case.
   */
  it('returns correct advanced/failed counts when all parts succeed', async () => {
    mockLifecycleService.advanceToStep.mockImplementation(() => {})

    vi.mocked(globalThis.parseBody as any).mockResolvedValue({
      partIds: ['part_a', 'part_b', 'part_c'],
      targetStepId: 'step_1',
      skip: false,
    })

    const result = await handler(makeFakeEvent())

    expect(result.advanced).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.results).toHaveLength(3)
    expect(result.results.every((r: any) => r.success)).toBe(true)
  })

  /**
   * Validates: Requirement 2.3, 2.5
   * Route collects per-part results with mixed success and failure.
   */
  it('collects per-part results with success and failure', async () => {
    mockLifecycleService.advanceToStep
      .mockImplementation((partId: string) => {
        if (partId === 'part_bad') throw new Error('Part is locked')
      })

    vi.mocked(globalThis.parseBody as any).mockResolvedValue({
      partIds: ['part_a', 'part_bad', 'part_c'],
      targetStepId: 'step_1',
    })

    const result = await handler(makeFakeEvent())

    expect(result.advanced).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.results).toEqual([
      { partId: 'part_a', success: true },
      { partId: 'part_bad', success: false, error: 'Part is locked' },
      { partId: 'part_c', success: true },
    ])
  })

  /**
   * Validates: Requirement 2.5
   * Route continues processing after individual part failures.
   */
  it('continues processing after individual part failures', async () => {
    mockLifecycleService.advanceToStep
      .mockImplementation((partId: string) => {
        if (partId === 'part_1') throw new Error('fail 1')
        if (partId === 'part_2') throw new Error('fail 2')
      })

    vi.mocked(globalThis.parseBody as any).mockResolvedValue({
      partIds: ['part_1', 'part_2', 'part_3'],
      targetStepId: 'step_1',
    })

    const result = await handler(makeFakeEvent())

    // All 3 parts were processed despite first two failing
    expect(result.results).toHaveLength(3)
    expect(result.advanced).toBe(1)
    expect(result.failed).toBe(2)
    expect(result.results[2]).toEqual({ partId: 'part_3', success: true })
  })

  /**
   * Validates: Requirement 2.3, 2.4
   * advanced + failed === partIds.length invariant holds.
   */
  it('maintains advanced + failed === partIds.length invariant', async () => {
    mockLifecycleService.advanceToStep
      .mockImplementation((partId: string) => {
        if (partId === 'part_2' || partId === 'part_4') throw new Error('fail')
      })

    const partIds = ['part_1', 'part_2', 'part_3', 'part_4', 'part_5']
    vi.mocked(globalThis.parseBody as any).mockResolvedValue({
      partIds,
      targetStepId: 'step_1',
    })

    const result = await handler(makeFakeEvent())

    expect(result.advanced + result.failed).toBe(partIds.length)
  })

  /**
   * Validates: Requirement 2.1
   * Route passes correct arguments to lifecycleService.advanceToStep.
   */
  it('passes targetStepId, skip, and userId to advanceToStep', async () => {
    mockLifecycleService.advanceToStep.mockImplementation(() => {})

    vi.mocked(globalThis.parseBody as any).mockResolvedValue({
      partIds: ['part_a'],
      targetStepId: 'step_target',
      skip: true,
    })

    await handler(makeFakeEvent())

    expect(mockLifecycleService.advanceToStep).toHaveBeenCalledWith('part_a', {
      targetStepId: 'step_target',
      skip: true,
      userId: 'test-user-id',
    })
  })

  /**
   * Validates: Requirement 2.2
   * Route calls parseBody with the batchAdvanceToSchema for validation.
   */
  it('calls parseBody to validate the request body', async () => {
    vi.mocked(globalThis.parseBody as any).mockResolvedValue({
      partIds: [],
      targetStepId: 'step_1',
    })

    await handler(makeFakeEvent())

    expect(globalThis.parseBody).toHaveBeenCalledWith(
      expect.anything(),
      batchAdvanceToSchema,
    )
  })
})
