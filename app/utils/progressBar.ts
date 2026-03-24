/**
 * Pure computation helpers for the ProgressBar component.
 * Extracted for testability without Vue test-utils.
 */

export interface ProgressBarInput {
  completed: number
  goal: number
  inProgress?: number
}

export interface ProgressBarComputed {
  completedPercent: number
  inProgressPercent: number
  displayPercent: number
  completedWidth: number
  inProgressWidth: number
}

export function computeProgressBar(input: ProgressBarInput): ProgressBarComputed {
  const { completed, goal, inProgress = 0 } = input

  const completedPercent = goal <= 0 ? 0 : (completed / goal) * 100
  const inProgressPercent = goal <= 0 ? 0 : (inProgress / goal) * 100

  const displayPercent = Math.round(completedPercent)
  const completedWidth = Math.min(completedPercent, 100)
  const inProgressWidth = Math.min(inProgressPercent, 100 - completedWidth)

  return {
    completedPercent,
    inProgressPercent,
    displayPercent,
    completedWidth,
    inProgressWidth
  }
}
