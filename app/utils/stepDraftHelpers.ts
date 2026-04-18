import { nanoid } from 'nanoid'
import type { StepDraft } from '~/composables/useJobForm'
import type { ProcessStep } from '~/types/domain'

export interface StepPayload {
  id?: string
  name: string
  location?: string
  assignedTo?: string | null
  optional: boolean
  dependencyType: 'physical' | 'preferred' | 'completion_gate'
}

export function toStepDrafts(steps: ProcessStep[]): StepDraft[] {
  return steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(s => ({
      _clientId: nanoid(),
      _existingStepId: s.id,
      name: s.name,
      location: s.location ?? '',
      assignedTo: s.assignedTo ?? '',
      optional: s.optional ?? false,
      dependencyType: s.dependencyType ?? 'preferred',
    }))
}

export function toStepPayload(drafts: StepDraft[]): StepPayload[] {
  return drafts.map(s => ({
    id: s._existingStepId,
    name: s.name.trim(),
    location: s.location.trim() || undefined,
    assignedTo: s.assignedTo ? s.assignedTo : (s._existingStepId ? null : undefined),
    optional: s.optional,
    dependencyType: s.dependencyType,
  }))
}
