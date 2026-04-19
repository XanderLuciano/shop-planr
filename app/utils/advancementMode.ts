import type { AdvancementMode } from '~/types/domain'

export const ADVANCEMENT_MODE_OPTIONS: { label: string, value: AdvancementMode, description: string }[] = [
  { label: 'Strict', value: 'strict', description: 'Parts must follow steps in exact order.' },
  { label: 'Flexible', value: 'flexible', description: 'Parts can skip ahead, but skipped steps become deferred.' },
  { label: 'Per Step', value: 'per_step', description: 'Each step\'s dependency type controls advancement.' },
]
