import Database from 'better-sqlite3'
import { createHash } from 'crypto'
import { readdirSync, readFileSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { SQLiteJobRepository } from './jobRepository'
import { SQLitePathRepository } from './pathRepository'
import { SQLiteSerialRepository } from './serialRepository'
import { SQLiteCertRepository } from './certRepository'
import { SQLiteTemplateRepository } from './templateRepository'
import { SQLiteAuditRepository } from './auditRepository'
import { SQLiteBomRepository } from './bomRepository'
import { SQLiteSettingsRepository } from './settingsRepository'
import { SQLiteNoteRepository } from './noteRepository'
import { SQLiteUserRepository } from './userRepository'
import { SQLiteSnStepStatusRepository } from './snStepStatusRepository'
import { SQLiteSnStepOverrideRepository } from './snStepOverrideRepository'
import { SQLiteBomVersionRepository } from './bomVersionRepository'
import { SQLiteLibraryRepository } from './libraryRepository'
import type { JobRepository } from '../interfaces/jobRepository'
import type { PathRepository } from '../interfaces/pathRepository'
import type { SerialRepository } from '../interfaces/serialRepository'
import type { CertRepository } from '../interfaces/certRepository'
import type { TemplateRepository } from '../interfaces/templateRepository'
import type { AuditRepository } from '../interfaces/auditRepository'
import type { BomRepository } from '../interfaces/bomRepository'
import type { SettingsRepository } from '../interfaces/settingsRepository'
import type { NoteRepository } from '../interfaces/noteRepository'
import type { UserRepository } from '../interfaces/userRepository'
import type { SnStepStatusRepository } from '../interfaces/snStepStatusRepository'
import type { SnStepOverrideRepository } from '../interfaces/snStepOverrideRepository'
import type { BomVersionRepository } from '../interfaces/bomVersionRepository'
import type { LibraryRepository } from '../interfaces/libraryRepository'

export interface RepositorySet {
  jobs: JobRepository
  paths: PathRepository
  serials: SerialRepository
  certs: CertRepository
  templates: TemplateRepository
  audit: AuditRepository
  bom: BomRepository
  settings: SettingsRepository
  notes: NoteRepository
  users: UserRepository
  snStepStatuses: SnStepStatusRepository
  snStepOverrides: SnStepOverrideRepository
  bomVersions: BomVersionRepository
  library: LibraryRepository
  /** Raw DB handle — used by the service layer for the SN counter. */
  _db: import('better-sqlite3').Database
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
  // Fall back to process.cwd()-based resolution for the default migrations path.
  let dir: string
  if (migrationsDir) {
    dir = migrationsDir
  } else if (typeof import.meta.dirname === 'string') {
    dir = resolve(import.meta.dirname, 'migrations')
  } else {
    dir = resolve(process.cwd(), 'server/repositories/sqlite/migrations')
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
        + `Do not edit migrations that have already been applied.`
      )
    }
  }

  const pending = migrations.filter(m => !appliedMap.has(m.version))

  for (const migration of pending) {
    db.transaction(() => {
      db.exec(migration.sql)
      db.prepare(
        'INSERT INTO _migrations (version, name, applied_at, checksum) VALUES (?, ?, ?, ?)'
      ).run(migration.version, migration.name, new Date().toISOString(), migration.checksum)
    })()
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

  return {
    jobs: new SQLiteJobRepository(db),
    paths: new SQLitePathRepository(db),
    serials: new SQLiteSerialRepository(db),
    certs: new SQLiteCertRepository(db),
    templates: new SQLiteTemplateRepository(db),
    audit: new SQLiteAuditRepository(db),
    bom: new SQLiteBomRepository(db),
    settings: new SQLiteSettingsRepository(db),
    notes: new SQLiteNoteRepository(db),
    users: new SQLiteUserRepository(db),
    snStepStatuses: new SQLiteSnStepStatusRepository(db),
    snStepOverrides: new SQLiteSnStepOverrideRepository(db),
    bomVersions: new SQLiteBomVersionRepository(db),
    library: new SQLiteLibraryRepository(db),
    _db: db
  }
}
