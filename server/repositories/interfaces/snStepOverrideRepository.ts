import type { SnStepOverride } from '../../types/domain'

export interface SnStepOverrideRepository {
  create(override: SnStepOverride): SnStepOverride
  createBatch(overrides: SnStepOverride[]): SnStepOverride[]
  getBySerialAndStep(serialId: string, stepId: string): SnStepOverride | null
  listBySerialId(serialId: string): SnStepOverride[]
  listActiveBySerialId(serialId: string): SnStepOverride[]
  update(id: string, partial: Partial<SnStepOverride>): SnStepOverride
}
