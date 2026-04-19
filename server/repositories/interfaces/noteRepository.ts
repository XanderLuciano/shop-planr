import type { StepNote } from '../../types/domain'

export interface NoteRepository {
  create(note: StepNote): StepNote
  getById(id: string): StepNote | null
  listByPartId(partId: string): StepNote[]
  listByStepId(stepId: string): StepNote[]
  listByJobId(jobId: string): StepNote[]
  listByPathId(pathId: string): StepNote[]
  deleteByStepIds(stepIds: string[]): number
}
