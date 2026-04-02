/**
 * Unit tests for skip optional step validation logic.
 *
 * Tests the shared executeSkip function used by Step View.
 * - Rejects when no operator is selected
 * - Rejects when there is no next step
 * - Calls advanceToStep with correct targetStepId for each part
 *
 * Validates: Requirements 2.2, 2.3
 */
import { describe, it, expect, vi } from 'vitest'
import { executeSkip } from '~/app/utils/skipStep'

describe('Skip validation', () => {
  it('rejects when no operator is selected', async () => {
    const advanceToStep = vi.fn()

    const result = await executeSkip({
      partIds: ['PART-001', 'PART-002'],
      operatorId: null,
      nextStepId: 'step-next',
      advanceToStep,
    })

    expect(result.skipped).toBe(false)
    expect(result.error).toBe('Operator required')
    expect(advanceToStep).not.toHaveBeenCalled()
  })

  it('rejects when there is no next step (final step)', async () => {
    const advanceToStep = vi.fn()

    const result = await executeSkip({
      partIds: ['PART-001'],
      operatorId: 'user-1',
      nextStepId: undefined,
      advanceToStep,
    })

    expect(result.skipped).toBe(false)
    expect(result.error).toBe('No next step')
    expect(advanceToStep).not.toHaveBeenCalled()
  })

  it('calls advanceToStep with correct targetStepId for each part', async () => {
    const advanceToStep = vi.fn().mockResolvedValue({ serial: {}, bypassed: [] })

    const result = await executeSkip({
      partIds: ['PART-001', 'PART-002', 'PART-003'],
      operatorId: 'user-42',
      nextStepId: 'step-next-abc',
      advanceToStep,
    })

    expect(result.skipped).toBe(true)
    expect(result.count).toBe(3)
    expect(advanceToStep).toHaveBeenCalledTimes(3)
    expect(advanceToStep).toHaveBeenNthCalledWith(1, 'PART-001', {
      targetStepId: 'step-next-abc',
      userId: 'user-42',
    })
    expect(advanceToStep).toHaveBeenNthCalledWith(2, 'PART-002', {
      targetStepId: 'step-next-abc',
      userId: 'user-42',
    })
    expect(advanceToStep).toHaveBeenNthCalledWith(3, 'PART-003', {
      targetStepId: 'step-next-abc',
      userId: 'user-42',
    })
  })

  it('calls advanceToStep for a single part', async () => {
    const advanceToStep = vi.fn().mockResolvedValue({ serial: {}, bypassed: [] })

    const result = await executeSkip({
      partIds: ['PART-SOLO'],
      operatorId: 'op-1',
      nextStepId: 'step-2',
      advanceToStep,
    })

    expect(result.skipped).toBe(true)
    expect(result.count).toBe(1)
    expect(advanceToStep).toHaveBeenCalledTimes(1)
    expect(advanceToStep).toHaveBeenCalledWith('PART-SOLO', {
      targetStepId: 'step-2',
      userId: 'op-1',
    })
  })
})
