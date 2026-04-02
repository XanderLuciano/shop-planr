import type { Part } from '../../types/domain'

export interface PartRepository {
  create(part: Part): Part
  createBatch(parts: Part[]): Part[]
  getById(id: string): Part | null
  getByIdentifier(identifier: string): Part | null
  listByPathId(pathId: string): Part[]
  listByJobId(jobId: string): Part[]
  listByCurrentStepId(stepId: string): Part[]
  update(id: string, partial: Partial<Part>): Part
  countByJobId(jobId: string): number
  /** Counts completed parts for a job. Uses `current_step_id IS NULL AND status = 'completed'`. */
  countCompletedByJobId(jobId: string): number
  countScrappedByJobId(jobId: string): number
  listAll(): Part[]
  deleteByPathId(pathId: string): number
}

/** @deprecated Use `PartRepository` instead. Backward-compatible alias. */
export type SerialRepository = PartRepository
