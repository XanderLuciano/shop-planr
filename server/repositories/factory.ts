import { createSQLiteRepositories } from './sqlite'
import type { RepositorySet } from './types'

export function createRepositories(config: { type: string, dbPath: string }): RepositorySet {
  switch (config.type) {
    case 'sqlite':
      return createSQLiteRepositories(config.dbPath)
    default:
      throw new Error(`Unknown database type: ${config.type}`)
  }
}
