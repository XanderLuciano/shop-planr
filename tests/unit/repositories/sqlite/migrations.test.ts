import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { initDatabase, loadMigrationFiles, runMigrations } from '../../../../server/repositories/sqlite/index'

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

      // Table should exist
      const tables = db.prepare(
        'SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'foo\'',
      ).all()
      expect(tables).toHaveLength(1)

      // Migration should be recorded
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
      // Run again — should not fail or re-apply
      runMigrations(db, migrationsDir)

      const applied = db.prepare('SELECT * FROM _migrations').all() as any[]
      expect(applied).toHaveLength(1)

      db.close()
    })

    it('applies new migrations incrementally', () => {
      writeFileSync(join(migrationsDir, '001_create_foo.sql'), 'CREATE TABLE foo (id TEXT PRIMARY KEY);')

      const db = new Database(dbPath)
      runMigrations(db, migrationsDir)

      // Add a second migration
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

  describe('real migrations', () => {
    it('applies 001_initial_schema.sql successfully', () => {
      const db = initDatabase(dbPath)

      // Verify key tables exist
      const tableNames = db.prepare(
        'SELECT name FROM sqlite_master WHERE type=\'table\' ORDER BY name',
      ).all() as { name: string }[]

      const names = tableNames.map(t => t.name)
      expect(names).toContain('jobs')
      expect(names).toContain('paths')
      expect(names).toContain('process_steps')
      expect(names).toContain('parts')
      expect(names).toContain('certs')
      expect(names).toContain('cert_attachments')
      expect(names).toContain('templates')
      expect(names).toContain('template_steps')
      expect(names).toContain('boms')
      expect(names).toContain('bom_entries')
      expect(names).toContain('users')
      expect(names).toContain('audit_entries')
      expect(names).toContain('settings')
      expect(names).toContain('step_notes')

      db.close()
    })

    it('applies 002_add_counters_table.sql successfully', () => {
      const db = initDatabase(dbPath)

      const tableNames = db.prepare(
        'SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'counters\'',
      ).all()
      expect(tableNames).toHaveLength(1)

      db.close()
    })

    it('applies 003_add_step_assignment.sql successfully', () => {
      const db = initDatabase(dbPath)

      const columns = db.prepare('PRAGMA table_info(process_steps)').all() as { name: string }[]
      const columnNames = columns.map(c => c.name)
      expect(columnNames).toContain('assigned_to')

      db.close()
    })

    it('applies 005_add_page_toggles.sql successfully', () => {
      const db = initDatabase(dbPath)

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

      db.close()
    })

    it('creates all expected indexes', () => {
      const db = initDatabase(dbPath)

      const indexes = db.prepare(
        'SELECT name FROM sqlite_master WHERE type=\'index\' AND name LIKE \'idx_%\' ORDER BY name',
      ).all() as { name: string }[]

      const indexNames = indexes.map(i => i.name)
      expect(indexNames).toContain('idx_paths_job_id')
      expect(indexNames).toContain('idx_parts_job_id')
      expect(indexNames).toContain('idx_parts_path_id')
      expect(indexNames).toContain('idx_parts_current_step_id')
      expect(indexNames).toContain('idx_cert_attachments_part')
      expect(indexNames).toContain('idx_cert_attachments_cert')
      expect(indexNames).toContain('idx_audit_part')
      expect(indexNames).toContain('idx_audit_job')
      expect(indexNames).toContain('idx_audit_timestamp')
      expect(indexNames).toContain('idx_process_steps_path')
      expect(indexNames).toContain('idx_step_notes_step')
      expect(indexNames).toContain('idx_step_notes_job')
      expect(indexNames).toContain('idx_process_steps_assigned_to')

      db.close()
    })

    it('enforces CHECK constraint on jobs.goal_quantity', () => {
      const db = initDatabase(dbPath)
      db.pragma('foreign_keys = ON')

      expect(() => {
        db.prepare(
          'INSERT INTO jobs (id, name, goal_quantity, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        ).run('j1', 'Test', 0, new Date().toISOString(), new Date().toISOString())
      }).toThrow()

      db.close()
    })

    it('enforces CHECK constraint on certs.type', () => {
      const db = initDatabase(dbPath)

      expect(() => {
        db.prepare(
          'INSERT INTO certs (id, type, name, created_at) VALUES (?, ?, ?, ?)',
        ).run('c1', 'invalid', 'Test Cert', new Date().toISOString())
      }).toThrow()

      db.close()
    })

    it('enforces UNIQUE constraint on process_steps(path_id, step_order)', () => {
      const db = initDatabase(dbPath)
      db.pragma('foreign_keys = OFF') // Disable FK for this isolated test

      db.prepare(
        'INSERT INTO process_steps (id, path_id, name, step_order) VALUES (?, ?, ?, ?)',
      ).run('s1', 'p1', 'Step 1', 0)

      expect(() => {
        db.prepare(
          'INSERT INTO process_steps (id, path_id, name, step_order) VALUES (?, ?, ?, ?)',
        ).run('s2', 'p1', 'Step 2', 0) // same path_id + step_order
      }).toThrow()

      db.close()
    })

    it('records all migrations in _migrations table', () => {
      const db = initDatabase(dbPath)

      const applied = db.prepare('SELECT version, name FROM _migrations ORDER BY version').all() as any[]
      expect(applied).toHaveLength(15)
      expect(applied[0].version).toBe(1)
      expect(applied[0].name).toBe('initial_schema')
      expect(applied[1].version).toBe(2)
      expect(applied[1].name).toBe('add_counters_table')
      expect(applied[2].version).toBe(3)
      expect(applied[2].name).toBe('add_step_assignment')
      expect(applied[3].version).toBe(4)
      expect(applied[3].name).toBe('lifecycle_management')
      expect(applied[4].version).toBe(5)
      expect(applied[4].name).toBe('add_page_toggles')
      expect(applied[5].version).toBe(6)
      expect(applied[5].name).toBe('rename_serial_to_part')
      expect(applied[6].version).toBe(7)
      expect(applied[6].name).toBe('step_id_tracking')
      expect(applied[7].version).toBe(8)
      expect(applied[7].name).toBe('nullable_step_order')
      expect(applied[8].version).toBe(9)
      expect(applied[8].name).toBe('user_admin_roles')
      expect(applied[9].version).toBe(10)
      expect(applied[9].name).toBe('add_job_priority')
      expect(applied[10].version).toBe(11)
      expect(applied[10].name).toBe('priority_not_null_resequence')
      expect(applied[11].version).toBe(12)
      expect(applied[11].name).toBe('pin_auth')
      expect(applied[12].version).toBe(13)
      expect(applied[12].name).toBe('add_job_tags')
      expect(applied[13].version).toBe(14)
      expect(applied[13].name).toBe('simplify_bom_entries')

      db.close()
    })
  })
})
