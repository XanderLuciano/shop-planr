import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join, resolve } from 'path'
import { tmpdir } from 'os'
import { initDatabase, loadMigrationFiles, runMigrations } from '../../../../server/repositories/sqlite/index'

const REAL_MIGRATIONS_DIR = resolve(__dirname, '../../../../server/repositories/sqlite/migrations')

describe('SQLite migration system', () => {
  let tempDir: string
  let dbPath: string
  let migrationsDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'shop-erp-test-'))
    dbPath = join(tempDir, 'test.db')
    migrationsDir = join(tempDir, 'migrations')
    require('fs').mkdirSync(migrationsDir) // eslint-disable-line @typescript-eslint/no-require-imports
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('loadMigrationFiles', () => {
    it('loads and parses migration files sorted by version', () => {
      writeFileSync(join(migrationsDir, '002_second.sql'), 'CREATE TABLE b (id TEXT);')
      writeFileSync(join(migrationsDir, '001_first.sql'), 'CREATE TABLE a (id TEXT);')

      const migrations = loadMigrationFiles(migrationsDir)

      expect(migrations).toHaveLength(2)
      expect(migrations[0].version).toBe(1)
      expect(migrations[0].name).toBe('first')
      expect(migrations[1].version).toBe(2)
      expect(migrations[1].name).toBe('second')
    })

    it('computes checksums for migration content', () => {
      writeFileSync(join(migrationsDir, '001_test.sql'), 'CREATE TABLE t (id TEXT);')

      const migrations = loadMigrationFiles(migrationsDir)

      expect(migrations[0].checksum).toBeTruthy()
      expect(typeof migrations[0].checksum).toBe('string')
      expect(migrations[0].checksum.length).toBe(64) // SHA-256 hex
    })

    it('throws on invalid migration filename', () => {
      writeFileSync(join(migrationsDir, 'bad_name.sql'), 'SELECT 1;')

      expect(() => loadMigrationFiles(migrationsDir)).toThrow('Invalid migration filename')
    })

    it('ignores non-sql files', () => {
      writeFileSync(join(migrationsDir, '001_test.sql'), 'CREATE TABLE t (id TEXT);')
      writeFileSync(join(migrationsDir, 'README.md'), '# Migrations')

      const migrations = loadMigrationFiles(migrationsDir)
      expect(migrations).toHaveLength(1)
    })
  })

  describe('runMigrations', () => {
    it('creates _migrations tracking table', () => {
      const db = new Database(dbPath)
      runMigrations(db, migrationsDir)

      const tables = db.prepare(
        'SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'_migrations\'',
      ).all()
      expect(tables).toHaveLength(1)

      db.close()
    })

    it('applies pending migrations and records them', () => {
      writeFileSync(join(migrationsDir, '001_create_foo.sql'), 'CREATE TABLE foo (id TEXT PRIMARY KEY);')

      const db = new Database(dbPath)
      runMigrations(db, migrationsDir)

      const tables = db.prepare(
        'SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'foo\'',
      ).all()
      expect(tables).toHaveLength(1)

      const applied = db.prepare('SELECT * FROM _migrations').all() as any[]
      expect(applied).toHaveLength(1)
      expect(applied[0].version).toBe(1)
      expect(applied[0].name).toBe('create_foo')

      db.close()
    })

    it('skips already-applied migrations', () => {
      writeFileSync(join(migrationsDir, '001_create_foo.sql'), 'CREATE TABLE foo (id TEXT PRIMARY KEY);')

      const db = new Database(dbPath)
      runMigrations(db, migrationsDir)
      runMigrations(db, migrationsDir)

      const applied = db.prepare('SELECT * FROM _migrations').all() as any[]
      expect(applied).toHaveLength(1)

      db.close()
    })

    it('applies new migrations incrementally', () => {
      writeFileSync(join(migrationsDir, '001_create_foo.sql'), 'CREATE TABLE foo (id TEXT PRIMARY KEY);')

      const db = new Database(dbPath)
      runMigrations(db, migrationsDir)

      writeFileSync(join(migrationsDir, '002_create_bar.sql'), 'CREATE TABLE bar (id TEXT PRIMARY KEY);')
      runMigrations(db, migrationsDir)

      const applied = db.prepare('SELECT * FROM _migrations').all() as any[]
      expect(applied).toHaveLength(2)

      const barTable = db.prepare(
        'SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'bar\'',
      ).all()
      expect(barTable).toHaveLength(1)

      db.close()
    })
  })

  describe('initDatabase', () => {
    it('creates database with WAL mode and foreign keys enabled', () => {
      writeFileSync(join(migrationsDir, '001_test.sql'), 'CREATE TABLE t (id TEXT PRIMARY KEY);')

      const db = initDatabase(dbPath, migrationsDir)

      const walMode = db.pragma('journal_mode', { simple: true })
      expect(walMode).toBe('wal')

      const fkEnabled = db.pragma('foreign_keys', { simple: true })
      expect(fkEnabled).toBe(1)

      db.close()
    })

    it('runs migrations on init', () => {
      writeFileSync(join(migrationsDir, '001_create_items.sql'), 'CREATE TABLE items (id TEXT PRIMARY KEY, name TEXT);')

      const db = initDatabase(dbPath, migrationsDir)

      const tables = db.prepare(
        'SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'items\'',
      ).all()
      expect(tables).toHaveLength(1)

      db.close()
    })
  })

  // ---- Real migration tests ----
  // These all share a single DB instance since they're read-only checks
  // against the final schema state after all migrations have run.

  describe('real migrations', () => {
    let db: Database.Database

    beforeEach(() => {
      db = initDatabase(dbPath)
    })

    afterEach(() => {
      db.close()
    })

    it('records all migrations — count and order match files on disk', () => {
      const filesOnDisk = loadMigrationFiles(REAL_MIGRATIONS_DIR)
      const applied = db.prepare('SELECT version, name FROM _migrations ORDER BY version').all() as { version: number, name: string }[]

      expect(applied).toHaveLength(filesOnDisk.length)

      for (let i = 0; i < filesOnDisk.length; i++) {
        expect(applied[i].version).toBe(filesOnDisk[i].version)
        expect(applied[i].name).toBe(filesOnDisk[i].name)
      }
    })

    it('creates core tables from initial schema', () => {
      const tableNames = db.prepare(
        'SELECT name FROM sqlite_master WHERE type=\'table\' ORDER BY name',
      ).all() as { name: string }[]

      const names = tableNames.map(t => t.name)
      for (const table of [
        'jobs', 'paths', 'process_steps', 'parts', 'certs',
        'cert_attachments', 'templates', 'template_steps',
        'boms', 'bom_entries', 'users', 'audit_entries',
        'settings', 'step_notes',
      ]) {
        expect(names, `missing table: ${table}`).toContain(table)
      }
    })

    it('creates counters table', () => {
      const tables = db.prepare(
        'SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'counters\'',
      ).all()
      expect(tables).toHaveLength(1)
    })

    it('adds assigned_to column to process_steps', () => {
      const columns = db.prepare('PRAGMA table_info(process_steps)').all() as { name: string }[]
      expect(columns.map(c => c.name)).toContain('assigned_to')
    })

    it('adds page_toggles column to settings with correct defaults', () => {
      const columns = db.prepare('PRAGMA table_info(settings)').all() as {
        name: string
        type: string
        notnull: number
        dflt_value: string | null
      }[]
      const col = columns.find(c => c.name === 'page_toggles')

      expect(col).toBeDefined()
      expect(col!.type).toBe('TEXT')
      expect(col!.notnull).toBe(1)
      expect(col!.dflt_value).toBe('\'{}\'')
    })

    it('creates all expected indexes', () => {
      const indexes = db.prepare(
        'SELECT name FROM sqlite_master WHERE type=\'index\' AND name LIKE \'idx_%\' ORDER BY name',
      ).all() as { name: string }[]

      const indexNames = indexes.map(i => i.name)
      for (const idx of [
        'idx_paths_job_id', 'idx_parts_job_id', 'idx_parts_path_id',
        'idx_parts_current_step_id', 'idx_cert_attachments_part',
        'idx_cert_attachments_cert', 'idx_audit_part', 'idx_audit_job',
        'idx_audit_timestamp', 'idx_process_steps_path',
        'idx_step_notes_step', 'idx_step_notes_job',
        'idx_process_steps_assigned_to',
        'idx_webhook_events_created_at',
        'idx_webhook_deliveries_event_id',
        'idx_webhook_deliveries_registration_status',
        'idx_webhook_deliveries_status',
      ]) {
        expect(indexNames, `missing index: ${idx}`).toContain(idx)
      }
    })

    it('enforces CHECK constraint on jobs.goal_quantity', () => {
      db.pragma('foreign_keys = ON')
      expect(() => {
        db.prepare(
          'INSERT INTO jobs (id, name, goal_quantity, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        ).run('j1', 'Test', 0, new Date().toISOString(), new Date().toISOString())
      }).toThrow()
    })

    it('enforces CHECK constraint on certs.type', () => {
      expect(() => {
        db.prepare(
          'INSERT INTO certs (id, type, name, created_at) VALUES (?, ?, ?, ?)',
        ).run('c1', 'invalid', 'Test Cert', new Date().toISOString())
      }).toThrow()
    })

    it('enforces UNIQUE constraint on process_steps(path_id, step_order)', () => {
      db.pragma('foreign_keys = OFF')

      db.prepare(
        'INSERT INTO process_steps (id, path_id, name, step_order) VALUES (?, ?, ?, ?)',
      ).run('s1', 'p1', 'Step 1', 0)

      expect(() => {
        db.prepare(
          'INSERT INTO process_steps (id, path_id, name, step_order) VALUES (?, ?, ?, ?)',
        ).run('s2', 'p1', 'Step 2', 0)
      }).toThrow()
    })

    it('creates webhook tables with correct columns after migration 018', () => {
      const tableNames = db.prepare(
        'SELECT name FROM sqlite_master WHERE type=\'table\' AND name LIKE \'webhook_%\' ORDER BY name',
      ).all() as { name: string }[]
      expect(tableNames.map(t => t.name)).toEqual(['webhook_deliveries', 'webhook_events', 'webhook_registrations'])

      // webhook_events: rebuilt to drop status, sent_at, last_error, retry_count
      const eventCols = db.prepare('PRAGMA table_info(webhook_events)').all() as { name: string }[]
      const eventColNames = eventCols.map(c => c.name)
      for (const col of ['id', 'event_type', 'payload', 'summary', 'created_at']) {
        expect(eventColNames, `webhook_events missing: ${col}`).toContain(col)
      }
      for (const col of ['status', 'sent_at', 'last_error', 'retry_count']) {
        expect(eventColNames, `webhook_events should not have: ${col}`).not.toContain(col)
      }

      // webhook_registrations: new table
      const regCols = db.prepare('PRAGMA table_info(webhook_registrations)').all() as { name: string }[]
      for (const col of ['id', 'name', 'url', 'event_types', 'created_at', 'updated_at']) {
        expect(regCols.map(c => c.name), `webhook_registrations missing: ${col}`).toContain(col)
      }

      // webhook_deliveries: new table
      const delCols = db.prepare('PRAGMA table_info(webhook_deliveries)').all() as { name: string }[]
      for (const col of ['id', 'event_id', 'registration_id', 'status', 'error', 'created_at', 'updated_at']) {
        expect(delCols.map(c => c.name), `webhook_deliveries missing: ${col}`).toContain(col)
      }

      // webhook_config should no longer exist
      const configTable = db.prepare(
        'SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'webhook_config\'',
      ).all()
      expect(configTable).toHaveLength(0)
    })
  })
})
