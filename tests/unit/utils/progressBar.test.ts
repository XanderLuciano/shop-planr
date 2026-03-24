import { describe, it, expect } from 'vitest'
import { computeProgressBar } from '~/app/utils/progressBar'

describe('computeProgressBar', () => {
  it('computes basic progress correctly', () => {
    const result = computeProgressBar({ completed: 5, goal: 10 })
    expect(result.completedPercent).toBe(50)
    expect(result.displayPercent).toBe(50)
    expect(result.completedWidth).toBe(50)
  })

  it('handles goal of 0 gracefully', () => {
    const result = computeProgressBar({ completed: 5, goal: 0 })
    expect(result.completedPercent).toBe(0)
    expect(result.inProgressPercent).toBe(0)
    expect(result.displayPercent).toBe(0)
    expect(result.completedWidth).toBe(0)
    expect(result.inProgressWidth).toBe(0)
  })

  it('supports >100% when completed exceeds goal', () => {
    const result = computeProgressBar({ completed: 15, goal: 10 })
    expect(result.completedPercent).toBe(150)
    expect(result.displayPercent).toBe(150)
    // Visual width capped at 100%
    expect(result.completedWidth).toBe(100)
  })

  it('shows in-progress segment alongside completed', () => {
    const result = computeProgressBar({ completed: 3, goal: 10, inProgress: 4 })
    expect(result.completedPercent).toBe(30)
    expect(result.inProgressPercent).toBe(40)
    expect(result.completedWidth).toBe(30)
    expect(result.inProgressWidth).toBe(40)
  })

  it('caps in-progress width to remaining space', () => {
    const result = computeProgressBar({ completed: 8, goal: 10, inProgress: 5 })
    expect(result.completedWidth).toBe(80)
    // Only 20% remaining, so inProgress capped to 20
    expect(result.inProgressWidth).toBe(20)
  })

  it('shows no in-progress when completed fills the bar', () => {
    const result = computeProgressBar({ completed: 10, goal: 10, inProgress: 3 })
    expect(result.completedWidth).toBe(100)
    expect(result.inProgressWidth).toBe(0)
  })

  it('defaults inProgress to 0', () => {
    const result = computeProgressBar({ completed: 5, goal: 10 })
    expect(result.inProgressPercent).toBe(0)
    expect(result.inProgressWidth).toBe(0)
  })

  it('handles all zeros', () => {
    const result = computeProgressBar({ completed: 0, goal: 0, inProgress: 0 })
    expect(result.displayPercent).toBe(0)
    expect(result.completedWidth).toBe(0)
    expect(result.inProgressWidth).toBe(0)
  })

  it('rounds display percent', () => {
    const result = computeProgressBar({ completed: 1, goal: 3 })
    expect(result.displayPercent).toBe(33)
  })

  it('at 100% completion bar is fully green', () => {
    const result = computeProgressBar({ completed: 10, goal: 10 })
    expect(result.completedWidth).toBe(100)
    expect(result.displayPercent).toBe(100)
  })
})
