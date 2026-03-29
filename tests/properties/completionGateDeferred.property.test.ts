/**
 * Property 16: Completion Gate Deferred Behavior
 *
 * For any step with 'completion_gate' dependency, verify part can advance
 * past it (deferred) but normal completion is blocked until resolved.
 *
 * **Validates: Requirements 6.7, 12.4**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { PartStepStatusValue } from '../../server/types/domain'

interface StepConfig {
  id: string
  optional: boolean
  dependencyType: 'physical' | 'preferred' | 'completion_gate'
}

interface StepStatusRecord {
  stepId: string
  status: PartStepStatusValue
}

/**
 * Pure canComplete logic matching lifecycleService.canComplete:
 * Required steps (not optional, not overridden) must be 'completed' or 'waived'.
 * Completion_gate steps that are deferred count as blockers since they are required.
 */
function canComplete(
  steps: StepConfig[],
  stepStatuses: StepStatusRecord[],
  overriddenStepIds: Set<string>
): { canComplete: boolean; blockers: string[] } {
  const blockers: string[] = []
  for (const step of steps) {
    if (step.optional) continue
    if (overriddenStepIds.has(step.id)) continue

    const status = stepStatuses.find((s) => s.stepId === step.id)
    if (!status || (status.status !== 'completed' && status.status !== 'waived')) {
      blockers.push(step.id)
    }
  }
  return { canComplete: blockers.length === 0, blockers }
}

/**
 * Pure bypass classification: completion_gate steps with 'preferred' or
 * 'completion_gate' dependency can be bypassed (deferred) in flexible mode.
 * Physical dependencies block advancement entirely.
 */
function canBypassStep(step: StepConfig, stepStatus: PartStepStatusValue | undefined): boolean {
  // Physical dependencies cannot be bypassed unless already completed
  if (step.dependencyType === 'physical') {
    return stepStatus === 'completed'
  }
  // Preferred and completion_gate can be bypassed (deferred if required)
  return true
}

describe('Property 16: Completion Gate Deferred Behavior', () => {
  it('completion_gate step can be bypassed (deferred) during advancement', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }),
        fc.integer({ min: 0, max: 8 }),
        (totalSteps, gateIdx) => {
          const gateStepIndex = gateIdx % totalSteps

          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            optional: false,
            dependencyType: i === gateStepIndex ? 'completion_gate' : 'preferred',
          }))

          // Gate step is pending (not yet completed)
          const gateStatus: PartStepStatusValue = 'pending'

          // Completion_gate can be bypassed
          expect(canBypassStep(steps[gateStepIndex], gateStatus)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('deferred completion_gate step blocks normal completion', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }),
        fc.integer({ min: 0, max: 8 }),
        (totalSteps, gateIdx) => {
          const gateStepIndex = gateIdx % totalSteps

          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            optional: false,
            dependencyType: i === gateStepIndex ? 'completion_gate' : 'preferred',
          }))

          // All steps completed except the gate step which is deferred
          const stepStatuses: StepStatusRecord[] = steps.map((step, i) => ({
            stepId: step.id,
            status: i === gateStepIndex ? 'deferred' : 'completed',
          }))

          const result = canComplete(steps, stepStatuses, new Set())

          expect(result.canComplete).toBe(false)
          expect(result.blockers).toContain(`step-${gateStepIndex}`)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('resolved (completed) completion_gate step allows normal completion', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }),
        fc.integer({ min: 0, max: 8 }),
        (totalSteps, gateIdx) => {
          const gateStepIndex = gateIdx % totalSteps

          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            optional: false,
            dependencyType: i === gateStepIndex ? 'completion_gate' : 'preferred',
          }))

          // All steps completed including the gate step
          const stepStatuses: StepStatusRecord[] = steps.map((step) => ({
            stepId: step.id,
            status: 'completed',
          }))

          const result = canComplete(steps, stepStatuses, new Set())

          expect(result.canComplete).toBe(true)
          expect(result.blockers).toHaveLength(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('waived completion_gate step also allows normal completion', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }),
        fc.integer({ min: 0, max: 8 }),
        (totalSteps, gateIdx) => {
          const gateStepIndex = gateIdx % totalSteps

          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            optional: false,
            dependencyType: i === gateStepIndex ? 'completion_gate' : 'preferred',
          }))

          // All steps completed, gate step waived
          const stepStatuses: StepStatusRecord[] = steps.map((step, i) => ({
            stepId: step.id,
            status: i === gateStepIndex ? 'waived' : 'completed',
          }))

          const result = canComplete(steps, stepStatuses, new Set())

          expect(result.canComplete).toBe(true)
          expect(result.blockers).toHaveLength(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('physical dependency blocks bypass unlike completion_gate', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'physical' | 'preferred' | 'completion_gate'>(
          'physical',
          'preferred',
          'completion_gate'
        ),
        (depType) => {
          const step: StepConfig = {
            id: 'step-0',
            optional: false,
            dependencyType: depType,
          }

          const canBypass = canBypassStep(step, 'pending')

          if (depType === 'physical') {
            expect(canBypass).toBe(false)
          } else {
            expect(canBypass).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
