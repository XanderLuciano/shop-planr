import { createRepositories } from '../repositories/factory'
import type { RepositorySet } from '../repositories/types'

let repositories: RepositorySet | null = null

export function getRepositories(): RepositorySet {
  if (!repositories) {
    const config = useRuntimeConfig()
    repositories = createRepositories({
      type: config.dbType,
      dbPath: config.dbPath
    })
  }
  return repositories
}
