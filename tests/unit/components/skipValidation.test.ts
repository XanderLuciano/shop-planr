/**
 * Unit tests for skip optional step validation logic.
 *
 * Tests the shared executeSkip function used by Step View.
 * - Rejects when there is no next step
 * - Calls batchAdvanceToStep with correct partIds and targetStepId
 *
 * Validates: Requirements 7.2
 */
import { describe, it, expect, vi } from 'vitest'
import { executeSkip } from '~/app/utils/skipStep'

describe('Skip validation', () => {
  it('rejects when there is no next step (final step)', async () => {
    const batchAdvanceToStep = vi.fn()

    const result = await executeSkip({
      partIds: ['PART-001'],
      nextStepId: undefined,
      batchAdvanceToStep,
    })

    expect(result.skipped).toBe(false)
    expect(result.error).toBe('No next step')
    expect(batchAdvanceToStep).not.toHaveBeenCalled()
  })

  it('calls batchAdvanceToStep with all partIds in a single bulk call', async () => {
    const batchAdvanceToStep = vi.fn().mockResolvedValue({
      advanced: 3,
      failed: 0,
      results: [
        { partId: 'PART-001', success: true },
        { partId: 'PART-002', success: true },
        { partId: 'PART-003', success: true },
      ],
    })

    const result = await executeSkip({
      partIds: ['PART-001', 'PART-002', 'PART-003'],
      nextStepId: 'step-next-abc',
      batchAdvanceToStep,
    })

    expect(result.skipped).toBe(true)
    expect(result.count).toBe(3)
    expect(batchAdvanceToStep).toHaveBeenCalledTimes(1)
    expect(batchAdvanceToStep).toHaveBeenCalledWith({
      partIds: ['PART-001', 'PART-002', 'PART-003'],
      targetStepId: 'step-next-abc',
      skip: true,
    })
  })

  it('calls batchAdvanceToStep for a single part', async () => {
    const batchAdvanceToStep = vi.fn().mockResolvedValue({
      advanced: 1,
      failed: 0,
      results: [
        { partId: 'PART-SOLO', success: true },
      ],
    })

    const result = await executeSkip({
      partIds: ['PART-SOLO'],
      nextStepId: 'step-2',
      batchAdvanceToStep,
    })

    expect(result.skipped).toBe(true)
    expect(result.count).toBe(1)
    expect(batchAdvanceToStep).toHaveBeenCalledTimes(1)
    expect(batchAdvanceToStep).toHaveBeenCalledWith({
      partIds: ['PART-SOLO'],
      targetStepId: 'step-2',
      skip: true,
    })
  })

  it('returns count from batch response when some parts fail', async () => {
    const batchAdvanceToStep = vi.fn().mockResolvedValue({
      advanced: 2,
      failed: 1,
      results: [
        { partId: 'PART-001', success: true },
        { partId: 'PART-002', success: false, error: 'Part not found' },
        { partId: 'PART-003', success: true },
      ],
    })

    const result = await executeSkip({
      partIds: ['PART-001', 'PART-002', 'PART-003'],
      nextStepId: 'step-next',
      batchAdvanceToStep,
    })

    expect(result.skipped).toBe(true)
    expect(result.count).toBe(2)
  })
})
