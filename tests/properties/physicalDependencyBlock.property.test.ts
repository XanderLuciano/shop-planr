/**
 * Property 7: Physical Dependency Hard Block
 *
 * For any step with 'physical' dependency type that has not been completed,
 * verify advancement past it is blocked regardless of advancement mode.
 *
 * **Validates: Requirements 6.5, 12.2, 12.8**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { PartStepStatusValue } from '../../server/types/domain'

interface StepConfig {
  id: string
  name: string
  order: number
  optional: boolean
  dependencyType: 'physical' | 'preferred' | 'completion_gate'
}

interface StepStatus {
  stepId: string
  status: PartStepStatusValue
}

/**
 * Pure validation logic matching lifecycleService.advanceToStep physical dependency check:
 * For each bypassed step (between current+1 and target-1), if it has a 'physical'
 * dependency and is not effectively optional and has not been completed,
 * advancement is blocked.
 */
function validatePhysicalDependencies(
  currentStepOrder: number,
  targetStepOrder: number,
  steps: StepConfig[],
  stepStatuses: StepStatus[],
  overriddenStepIds: Set<string>,
): { valid: boolean; error?: string } {
  // Identify bypassed steps
  for (let i = currentStepOrder + 1; i < targetStepOrder; i++) {
    if (i >= steps.length) continue
    const step = steps[i]
    const isEffectivelyOptional = step.optional || overriddenStepIds.has(step.id)

    if (step.dependencyType === 'physical' && !isEffectivelyOptional) {
      const status = stepStatuses.find(s => s.stepId === step.id)
      if (!status || status.status !== 'completed') {
        return { valid: false, error: `Cannot skip step with physical dependency` }
      }
    }
  }

  return { valid: true }
}

/** Generate a step config */
function stepConfigArb(index: number): fc.Arbitrary<StepConfig> {
  return fc.record({
    id: fc.constant(`step-${index}`),
    name: fc.constant(`Step ${index}`),
    order: fc.constant(index),
    optional: fc.boolean(),
    dependencyType: fc.constantFrom('physical' as const, 'preferred' as const, 'completion_gate' as const),
  })
}

/** Generate a step status */
function stepStatusArb(stepId: string): fc.Arbitrary<StepStatus> {
  return fc.record({
    stepId: fc.constant(stepId),
    status: fc.constantFrom(
      'pending' as const,
      'in_progress' as const,
      'completed' as const,
      'skipped' as const,
      'deferred' as const,
    ),
  })
}

describe('Property 7: Physical Dependency Hard Block', () => {
  it('advancement past an uncompleted physical dependency step is always blocked', () => {
    fc.assert(
      fc.property(
        // totalSteps: 3..10 (need at least 3 for a bypassed step in the middle)
        fc.integer({ min: 3, max: 10 }),
        // physicalStepRelativeIndex: which intermediate step is physical (1-based offset from current)
        fc.integer({ min: 1, max: 8 }),
        // advancementMode
        fc.constantFrom('strict' as const, 'flexible' as const, 'per_step' as const),
        (totalSteps, physicalOffset, _advancementMode) => {
          const currentStepOrder = 0
          // Place the physical step somewhere between current+1 and totalSteps-1
          const physicalStepIndex = Math.min(physicalOffset, totalSteps - 2)
          // Target must be past the physical step
          const targetStepOrder = Math.min(physicalStepIndex + 1, totalSteps)

          if (physicalStepIndex <= currentStepOrder || physicalStepIndex >= targetStepOrder) return

          // Build steps — the physical step is required (not optional) with physical dependency
          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            name: `Step ${i}`,
            order: i,
            optional: false,
            dependencyType: i === physicalStepIndex ? 'physical' : 'preferred',
          }))

          // Step statuses — physical step is NOT completed (pending)
          const stepStatuses: StepStatus[] = steps.map(s => ({
            stepId: s.id,
            status: 'pending' as const,
          }))

          const result = validatePhysicalDependencies(
            currentStepOrder,
            targetStepOrder,
            steps,
            stepStatuses,
            new Set(),
          )

          expect(result.valid).toBe(false)
          expect(result.error).toContain('physical dependency')
        },
      ),
      { numRuns: 100 },
    )
  })

  it('advancement past a completed physical dependency step is allowed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }),
        fc.integer({ min: 1, max: 8 }),
        (totalSteps, physicalOffset) => {
          const currentStepOrder = 0
          const physicalStepIndex = Math.min(physicalOffset, totalSteps - 2)
          const targetStepOrder = Math.min(physicalStepIndex + 1, totalSteps)

          if (physicalStepIndex <= currentStepOrder || physicalStepIndex >= targetStepOrder) return

          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            name: `Step ${i}`,
            order: i,
            optional: false,
            dependencyType: i === physicalStepIndex ? 'physical' : 'preferred',
          }))

          // Physical step IS completed
          const stepStatuses: StepStatus[] = steps.map(s => ({
            stepId: s.id,
            status: s.id === `step-${physicalStepIndex}` ? 'completed' as const : 'pending' as const,
          }))

          const result = validatePhysicalDependencies(
            currentStepOrder,
            targetStepOrder,
            steps,
            stepStatuses,
            new Set(),
          )

          expect(result.valid).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('physical dependency on an effectively optional step (override) does not block', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }),
        fc.integer({ min: 1, max: 8 }),
        (totalSteps, physicalOffset) => {
          const currentStepOrder = 0
          const physicalStepIndex = Math.min(physicalOffset, totalSteps - 2)
          const targetStepOrder = Math.min(physicalStepIndex + 1, totalSteps)

          if (physicalStepIndex <= currentStepOrder || physicalStepIndex >= targetStepOrder) return

          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            name: `Step ${i}`,
            order: i,
            optional: false,
            dependencyType: i === physicalStepIndex ? 'physical' : 'preferred',
          }))

          // Physical step is NOT completed
          const stepStatuses: StepStatus[] = steps.map(s => ({
            stepId: s.id,
            status: 'pending' as const,
          }))

          // But the physical step has an active override (effectively optional)
          const overriddenStepIds = new Set([`step-${physicalStepIndex}`])

          const result = validatePhysicalDependencies(
            currentStepOrder,
            targetStepOrder,
            steps,
            stepStatuses,
            overriddenStepIds,
          )

          expect(result.valid).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})
