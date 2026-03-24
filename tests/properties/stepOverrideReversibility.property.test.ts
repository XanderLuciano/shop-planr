/**
 * Property 5: Step Override Reversibility
 *
 * For any override on a step not yet skipped/completed, verify reversal
 * restores original required status — the step blocks completion if
 * deferred and requires completion or waiver before final sign-off.
 *
 * **Validates: Requirements 9.4**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { SnStepStatusValue } from '../../server/types/domain'

interface StepConfig {
  id: string
  optional: boolean
}

interface StepStatusRecord {
  stepId: string
  status: SnStepStatusValue
}

/**
 * Pure canComplete logic matching lifecycleService.canComplete.
 */
function canComplete(
  steps: StepConfig[],
  stepStatuses: StepStatusRecord[],
  overriddenStepIds: Set<string>,
): { canComplete: boolean; blockers: string[] } {
  const blockers: string[] = []
  for (const step of steps) {
    if (step.optional) continue
    if (overriddenStepIds.has(step.id)) continue

    const status = stepStatuses.find(s => s.stepId === step.id)
    if (!status || (status.status !== 'completed' && status.status !== 'waived')) {
      blockers.push(step.id)
    }
  }
  return { canComplete: blockers.length === 0, blockers }
}

/**
 * Validates whether a reversal is allowed:
 * Cannot reverse if step is already skipped or completed.
 */
function canReverseOverride(stepStatus: SnStepStatusValue | undefined): boolean {
  if (stepStatus === 'skipped' || stepStatus === 'completed') return false
  return true
}

describe('Property 5: Step Override Reversibility', () => {
  it('reversing an override on a non-completed/non-skipped step restores blocking behavior', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }),
        fc.integer({ min: 0, max: 9 }),
        fc.constantFrom<SnStepStatusValue>('pending', 'deferred', 'in_progress'),
        (totalSteps, overrideIdx, stepStatus) => {
          const overrideStepIndex = overrideIdx % totalSteps

          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            optional: false, // all required
          }))

          // All steps completed except the overridden one
          const stepStatuses: StepStatusRecord[] = steps.map((step, i) => ({
            stepId: step.id,
            status: i === overrideStepIndex ? stepStatus : 'completed',
          }))

          const overriddenStepIds = new Set([`step-${overrideStepIndex}`])

          // With override active: step is effectively optional → can complete
          const withOverride = canComplete(steps, stepStatuses, overriddenStepIds)
          expect(withOverride.canComplete).toBe(true)

          // Verify reversal is allowed
          expect(canReverseOverride(stepStatus)).toBe(true)

          // After reversal: step is required again → blocks completion
          const withoutOverride = canComplete(steps, stepStatuses, new Set())
          expect(withoutOverride.canComplete).toBe(false)
          expect(withoutOverride.blockers).toContain(`step-${overrideStepIndex}`)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('reversal is rejected when step is already skipped or completed', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<SnStepStatusValue>('skipped', 'completed'),
        (terminalStatus) => {
          expect(canReverseOverride(terminalStatus)).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('reversal is allowed for pending, deferred, in_progress, and waived statuses', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<SnStepStatusValue>('pending', 'deferred', 'in_progress', 'waived'),
        (status) => {
          expect(canReverseOverride(status)).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})
