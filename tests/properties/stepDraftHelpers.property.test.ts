/**
 * Property 6: toStepDrafts preserves step identity and sorts by order
 *
 * For any shuffled ProcessStep[], result is sorted by `order` ascending,
 * each `_existingStepId` maps to original id, each `_clientId` is unique
 * and non-empty, and result has same length as input.
 *
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.5**
 *
 * Property 7: toStepDrafts round-trip field preservation
 *
 * For any ProcessStep with fields, the resulting StepDraft preserves all
 * values with null/undefined → default normalization:
 * location null/undefined → '', assignedTo null/undefined → '',
 * optional null/undefined → false, dependencyType null/undefined → 'preferred'.
 *
 * **Validates: Requirements 10.4**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { toStepDrafts, toStepPayload } from '~/app/utils/stepDraftHelpers'
import type { ProcessStep } from '~/server/types/domain'

const DEPENDENCY_TYPES = ['physical', 'preferred', 'completion_gate'] as const

/**
 * Arbitrary for a ProcessStep with all required fields populated.
 */
function arbProcessStep(): fc.Arbitrary<ProcessStep> {
  return fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    order: fc.integer({ min: 0, max: 1000 }),
    location: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
    assignedTo: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
    optional: fc.boolean(),
    dependencyType: fc.constantFrom(...DEPENDENCY_TYPES),
    completedCount: fc.nat({ max: 999 }),
  })
}

/**
 * Arbitrary for a ProcessStep[] with unique orders (to avoid ambiguous sort).
 */
function arbProcessStepArray(): fc.Arbitrary<ProcessStep[]> {
  return fc.array(arbProcessStep(), { minLength: 0, maxLength: 20 })
    .map((steps) => {
      // Assign unique order values so sort is deterministic
      const shuffled = steps.map((s, i) => ({ ...s, order: i }))
      return shuffled
    })
    .chain(steps =>
      // Shuffle the array so toStepDrafts must actually sort
      fc.shuffledSubarray(steps, { minLength: steps.length, maxLength: steps.length }),
    )
}

describe('Property 6: toStepDrafts preserves step identity and sorts by order', () => {
  it('result is sorted by order ascending, maps ids, has unique clientIds, same length', () => {
    fc.assert(
      fc.property(arbProcessStepArray(), (steps) => {
        const drafts = toStepDrafts(steps)

        // Same length
        expect(drafts).toHaveLength(steps.length)

        // Sorted by order ascending — verify via _existingStepId mapping
        const sortedOriginals = steps.slice().sort((a, b) => a.order - b.order)
        for (let i = 0; i < drafts.length; i++) {
          expect(drafts[i]._existingStepId).toBe(sortedOriginals[i].id)
        }

        // Each _clientId is unique and non-empty
        const clientIds = drafts.map(d => d._clientId)
        expect(new Set(clientIds).size).toBe(clientIds.length)
        for (const cid of clientIds) {
          expect(cid).toBeTruthy()
          expect(typeof cid).toBe('string')
          expect(cid.length).toBeGreaterThan(0)
        }
      }),
      { numRuns: 100 },
    )
  })
})

describe('Property 7: toStepDrafts round-trip field preservation', () => {
  it('preserves all field values with null/undefined → default normalization', () => {
    fc.assert(
      fc.property(arbProcessStep(), (step) => {
        const drafts = toStepDrafts([step])

        expect(drafts).toHaveLength(1)
        const draft = drafts[0]

        // name preserved as-is
        expect(draft.name).toBe(step.name)

        // _existingStepId maps to original id
        expect(draft._existingStepId).toBe(step.id)

        // location: null/undefined → '', otherwise preserved
        expect(draft.location).toBe(step.location ?? '')

        // assignedTo: null/undefined → '', otherwise preserved
        expect(draft.assignedTo).toBe(step.assignedTo ?? '')

        // optional: null/undefined → false, otherwise preserved
        expect(draft.optional).toBe(step.optional ?? false)

        // dependencyType: null/undefined → 'preferred', otherwise preserved
        expect(draft.dependencyType).toBe(step.dependencyType ?? 'preferred')
      }),
      { numRuns: 100 },
    )
  })
})

