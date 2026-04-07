import type Database from 'better-sqlite3'
import type { CryptoKey } from '../../types/domain'
import type { CryptoKeyRepository } from '../interfaces/cryptoKeyRepository'

interface CryptoKeyRow {
  id: string
  algorithm: string
  public_key: string
  private_key: string
  created_at: string
}

function rowToDomain(row: CryptoKeyRow): CryptoKey {
  return {
    id: row.id,
    algorithm: row.algorithm,
    publicKey: row.public_key,
    privateKey: row.private_key,
    createdAt: row.created_at,
  }
}

export class SQLiteCryptoKeyRepository implements CryptoKeyRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  getByAlgorithm(algorithm: string): CryptoKey | null {
    const row = this.db.prepare('SELECT * FROM crypto_keys WHERE algorithm = ?').get(algorithm) as CryptoKeyRow | undefined
    return row ? rowToDomain(row) : null
  }

  create(row: CryptoKey): CryptoKey {
    this.db.prepare(`
      INSERT INTO crypto_keys (id, algorithm, public_key, private_key, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(row.id, row.algorithm, row.publicKey, row.privateKey, row.createdAt)
    return row
  }
}
