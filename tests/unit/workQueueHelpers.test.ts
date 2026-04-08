import { describe, it, expect } from 'vitest'
import { findFirstActiveStep, shouldIncludeStep } from '~/server/utils/workQueueHelpers'
import type { ProcessStep } from '~/server/types/domain'

/** Minimal ProcessStep factory — only fields the helpers inspect. */
function makeStep(overrides: Partial<ProcessStep> & { order: number }): ProcessStep {
  return {
    id: `step-${overrides.order}`,
    name: `Step ${overrides.order}`,
    order: overrides.order,
    optional: false,
    dependencyType: 'physical',
    completedCount: 0,
    ...overrides,
  }
}

describe('findFirstActiveStep', () => {
  it('returns the step with lowest order when all steps are active', () => {
    const steps = [makeStep({ order: 0 }), makeStep({ order: 1 }), makeStep({ order: 2 })]
    const result = findFirstActiveStep(steps)
    expect(result).toBeDefined()
    expect(result!.order).toBe(0)
  })

  it('skips soft-deleted first step and returns next non-removed step', () => {
    const steps = [
      makeStep({ order: 0, removedAt: '2024-01-01T00:00:00Z' }),
      makeStep({ order: 1 }),
      makeStep({ order: 2 }),
    ]
    const result = findFirstActiveStep(steps)
    expect(result).toBeDefined()
    expect(result!.order).toBe(1)
  })

  it('returns undefined when all steps are soft-deleted', () => {
    const steps = [
      makeStep({ order: 0, removedAt: '2024-01-01T00:00:00Z' }),
      makeStep({ order: 1, removedAt: '2024-01-01T00:00:00Z' }),
    ]
    expect(findFirstActiveStep(steps)).toBeUndefined()
  })

  it('returns undefined for an empty steps array', () => {
    expect(findFirstActiveStep([])).toBeUndefined()
  })
})

describe('shouldIncludeStep', () => {
  const goalQuantity = 10

  it('returns true when partCount > 0 regardless of first-active status', () => {
    const step = makeStep({ order: 0, completedCount: 0 })
    expect(shouldIncludeStep(step, 5, false, goalQuantity)).toBe(true)
    expect(shouldIncludeStep(step, 5, true, goalQuantity)).toBe(true)
  })

  it('returns true for first-active step with completedCount = 0 and partCount = 0', () => {
    const step = makeStep({ order: 0, completedCount: 0 })
    expect(shouldIncludeStep(step, 0, true, goalQuantity)).toBe(true)
  })

  it('returns true for first-active step with completedCount = goalQuantity - 1', () => {
    const step = makeStep({ order: 0, completedCount: goalQuantity - 1 })
    expect(shouldIncludeStep(step, 0, true, goalQuantity)).toBe(true)
  })

  it('returns false for first-active step with completedCount = goalQuantity (goal met)', () => {
    const step = makeStep({ order: 0, completedCount: goalQuantity })
    expect(shouldIncludeStep(step, 0, true, goalQuantity)).toBe(false)
  })

  it('returns false for first-active step with completedCount > goalQuantity', () => {
    const step = makeStep({ order: 0, completedCount: goalQuantity + 1 })
    expect(shouldIncludeStep(step, 0, true, goalQuantity)).toBe(false)
  })

  it('returns false for non-first-active step with partCount = 0', () => {
    const step = makeStep({ order: 2, completedCount: 0 })
    expect(shouldIncludeStep(step, 0, false, goalQuantity)).toBe(false)
  })

  it('non-first-active steps are never force-included even with low completedCount', () => {
    const step = makeStep({ order: 3, completedCount: 0 })
    expect(shouldIncludeStep(step, 0, false, goalQuantity)).toBe(false)
    expect(shouldIncludeStep(step, 0, false, 1)).toBe(false)
  })
})
