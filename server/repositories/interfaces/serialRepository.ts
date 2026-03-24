import type { SerialNumber } from '../../types/domain'

export interface SerialRepository {
  create(serial: SerialNumber): SerialNumber
  createBatch(serials: SerialNumber[]): SerialNumber[]
  getById(id: string): SerialNumber | null
  getByIdentifier(identifier: string): SerialNumber | null
  listByPathId(pathId: string): SerialNumber[]
  listByJobId(jobId: string): SerialNumber[]
  listByStepIndex(pathId: string, stepIndex: number): SerialNumber[]
  update(id: string, partial: Partial<SerialNumber>): SerialNumber
  countByJobId(jobId: string): number
  countCompletedByJobId(jobId: string): number
  countScrappedByJobId(jobId: string): number
  listAll(): SerialNumber[]
}
