/**
 * Work queue helper functions for first-step visibility logic.
 */

import type { ProcessStep } from '../types/domain'

/**
 * Returns the first non-soft-deleted step in the array, or `undefined`
 * if all steps are soft-deleted.
 *
 * Precondition: `steps` is ordered by `order` ascending.
 */
export function findFirstActiveStep(steps: readonly ProcessStep[]): ProcessStep | undefined {
  return steps.find(s => !s.removedAt)
}

/**
 * Determines whether a step should be included in the work queue.
 *
 * Returns `true` if:
 * - `partCount > 0` (step has work in progress), OR
 * - `isFirstActiveStep` AND `step.completedCount < pathGoalQuantity`
 *   (first step still needs parts fabricated)
 *
 * Preconditions:
 * - `step.removedAt` is falsy (caller filters soft-deleted steps)
 * - `partCount >= 0`
 * - `pathGoalQuantity > 0`
 */
export function shouldIncludeStep(
  step: ProcessStep,
  partCount: number,
  isFirstActiveStep: boolean,
  pathGoalQuantity: number,
): boolean {
  if (partCount > 0) return true
  if (isFirstActiveStep && step.completedCount < pathGoalQuantity) return true
  return false
}
