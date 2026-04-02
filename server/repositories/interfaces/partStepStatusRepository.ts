import type { PartStepStatus } from '../../types/domain'

export interface PartStepStatusRepository {
  create(status: PartStepStatus): PartStepStatus
  createBatch(statuses: PartStepStatus[]): PartStepStatus[]
  getByPartAndStep(partId: string, stepId: string): PartStepStatus | null
  getLatestByPartAndStep(partId: string, stepId: string): PartStepStatus | null
  /** Returns all routing entries for a part, ordered by sequence_number ASC. */
  listByPartId(partId: string): PartStepStatus[]
  update(id: string, partial: Partial<PartStepStatus>): PartStepStatus
  updateByPartAndStep(partId: string, stepId: string, partial: Partial<PartStepStatus>): PartStepStatus
  updateLatestByPartAndStep(partId: string, stepId: string, partial: Partial<PartStepStatus>): PartStepStatus
  getNextSequenceNumber(partId: string): number
  deleteByPartIds(partIds: string[]): number
}

/** @deprecated Use `PartStepStatusRepository` instead. Backward-compatible alias. */
export type SnStepStatusRepository = PartStepStatusRepository
