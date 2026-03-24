import type { BomVersion } from '../../types/domain'

export interface BomVersionRepository {
  create(version: BomVersion): BomVersion
  listByBomId(bomId: string): BomVersion[]
  getLatestByBomId(bomId: string): BomVersion | null
}
