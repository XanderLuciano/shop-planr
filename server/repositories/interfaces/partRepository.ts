import type { Part } from '../../types/domain'

export interface PartRepository {
  create(part: Part): Part
  createBatch(parts: Part[]): Part[]
  getById(id: string): Part | null
  getByIdentifier(identifier: string): Part | null
  listByPathId(pathId: string): Part[]
  listByJobId(jobId: string): Part[]
  listByStepIndex(pathId: string, stepIndex: number): Part[]
  update(id: string, partial: Partial<Part>): Part
  countByJobId(jobId: string): number
  countCompletedByJobId(jobId: string): number
  countScrappedByJobId(jobId: string): number
  listAll(): Part[]
}

/** @deprecated Use `PartRepository` instead. Backward-compatible alias. */
export type SerialRepository = PartRepository
