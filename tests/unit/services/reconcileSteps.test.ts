import { describe, it, expect } from 'vitest'
import { reconcileSteps } from '~/server/services/pathService'
import type { ProcessStep } from '~/server/types/domain'
import type { StepInput } from '~/server/services/pathService'

function makeStep(id: string, order: number, name = `Step ${order}`): ProcessStep {
  return { id, name, order, location: undefined, optional: false, dependencyType: 'preferred' }
}

describe('reconcileSteps', () => {
  describe('same-count steps (all updates, no inserts/deletes)', () => {
    it('produces only toUpdate when input count equals existing count', () => {
      const existing = [makeStep('s0', 0), makeStep('s1', 1), makeStep('s2', 2)]
      const input: StepInput[] = [
        { name: 'A' },
        { name: 'B' },
        { name: 'C' },
      ]

      const result = reconcileSteps(existing, input)

      expect(result.toUpdate).toHaveLength(3)
      expect(result.toInsert).toHaveLength(0)
      expect(result.toDelete).toHaveLength(0)
    })
  })

  describe('more input steps than existing (updates + inserts)', () => {
    it('updates matched positions and inserts extras', () => {
      const existing = [makeStep('s0', 0), makeStep('s1', 1)]
      const input: StepInput[] = [
        { name: 'A' },
        { name: 'B' },
        { name: 'C' },
        { name: 'D' },
      ]

      const result = reconcileSteps(existing, input)

      expect(result.toUpdate).toHaveLength(2)
      expect(result.toInsert).toHaveLength(2)
      expect(result.toDelete).toHaveLength(0)
    })
  })

  describe('fewer input steps than existing (updates + deletes)', () => {
    it('updates matched positions and deletes extras', () => {
      const existing = [makeStep('s0', 0), makeStep('s1', 1), makeStep('s2', 2)]
      const input: StepInput[] = [{ name: 'A' }]

      const result = reconcileSteps(existing, input)

      expect(result.toUpdate).toHaveLength(1)
      expect(result.toInsert).toHaveLength(0)
      expect(result.toDelete).toEqual(['s1', 's2'])
    })
  })

  describe('empty existing steps (all inserts)', () => {
    it('inserts all input steps when no existing steps', () => {
      const existing: ProcessStep[] = []
      const input: StepInput[] = [{ name: 'A' }, { name: 'B' }]

      const result = reconcileSteps(existing, input)

      expect(result.toUpdate).toHaveLength(0)
      expect(result.toInsert).toHaveLength(2)
      expect(result.toDelete).toHaveLength(0)
    })
  })

  describe('single step path updates', () => {
    it('handles single existing step updated with single input', () => {
      const existing = [makeStep('s0', 0, 'Old')]
      const input: StepInput[] = [{ name: 'New', location: 'Bay 3' }]

      const result = reconcileSteps(existing, input)

      expect(result.toUpdate).toHaveLength(1)
      expect(result.toUpdate[0].id).toBe('s0')
      expect(result.toUpdate[0].name).toBe('New')
      expect(result.toUpdate[0].location).toBe('Bay 3')
      expect(result.toInsert).toHaveLength(0)
      expect(result.toDelete).toHaveLength(0)
    })
  })

  describe('step ID preservation for matched positions', () => {
    it('preserves existing IDs at each matched position', () => {
      const existing = [makeStep('keep-0', 0), makeStep('keep-1', 1), makeStep('keep-2', 2)]
      const input: StepInput[] = [
        { name: 'X' },
        { name: 'Y' },
        { name: 'Z' },
      ]

      const result = reconcileSteps(existing, input)

      expect(result.toUpdate[0].id).toBe('keep-0')
      expect(result.toUpdate[1].id).toBe('keep-1')
      expect(result.toUpdate[2].id).toBe('keep-2')
    })
  })

  describe('new IDs generated only for appended steps', () => {
    it('generates fresh IDs for steps beyond existing count', () => {
      const existing = [makeStep('s0', 0)]
      const input: StepInput[] = [{ name: 'A' }, { name: 'B' }, { name: 'C' }]

      const result = reconcileSteps(existing, input)

      // First step reuses existing ID
      expect(result.toUpdate[0].id).toBe('s0')
      // Appended steps get new IDs starting with step_
      expect(result.toInsert).toHaveLength(2)
      expect(result.toInsert[0].id).toMatch(/^step_/)
      expect(result.toInsert[1].id).toMatch(/^step_/)
      // New IDs are distinct from each other
      expect(result.toInsert[0].id).not.toBe(result.toInsert[1].id)
    })

    it('does not generate new IDs for matched positions', () => {
      const existing = [makeStep('s0', 0), makeStep('s1', 1)]
      const input: StepInput[] = [{ name: 'A' }, { name: 'B' }]

      const result = reconcileSteps(existing, input)

      const allIds = result.toUpdate.map(s => s.id)
      expect(allIds).toEqual(['s0', 's1'])
    })
  })

  describe('sequential order values 0..N-1', () => {
    it('assigns sequential orders across toUpdate and toInsert', () => {
      const existing = [makeStep('s0', 0), makeStep('s1', 1)]
      const input: StepInput[] = [
        { name: 'A' },
        { name: 'B' },
        { name: 'C' },
        { name: 'D' },
      ]

      const result = reconcileSteps(existing, input)

      const allSteps = [...result.toUpdate, ...result.toInsert]
      const orders = allSteps.map(s => s.order).sort((a, b) => a - b)
      expect(orders).toEqual([0, 1, 2, 3])
    })

    it('assigns order 0 for a single input step', () => {
      const existing: ProcessStep[] = []
      const input: StepInput[] = [{ name: 'Only' }]

      const result = reconcileSteps(existing, input)

      expect(result.toInsert[0].order).toBe(0)
    })

    it('preserves sequential order when reducing steps', () => {
      const existing = [makeStep('s0', 0), makeStep('s1', 1), makeStep('s2', 2)]
      const input: StepInput[] = [{ name: 'A' }, { name: 'B' }]

      const result = reconcileSteps(existing, input)

      expect(result.toUpdate[0].order).toBe(0)
      expect(result.toUpdate[1].order).toBe(1)
    })
  })

  describe('field mapping', () => {
    it('defaults optional to false and dependencyType to preferred', () => {
      const existing = [makeStep('s0', 0)]
      const input: StepInput[] = [{ name: 'Step' }]

      const result = reconcileSteps(existing, input)

      expect(result.toUpdate[0].optional).toBe(false)
      expect(result.toUpdate[0].dependencyType).toBe('preferred')
    })

    it('passes through optional and dependencyType when provided', () => {
      const existing = [makeStep('s0', 0)]
      const input: StepInput[] = [{ name: 'Gate', optional: true, dependencyType: 'completion_gate' }]

      const result = reconcileSteps(existing, input)

      expect(result.toUpdate[0].optional).toBe(true)
      expect(result.toUpdate[0].dependencyType).toBe('completion_gate')
    })
  })
})