/**
 * Arbitrary for a StepDraft with controlled assignedTo and _existingStepId
 * to exercise all branches of toStepPayload.
 */
function arbStepDraft(): fc.Arbitrary<{
  _clientId: string
  _existingStepId?: string
  name: string
  location: string
  assignedTo: string
  optional: boolean
  dependencyType: 'physical' | 'preferred' | 'completion_gate'
}> {
  return fc.record({
    _clientId: fc.string({ minLength: 1, maxLength: 20 }),
    _existingStepId: fc.option(fc.uuid(), { nil: undefined }),
    name: fc.string({ minLength: 0, maxLength: 50 }),
    location: fc.string({ minLength: 0, maxLength: 30 }),
    assignedTo: fc.oneof(
      fc.constant(''),
      fc.string({ minLength: 1, maxLength: 30 }),
    ),
    optional: fc.boolean(),
    dependencyType: fc.constantFrom(...DEPENDENCY_TYPES),
  })
}

/**
 * Property 8: toStepPayload conversion correctness
 *
 * For any StepDraft[], toStepPayload(drafts) produces an array of the same
 * length where each element has: name trimmed, location trimmed (empty → undefined),
 * id equal to _existingStepId, optional and dependencyType preserved unchanged,
 * and assignedTo mapped correctly (truthy → preserved, falsy + existing → null,
 * falsy + new → undefined).
 *
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7**
 */
describe('Property 8: toStepPayload conversion correctness', () => {
  it('result has same length as input', () => {
    fc.assert(
      fc.property(fc.array(arbStepDraft(), { minLength: 0, maxLength: 20 }), (drafts) => {
        const payloads = toStepPayload(drafts)
        expect(payloads).toHaveLength(drafts.length)
      }),
      { numRuns: 100 },
    )
  })

  it('name is trimmed', () => {
    fc.assert(
      fc.property(arbStepDraft(), (draft) => {
        const [payload] = toStepPayload([draft])
        expect(payload.name).toBe(draft.name.trim())
      }),
      { numRuns: 100 },
    )
  })

  it('empty trimmed location becomes undefined', () => {
    fc.assert(
      fc.property(arbStepDraft(), (draft) => {
        const [payload] = toStepPayload([draft])
        const trimmed = draft.location.trim()
        if (trimmed === '') {
          expect(payload.location).toBeUndefined()
        }
        else {
          expect(payload.location).toBe(trimmed)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('id equals _existingStepId', () => {
    fc.assert(
      fc.property(arbStepDraft(), (draft) => {
        const [payload] = toStepPayload([draft])
        expect(payload.id).toBe(draft._existingStepId)
      }),
      { numRuns: 100 },
    )
  })

  it('assignedTo: truthy preserved, falsy + existing → null, falsy + new → undefined', () => {
    fc.assert(
      fc.property(arbStepDraft(), (draft) => {
        const [payload] = toStepPayload([draft])
        if (draft.assignedTo) {
          // truthy → preserved as-is
          expect(payload.assignedTo).toBe(draft.assignedTo)
        }
        else if (draft._existingStepId) {
          // falsy + existing step → null (explicit unassign)
          expect(payload.assignedTo).toBeNull()
        }
        else {
          // falsy + new step → undefined (omit)
          expect(payload.assignedTo).toBeUndefined()
        }
      }),
      { numRuns: 100 },
    )
  })

  it('optional and dependencyType preserved unchanged', () => {
    fc.assert(
      fc.property(arbStepDraft(), (draft) => {
        const [payload] = toStepPayload([draft])
        expect(payload.optional).toBe(draft.optional)
        expect(payload.dependencyType).toBe(draft.dependencyType)
      }),
      { numRuns: 100 },
    )
  })
})
