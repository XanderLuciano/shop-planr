/**
 * Integration test helpers.
 *
 * Provides isolated in-memory SQLite databases and fully-wired service instances
 * for end-to-end integration testing through the service layer.
 */
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '../../server/repositories/sqlite/index'
import { SQLiteJobRepository } from '../../server/repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '../../server/repositories/sqlite/pathRepository'
import { SQLitePartRepository } from '../../server/repositories/sqlite/partRepository'
import { SQLiteCertRepository } from '../../server/repositories/sqlite/certRepository'
import { SQLiteAuditRepository } from '../../server/repositories/sqlite/auditRepository'
import { SQLiteTemplateRepository } from '../../server/repositories/sqlite/templateRepository'
import { SQLiteBomRepository } from '../../server/repositories/sqlite/bomRepository'
import { SQLiteNoteRepository } from '../../server/repositories/sqlite/noteRepository'
import { SQLitePartStepStatusRepository } from '../../server/repositories/sqlite/partStepStatusRepository'
import { SQLitePartStepOverrideRepository } from '../../server/repositories/sqlite/partStepOverrideRepository'
import { SQLiteBomVersionRepository } from '../../server/repositories/sqlite/bomVersionRepository'
import { SQLiteLibraryRepository } from '../../server/repositories/sqlite/libraryRepository'
import { SQLiteUserRepository } from '../../server/repositories/sqlite/userRepository'
import { SQLiteCryptoKeyRepository } from '../../server/repositories/sqlite/cryptoKeyRepository'
import { createJobService } from '../../server/services/jobService'
import { createPathService } from '../../server/services/pathService'
import { createPartService } from '../../server/services/partService'
import { createCertService } from '../../server/services/certService'
import { createAuditService } from '../../server/services/auditService'
import { createTemplateService } from '../../server/services/templateService'
import { createBomService } from '../../server/services/bomService'
import { createNoteService } from '../../server/services/noteService'
import { createLifecycleService } from '../../server/services/lifecycleService'
import { createLibraryService } from '../../server/services/libraryService'
import { createAuthService } from '../../server/services/authService'
import { createSequentialPartIdGenerator } from '../../server/utils/idGenerator'

const MIGRATIONS_DIR = resolve(__dirname, '../../server/repositories/sqlite/migrations')

export function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, MIGRATIONS_DIR)
  return db
}

export function createTestContext() {
  const db = createTestDb()

  const repos = {
    jobs: new SQLiteJobRepository(db),
    paths: new SQLitePathRepository(db),
    parts: new SQLitePartRepository(db),
    certs: new SQLiteCertRepository(db),
    audit: new SQLiteAuditRepository(db),
    templates: new SQLiteTemplateRepository(db),
    bom: new SQLiteBomRepository(db),
    notes: new SQLiteNoteRepository(db),
    partStepStatuses: new SQLitePartStepStatusRepository(db),
    partStepOverrides: new SQLitePartStepOverrideRepository(db),
    bomVersions: new SQLiteBomVersionRepository(db),
    library: new SQLiteLibraryRepository(db),
    users: new SQLiteUserRepository(db),
    cryptoKeys: new SQLiteCryptoKeyRepository(db),
  }

  const partIdGenerator = createSequentialPartIdGenerator({
    getCounter: () => {
      const row = db.prepare('SELECT value FROM counters WHERE name = ?').get('part') as { value: number } | undefined
      return row?.value ?? 0
    },
    setCounter: (v: number) => {
      db.prepare('INSERT OR REPLACE INTO counters (name, value) VALUES (?, ?)').run('part', v)
    },
  })

  const auditService = createAuditService({ audit: repos.audit })

  const lifecycleService = createLifecycleService(
    {
      parts: repos.parts,
      paths: repos.paths,
      jobs: repos.jobs,
      partStepStatuses: repos.partStepStatuses,
      partStepOverrides: repos.partStepOverrides,
    },
    auditService,
  )

  const jobService = createJobService({ jobs: repos.jobs, paths: repos.paths, parts: repos.parts })
  const pathService = createPathService({
    paths: repos.paths,
    parts: repos.parts,
    users: repos.users,
    notes: repos.notes,
    partStepOverrides: repos.partStepOverrides,
    certs: repos.certs,
    partStepStatuses: repos.partStepStatuses,
    db,
  }, auditService)
  const partService = createPartService(
    { parts: repos.parts, paths: repos.paths, certs: repos.certs, jobs: repos.jobs },
    auditService,
    partIdGenerator,
    lifecycleService,
  )
  const certService = createCertService({ certs: repos.certs }, auditService)
  const templateService = createTemplateService({ templates: repos.templates, paths: repos.paths })
  const bomService = createBomService(
    { bom: repos.bom, parts: repos.parts, jobs: repos.jobs, bomVersions: repos.bomVersions },
    auditService,
  )
  const noteService = createNoteService({ notes: repos.notes }, auditService)
  const libraryService = createLibraryService({ library: repos.library })
  const authService = createAuthService({ users: repos.users, cryptoKeys: repos.cryptoKeys })

  return {
    db,
    repos,
    jobService,
    pathService,
    partService,
    certService,
    auditService,
    templateService,
    bomService,
    noteService,
    lifecycleService,
    libraryService,
    authService,
    cleanup: () => db.close(),
  }
}

export type TestContext = ReturnType<typeof createTestContext>
