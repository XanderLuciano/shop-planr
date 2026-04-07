import type { CryptoKey } from '../../types/domain'

export interface CryptoKeyRepository {
  getByAlgorithm(algorithm: string): CryptoKey | null
  create(row: CryptoKey): CryptoKey
}
