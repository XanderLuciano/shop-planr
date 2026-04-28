import type { BOM } from '../../types/domain'

export interface BomRepository {
  create(bom: BOM): BOM
  getById(id: string): BOM | null
  list(status?: 'active' | 'archived' | 'all'): BOM[]
  update(id: string, partial: Partial<BOM>): BOM
  delete(id: string): boolean
  countJobRefs(jobId: string): number
}
