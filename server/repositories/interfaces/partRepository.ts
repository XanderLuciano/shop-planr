import type { Part } from '../../types/domain'
import type { EnrichedPart } from '../../types/computed'

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
  /** Returns total, completed, and scrapped counts for all jobs in a single GROUP BY query. */
  countsByJob(): Map<string, { total: number, completed: number, scrapped: number }>
  listAll(): Part[]
  /** Returns all parts enriched with job/path/step names via a single JOIN query. */
  listAllEnriched(): EnrichedPart[]
  deleteByPathId(pathId: string): number
}

/** @deprecated Use `PartRepository` instead. Backward-compatible alias. */
export type SerialRepository = PartRepository
