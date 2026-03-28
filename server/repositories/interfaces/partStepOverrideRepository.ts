import type { PartStepOverride } from '../../types/domain'

export interface PartStepOverrideRepository {
  create(override: PartStepOverride): PartStepOverride
  createBatch(overrides: PartStepOverride[]): PartStepOverride[]
  getByPartAndStep(partId: string, stepId: string): PartStepOverride | null
  listByPartId(partId: string): PartStepOverride[]
  listActiveByPartId(partId: string): PartStepOverride[]
  update(id: string, partial: Partial<PartStepOverride>): PartStepOverride
}

/** @deprecated Use `PartStepOverrideRepository` instead. Backward-compatible alias. */
export type SnStepOverrideRepository = PartStepOverrideRepository
