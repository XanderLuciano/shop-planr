import Database from 'better-sqlite3'
import { createHash } from 'crypto'
import { readdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { SQLiteJobRepository } from './jobRepository'
import { SQLitePathRepository } from './pathRepository'
import { SQLitePartRepository } from './partRepository'
import { SQLiteCertRepository } from './certRepository'
import { SQLiteTemplateRepository } from './templateRepository'
import { SQLiteAuditRepository } from './auditRepository'
import { SQLiteBomRepository } from './bomRepository'
import { SQLiteSettingsRepository } from './settingsRepository'
import { SQLiteNoteRepository } from './noteRepository'
import { SQLiteUserRepository } from './userRepository'
import { SQLitePartStepStatusRepository } from './partStepStatusRepository'
import { SQLitePartStepOverrideRepository } from './partStepOverrideRepository'
import { SQLiteBomVersionRepository } from './bomVersionRepository'
import { SQLiteLibraryRepository } from './libraryRepository'
import type { JobRepository } from '../interfaces/jobRepository'
import type { PathRepository } from '../interfaces/pathRepository'
import type { PartRepository } from '../interfaces/partRepository'
import type { CertRepository } from '../interfaces/certRepository'
import type { TemplateRepository } from '../interfaces/templateRepository'
import type { AuditRepository } from '../interfaces/auditRepository'
import type { BomRepository } from '../interfaces/bomRepository'
import type { SettingsRepository } from '../interfaces/settingsRepository'
import type { NoteRepository } from '../interfaces/noteRepository'
import type { UserRepository } from '../interfaces/userRepository'
import type { PartStepStatusRepository } from '../interfaces/partStepStatusRepository'
import type { PartStepOverrideRepository } from '../interfaces/partStepOverrideRepository'
import type { BomVersionRepository } from '../interfaces/bomVersionRepository'
import type { LibraryRepository } from '../interfaces/libraryRepository'

export interface RepositorySet {
  jobs: JobRepository
  paths: PathRepository
  parts: PartRepository
  certs: CertRepository
  templates: TemplateRepository
  audit: AuditRepository
  bom: BomRepository
  settings: SettingsRepository
  notes: NoteRepository
  users: UserRepository
  partStepStatuses: PartStepStatusRepository
  partStepOverrides: PartStepOverrideRepository
  bomVersions: BomVersionRepository
  library: LibraryRepository
  /** Raw DB handle — used by the service layer for the counter. */
  _db: import('better-sqlite3').Database

  /** @deprecated Use `parts` instead. Backward-compatible alias. */
  serials?: PartRepository
  /** @deprecated Use `partStepStatuses` instead. Backward-compatible alias. */
  snStepStatuses?: PartStepStatusRepository
  /** @deprecated Use `partStepOverrides` instead. Backward-compatible alias. */
  snStepOverrides?: PartStepOverrideRepository
}

interface MigrationFile {
  version: number
  name: string
  sql: string
  checksum: string
}

/**
 * Load migration .sql files from the migrations directory, sorted by version.
 */
export function loadMigrationFiles(migrationsDir?: string): MigrationFile[] {
  // In Nuxt's bundled context, import.meta.dirname may be undefined.
  // Use fileURLToPath + import.meta.url for cross-platform portability,
  // with process.cwd() fallback for bundled environments.
  let dir: string
  if (migrationsDir) {
    dir = migrationsDir
  } else {
    try {
      dir = fileURLToPath(new URL('migrations', import.meta.url))
    } catch {
      dir = resolve(process.cwd(), 'server/repositories/sqlite/migrations')
    }
  }
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  return files.map((filename) => {
    const match = filename.match(/^(\d+)_(.+)\.sql$/)
    if (!match) {
      throw new Error(`Invalid migration filename: ${filename}. Expected format: NNN_description.sql`)
    }
    const version = parseInt(match[1]!, 10)
    const name = match[2] ?? filename
    const sql = readFileSync(join(dir, filename), 'utf-8')
    const checksum = createHash('sha256').update(sql).digest('hex')
    return { version, name, sql, checksum }
  })
}

/**
 * Run pending migrations against the database.
 * Tracks applied migrations in a `_migrations` table with checksums.
 */
export function runMigrations(db: Database.Database, migrationsDir?: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      checksum TEXT NOT NULL
    )
  `)

  const applied = db.prepare('SELECT version, checksum FROM _migrations').all() as { version: number, checksum: string }[]
  const appliedMap = new Map(applied.map(m => [m.version, m.checksum]))

  const migrations = loadMigrationFiles(migrationsDir)

  for (const migration of migrations) {
    const existingChecksum = appliedMap.get(migration.version)
    if (existingChecksum && existingChecksum !== migration.checksum) {
      console.warn(
        `WARNING: Migration ${migration.version} (${migration.name}) has been modified after being applied. `
        + `Expected checksum ${existingChecksum}, got ${migration.checksum}. `
        + `Do not edit migrations that have already been applied.`,
      )
    }
  }

  const pending = migrations.filter(m => !appliedMap.has(m.version))

  for (const migration of pending) {
    // Disable FK checks so table-rebuild migrations (drop + rename) don't fail.
    // PRAGMA foreign_keys cannot be changed inside a transaction.
    db.pragma('foreign_keys = OFF')
    db.transaction(() => {
      db.exec(migration.sql)
      db.prepare(
        'INSERT INTO _migrations (version, name, applied_at, checksum) VALUES (?, ?, ?, ?)',
      ).run(migration.version, migration.name, new Date().toISOString(), migration.checksum)
    })()
    db.pragma('foreign_keys = ON')

    // Verify no FK violations were introduced
    const fkErrors = db.pragma('foreign_key_check') as unknown[]
    if (fkErrors.length > 0) {
      console.error(`FK violations after migration ${migration.version}:`, fkErrors)
      throw new Error(`Migration ${migration.version} (${migration.name}) introduced FK violations`)
    }

    console.log(`Migration ${migration.version}: ${migration.name} — applied`)
  }
}

/**
 * Initialize a SQLite database with WAL mode, foreign keys, and run all migrations.
 */
export function initDatabase(dbPath: string, migrationsDir?: string): Database.Database {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, migrationsDir)
  return db
}

/**
 * Create the full repository set backed by SQLite.
 * Initializes the database, runs migrations, and returns repository instances.
 */
export function createSQLiteRepositories(dbPath: string, migrationsDir?: string): RepositorySet {
  const db = initDatabase(dbPath, migrationsDir)

  const partRepo = new SQLitePartRepository(db)
  const partStepStatusRepo = new SQLitePartStepStatusRepository(db)
  const partStepOverrideRepo = new SQLitePartStepOverrideRepository(db)

  return {
    jobs: new SQLiteJobRepository(db),
    paths: new SQLitePathRepository(db),
    parts: partRepo,
    certs: new SQLiteCertRepository(db),
    templates: new SQLiteTemplateRepository(db),
    audit: new SQLiteAuditRepository(db),
    bom: new SQLiteBomRepository(db),
    settings: new SQLiteSettingsRepository(db),
    notes: new SQLiteNoteRepository(db),
    users: new SQLiteUserRepository(db),
    partStepStatuses: partStepStatusRepo,
    partStepOverrides: partStepOverrideRepo,
    bomVersions: new SQLiteBomVersionRepository(db),
    library: new SQLiteLibraryRepository(db),
    _db: db,
    // Backward-compatible aliases
    serials: partRepo,
    snStepStatuses: partStepStatusRepo,
    snStepOverrides: partStepOverrideRepo,
  }
}
