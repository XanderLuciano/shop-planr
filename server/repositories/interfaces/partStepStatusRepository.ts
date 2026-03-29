import type { PartStepStatus } from '../../types/domain'

export interface PartStepStatusRepository {
  create(status: PartStepStatus): PartStepStatus
  createBatch(statuses: PartStepStatus[]): PartStepStatus[]
  getByPartAndStep(partId: string, stepId: string): PartStepStatus | null
  listByPartId(partId: string): PartStepStatus[]
  update(id: string, partial: Partial<PartStepStatus>): PartStepStatus
  updateByPartAndStep(
    partId: string,
    stepId: string,
    partial: Partial<PartStepStatus>
  ): PartStepStatus
}

/** @deprecated Use `PartStepStatusRepository` instead. Backward-compatible alias. */
export type SnStepStatusRepository = PartStepStatusRepository
