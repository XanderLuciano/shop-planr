import { describe, it, expect } from 'vitest'
import type { ProcessStep } from '~/server/types/domain'
import type { StepDraft } from '~/app/composables/useJobForm'
import { toStepDrafts, toStepPayload } from '~/app/utils/stepDraftHelpers'

describe('toStepDrafts', () => {
  it('sorts by order ascending', () => {
    const steps: ProcessStep[] = [
      { id: 'a', name: 'Step A', order: 3, optional: false, dependencyType: 'preferred', completedCount: 0 },
      { id: 'b', name: 'Step B', order: 1, optional: true, dependencyType: 'physical', completedCount: 0 },
      { id: 'c', name: 'Step C', order: 2, optional: false, dependencyType: 'completion_gate', completedCount: 0 },
    ]
    const drafts = toStepDrafts(steps)
    expect(drafts.map(d => d.name)).toEqual(['Step B', 'Step C', 'Step A'])
  })

  it('assigns unique _clientId and maps _existingStepId', () => {
    const steps: ProcessStep[] = [
      { id: 's1', name: 'X', order: 1, optional: false, dependencyType: 'preferred', completedCount: 0 },
      { id: 's2', name: 'Y', order: 2, optional: false, dependencyType: 'preferred', completedCount: 0 },
    ]
    const drafts = toStepDrafts(steps)
    expect(drafts[0]!._clientId).toBeTruthy()
    expect(drafts[1]!._clientId).toBeTruthy()
    expect(drafts[0]!._clientId).not.toBe(drafts[1]!._clientId)
    expect(drafts[0]!._existingStepId).toBe('s1')
    expect(drafts[1]!._existingStepId).toBe('s2')
  })

  it('normalizes null/undefined fields to defaults', () => {
    const steps: ProcessStep[] = [
      {
        id: 's1',
        name: 'Step',
        order: 1,
        location: undefined,
        assignedTo: undefined,
        optional: false,
        dependencyType: 'preferred',
        completedCount: 0,
      },
    ]
    const [draft] = toStepDrafts(steps)
    expect(draft!.location).toBe('')
    expect(draft!.assignedTo).toBe('')
    expect(draft!.optional).toBe(false)
    expect(draft!.dependencyType).toBe('preferred')
  })

  it('preserves existing field values', () => {
    const steps: ProcessStep[] = [
      {
        id: 's1',
        name: 'Heat Treat',
        order: 1,
        location: 'Building A',
        assignedTo: 'user-1',
        optional: true,
        dependencyType: 'physical',
        completedCount: 5,
      },
    ]
    const [draft] = toStepDrafts(steps)
    expect(draft!.name).toBe('Heat Treat')
    expect(draft!.location).toBe('Building A')
    expect(draft!.assignedTo).toBe('user-1')
    expect(draft!.optional).toBe(true)
    expect(draft!.dependencyType).toBe('physical')
  })

  it('returns same length as input', () => {
    const steps: ProcessStep[] = [
      { id: 'a', name: 'A', order: 1, optional: false, dependencyType: 'preferred', completedCount: 0 },
      { id: 'b', name: 'B', order: 2, optional: false, dependencyType: 'preferred', completedCount: 0 },
      { id: 'c', name: 'C', order: 3, optional: false, dependencyType: 'preferred', completedCount: 0 },
    ]
    expect(toStepDrafts(steps)).toHaveLength(3)
  })

  it('handles empty input', () => {
    expect(toStepDrafts([])).toEqual([])
  })
})

describe('toStepPayload', () => {
  function makeDraft(overrides: Partial<StepDraft> = {}): StepDraft {
    return {
      _clientId: 'c1',
      name: 'Step Name',
      location: 'Loc',
      assignedTo: 'user-1',
      optional: false,
      dependencyType: 'preferred',
      ...overrides,
    }
  }

  it('trims name', () => {
    const result = toStepPayload([makeDraft({ name: '  Heat Treat  ' })])
    expect(result[0]!.name).toBe('Heat Treat')
  })

  it('converts empty trimmed location to undefined', () => {
    const result = toStepPayload([makeDraft({ location: '   ' })])
    expect(result[0]!.location).toBeUndefined()
  })

  it('preserves non-empty trimmed location', () => {
    const result = toStepPayload([makeDraft({ location: ' Building A ' })])
    expect(result[0]!.location).toBe('Building A')
  })

  it('preserves truthy assignedTo', () => {
    const result = toStepPayload([makeDraft({ assignedTo: 'user-1' })])
    expect(result[0]!.assignedTo).toBe('user-1')
  })

  it('sets assignedTo to null for falsy + existing step', () => {
    const result = toStepPayload([makeDraft({ assignedTo: '', _existingStepId: 'existing-1' })])
    expect(result[0]!.assignedTo).toBeNull()
  })

  it('sets assignedTo to undefined for falsy + new step', () => {
    const result = toStepPayload([makeDraft({ assignedTo: '', _existingStepId: undefined })])
    expect(result[0]!.assignedTo).toBeUndefined()
  })

  it('sets id from _existingStepId', () => {
    const result = toStepPayload([makeDraft({ _existingStepId: 'step-42' })])
    expect(result[0]!.id).toBe('step-42')
  })

  it('sets id to undefined for new steps', () => {
    const result = toStepPayload([makeDraft({ _existingStepId: undefined })])
    expect(result[0]!.id).toBeUndefined()
  })

  it('preserves optional and dependencyType', () => {
    const result = toStepPayload([makeDraft({ optional: true, dependencyType: 'physical' })])
    expect(result[0]!.optional).toBe(true)
    expect(result[0]!.dependencyType).toBe('physical')
  })

  it('returns same length as input', () => {
    const drafts = [makeDraft(), makeDraft({ _clientId: 'c2' }), makeDraft({ _clientId: 'c3' })]
    expect(toStepPayload(drafts)).toHaveLength(3)
  })
})
