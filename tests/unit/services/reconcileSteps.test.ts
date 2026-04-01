import { describe, it, expect } from 'vitest'
import { reconcileSteps } from '~/server/services/pathService'
import type { ProcessStep } from '~/server/types/domain'
import type { StepInput } from '~/server/services/pathService'

function makeStep(id: string, order: number, name = `Step ${order}`): ProcessStep {
  return { id, name, order, location: undefined, optional: false, dependencyType: 'preferred', completedCount: 0 }
}

describe('reconcileSteps', () => {
  describe('same-count steps with IDs (all updates, no inserts/deletes)', () => {
    it('produces only toUpdate when all inputs have matching IDs', () => {
      const existing = [makeStep('s0', 0), makeStep('s1', 1), makeStep('s2', 2)]
      const input: StepInput[] = [
        { id: 's0', name: 'A' },
        { id: 's1', name: 'B' },
        { id: 's2', name: 'C' },
      ]

      const result = reconcileSteps(existing, input)

      expect(result.toUpdate).toHaveLength(3)
      expect(result.toInsert).toHaveLength(0)
      expect(result.toSoftDelete).toHaveLength(0)
    })
  })

  describe('more input steps than existing (updates + inserts)', () => {
    it('updates matched IDs and inserts new steps without IDs', () => {
      const existing = [makeStep('s0', 0), makeStep('s1', 1)]
      const input: StepInput[] = [
        { id: 's0', name: 'A' },
        { id: 's1', name: 'B' },
        { name: 'C' },
        { name: 'D' },
      ]

      const result = reconcileSteps(existing, input)

      expect(result.toUpdate).toHaveLength(2)
      expect(result.toInsert).toHaveLength(2)
      expect(result.toSoftDelete).toHaveLength(0)
    })
  })

  describe('fewer input steps than existing (updates + soft-deletes)', () => {
    it('updates matched IDs and soft-deletes unmatched existing steps', () => {
      const existing = [makeStep('s0', 0), makeStep('s1', 1), makeStep('s2', 2)]
      const input: StepInput[] = [{ id: 's0', name: 'A' }]

      const result = reconcileSteps(existing, input)

      expect(result.toUpdate).toHaveLength(1)
      expect(result.toInsert).toHaveLength(0)
      expect(result.toSoftDelete).toEqual(['s1', 's2'])
    })
  })

  describe('empty existing steps (all inserts)', () => {
    it('inserts all input steps when no existing steps', () => {
      const existing: ProcessStep[] = []
      const input: StepInput[] = [{ name: 'A' }, { name: 'B' }]

      const result = reconcileSteps(existing, input)

      expect(result.toUpdate).toHaveLength(0)
      expect(result.toInsert).toHaveLength(2)
      expect(result.toSoftDelete).toHaveLength(0)
    })
  })

  describe('single step path updates', () => {
    it('handles single existing step updated with single input by ID', () => {
      const existing = [makeStep('s0', 0, 'Old')]
      const input: StepInput[] = [{ id: 's0', name: 'New', location: 'Bay 3' }]

      const result = reconcileSteps(existing, input)

      expect(result.toUpdate).toHaveLength(1)
      expect(result.toUpdate[0].id).toBe('s0')
      expect(result.toUpdate[0].name).toBe('New')
      expect(result.toUpdate[0].location).toBe('Bay 3')
      expect(result.toInsert).toHaveLength(0)
      expect(result.toSoftDelete).toHaveLength(0)
    })
  })

  describe('step ID preservation for matched IDs', () => {
    it('preserves existing IDs when matched by ID', () => {
      const existing = [makeStep('keep-0', 0), makeStep('keep-1', 1), makeStep('keep-2', 2)]
      const input: StepInput[] = [
        { id: 'keep-0', name: 'X' },
        { id: 'keep-1', name: 'Y' },
        { id: 'keep-2', name: 'Z' },
      ]

      const result = reconcileSteps(existing, input)

      expect(result.toUpdate[0].id).toBe('keep-0')
      expect(result.toUpdate[1].id).toBe('keep-1')
      expect(result.toUpdate[2].id).toBe('keep-2')
    })
  })

  describe('new IDs generated only for steps without id', () => {
    it('generates fresh IDs for steps without id field', () => {
      const existing = [makeStep('s0', 0)]
      const input: StepInput[] = [{ id: 's0', name: 'A' }, { name: 'B' }, { name: 'C' }]

      const result = reconcileSteps(existing, input)

      // First step reuses existing ID
      expect(result.toUpdate[0].id).toBe('s0')
      // New steps get new IDs starting with step_
      expect(result.toInsert).toHaveLength(2)
      expect(result.toInsert[0].id).toMatch(/^step_/)
      expect(result.toInsert[1].id).toMatch(/^step_/)
      // New IDs are distinct from each other
      expect(result.toInsert[0].id).not.toBe(result.toInsert[1].id)
    })

    it('does not generate new IDs for ID-matched steps', () => {
      const existing = [makeStep('s0', 0), makeStep('s1', 1)]
      const input: StepInput[] = [{ id: 's0', name: 'A' }, { id: 's1', name: 'B' }]

      const result = reconcileSteps(existing, input)

      const allIds = result.toUpdate.map(s => s.id)
      expect(allIds).toEqual(['s0', 's1'])
    })
  })

  describe('sequential order values 0..N-1', () => {
    it('assigns sequential orders across toUpdate and toInsert', () => {
      const existing = [makeStep('s0', 0), makeStep('s1', 1)]
      const input: StepInput[] = [
        { id: 's0', name: 'A' },
        { id: 's1', name: 'B' },
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
      const input: StepInput[] = [{ id: 's0', name: 'A' }, { id: 's1', name: 'B' }]

      const result = reconcileSteps(existing, input)

      expect(result.toUpdate[0].order).toBe(0)
      expect(result.toUpdate[1].order).toBe(1)
    })
  })

  describe('field mapping', () => {
    it('defaults optional to false and dependencyType to preferred', () => {
      const existing = [makeStep('s0', 0)]
      const input: StepInput[] = [{ id: 's0', name: 'Step' }]

      const result = reconcileSteps(existing, input)

      expect(result.toUpdate[0].optional).toBe(false)
      expect(result.toUpdate[0].dependencyType).toBe('preferred')
    })

    it('passes through optional and dependencyType when provided', () => {
      const existing = [makeStep('s0', 0)]
      const input: StepInput[] = [{ id: 's0', name: 'Gate', optional: true, dependencyType: 'completion_gate' }]

      const result = reconcileSteps(existing, input)

      expect(result.toUpdate[0].optional).toBe(true)
      expect(result.toUpdate[0].dependencyType).toBe('completion_gate')
    })
  })

  describe('unknown step ID rejection', () => {
    it('throws ValidationError when input has an ID that does not match any existing step', () => {
      const existing = [makeStep('s0', 0), makeStep('s1', 1)]
      const input: StepInput[] = [
        { id: 's0', name: 'A' },
        { id: 'nonexistent_id', name: 'B' },
      ]

      expect(() => reconcileSteps(existing, input)).toThrow('does not match any existing step')
    })

    it('throws ValidationError for a stale step ID', () => {
      const existing = [makeStep('step_abc123', 0)]
      const input: StepInput[] = [
        { id: 'step_abc124', name: 'Typo' }, // off by one character
      ]

      expect(() => reconcileSteps(existing, input)).toThrow('does not match any existing step')
    })

    it('does not throw when input has no id field (new step)', () => {
      const existing = [makeStep('s0', 0)]
      const input: StepInput[] = [
        { id: 's0', name: 'A' },
        { name: 'New Step' }, // no id — this is fine
      ]

      const result = reconcileSteps(existing, input)
      expect(result.toUpdate).toHaveLength(1)
      expect(result.toInsert).toHaveLength(1)
    })
  })
})
