import type { SnStepStatus } from '../../types/domain'

export interface SnStepStatusRepository {
  create(status: SnStepStatus): SnStepStatus
  createBatch(statuses: SnStepStatus[]): SnStepStatus[]
  getBySerialAndStep(serialId: string, stepId: string): SnStepStatus | null
  listBySerialId(serialId: string): SnStepStatus[]
  update(id: string, partial: Partial<SnStepStatus>): SnStepStatus
  updateBySerialAndStep(serialId: string, stepId: string, partial: Partial<SnStepStatus>): SnStepStatus
}
