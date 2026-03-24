import type { Path, ProcessStep } from '../../types/domain'

export interface PathRepository {
  create(path: Path): Path
  getById(id: string): Path | null
  listByJobId(jobId: string): Path[]
  update(id: string, partial: Partial<Path>): Path
  delete(id: string): boolean
  getStepById(stepId: string): ProcessStep | null
  updateStepAssignment(stepId: string, userId: string | null): ProcessStep
  updateStep(stepId: string, partial: Partial<ProcessStep>): ProcessStep
}
