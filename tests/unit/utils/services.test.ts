import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../../server/repositories/sqlite/index'
import { SQLiteJobRepository } from '../../../server/repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '../../../server/repositories/sqlite/pathRepository'
import { SQLitePartRepository } from '../../../server/repositories/sqlite/partRepository'
import { SQLiteCertRepository } from '../../../server/repositories/sqlite/certRepository'
import { SQLiteTemplateRepository } from '../../../server/repositories/sqlite/templateRepository'
import { SQLiteAuditRepository } from '../../../server/repositories/sqlite/auditRepository'
import { SQLiteBomRepository } from '../../../server/repositories/sqlite/bomRepository'
import { SQLiteSettingsRepository } from '../../../server/repositories/sqlite/settingsRepository'
import { SQLiteNoteRepository } from '../../../server/repositories/sqlite/noteRepository'
import { SQLiteUserRepository } from '../../../server/repositories/sqlite/userRepository'
import { createAuditService } from '../../../server/services/auditService'
import { createUserService } from '../../../server/services/userService'
import { createJobService } from '../../../server/services/jobService'
import { createPathService } from '../../../server/services/pathService'
import { createPartService } from '../../../server/services/partService'
import { createCertService } from '../../../server/services/certService'
import { createTemplateService } from '../../../server/services/templateService'
import { createNoteService } from '../../../server/services/noteService'
import { createSettingsService } from '../../../server/services/settingsService'
import { createBomService } from '../../../server/services/bomService'
import { createSequentialPartIdGenerator } from '../../../server/utils/idGenerator'
import type { RepositorySet } from '../../../server/repositories/sqlite/index'
import { resolve } from 'path'

function createTestRepoSet(): RepositorySet {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  const migrationsDir = resolve(__dirname, '../../../server/repositories/sqlite/migrations')
  runMigrations(db, migrationsDir)

  return {
    jobs: new SQLiteJobRepository(db),
    paths: new SQLitePathRepository(db),
    parts: new SQLitePartRepository(db),
    certs: new SQLiteCertRepository(db),
    templates: new SQLiteTemplateRepository(db),
    audit: new SQLiteAuditRepository(db),
    bom: new SQLiteBomRepository(db),
    settings: new SQLiteSettingsRepository(db),
    notes: new SQLiteNoteRepository(db),
    users: new SQLiteUserRepository(db),
    _db: db
  } as unknown as RepositorySet
}

describe('Service Factory (getServices pattern)', () => {
  let repos: RepositorySet

  beforeEach(() => {
    repos = createTestRepoSet()
  })

  afterEach(() => {
    repos._db.close()
  })

  it('wires all services together and they are callable', () => {
    const auditService = createAuditService({ audit: repos.audit })
    const userService = createUserService({ users: repos.users })
    const jobService = createJobService({ jobs: repos.jobs, paths: repos.paths, parts: repos.parts })
    const pathService = createPathService({ paths: repos.paths, parts: repos.parts })
    const templateService = createTemplateService({ templates: repos.templates, paths: repos.paths })
    const bomService = createBomService({ bom: repos.bom, parts: repos.parts })

    const partIdGenerator = createSequentialPartIdGenerator({
      getCounter: () => {
        const row = repos._db.prepare('SELECT value FROM counters WHERE name = ?').get('part') as { value: number } | undefined
        return row?.value ?? 0
      },
      setCounter: (v: number) => {
        repos._db.prepare('INSERT OR REPLACE INTO counters (name, value) VALUES (?, ?)').run('part', v)
      }
    })

    const partService = createPartService(
      { parts: repos.parts, paths: repos.paths, certs: repos.certs },
      auditService,
      partIdGenerator
    )
    const certService = createCertService({ certs: repos.certs }, auditService)
    const noteService = createNoteService({ notes: repos.notes }, auditService)
    const settingsService = createSettingsService({ settings: repos.settings }, {
      jiraBaseUrl: 'https://jira.example.com',
      jiraProjectKey: 'PI',
      jiraUsername: '',
      jiraApiToken: ''
    })

    // Verify all services are defined
    expect(auditService).toBeDefined()
    expect(userService).toBeDefined()
    expect(jobService).toBeDefined()
    expect(pathService).toBeDefined()
    expect(partService).toBeDefined()
    expect(certService).toBeDefined()
    expect(templateService).toBeDefined()
    expect(noteService).toBeDefined()
    expect(settingsService).toBeDefined()
    expect(bomService).toBeDefined()
  })

  it('services work end-to-end: create job → path → parts → advance', () => {
    const auditService = createAuditService({ audit: repos.audit })
    const jobService = createJobService({ jobs: repos.jobs, paths: repos.paths, parts: repos.parts })
    const pathService = createPathService({ paths: repos.paths, parts: repos.parts })

    const partIdGenerator = createSequentialPartIdGenerator({
      getCounter: () => {
        const row = repos._db.prepare('SELECT value FROM counters WHERE name = ?').get('part') as { value: number } | undefined
        return row?.value ?? 0
      },
      setCounter: (v: number) => {
        repos._db.prepare('INSERT OR REPLACE INTO counters (name, value) VALUES (?, ?)').run('part', v)
      }
    })

    const partService = createPartService(
      { parts: repos.parts, paths: repos.paths, certs: repos.certs },
      auditService,
      partIdGenerator
    )

    // Create a job
    const job = jobService.createJob({ name: 'Test Job', goalQuantity: 5 })
    expect(job.id).toMatch(/^job_/)

    // Create a path with steps
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Main Route',
      goalQuantity: 5,
      steps: [
        { name: 'Machining', location: 'Shop Floor' },
        { name: 'Inspection', location: 'QC Lab' }
      ]
    })
    expect(path.steps).toHaveLength(2)

    // Batch create parts
    const parts = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 3 },
      'user_test'
    )
    expect(parts).toHaveLength(3)
    expect(parts[0].id).toBe('part_00001')
    expect(parts[1].id).toBe('part_00002')
    expect(parts[2].id).toBe('part_00003')

    // Advance first part
    const advanced = partService.advancePart(parts[0].id, 'user_test')
    expect(advanced.currentStepId).not.toBeNull()

    // Advance to completion
    const completed = partService.advancePart(parts[0].id, 'user_test')
    expect(completed.currentStepId).toBeNull()

    // Check job progress
    const progress = jobService.computeJobProgress(job.id)
    expect(progress.totalParts).toBe(3)
    expect(progress.completedParts).toBe(1)
    expect(progress.progressPercent).toBe(20) // 1/5 * 100
  })

  it('Part ID generator persists counter across calls', () => {
    const partIdGenerator = createSequentialPartIdGenerator({
      getCounter: () => {
        const row = repos._db.prepare('SELECT value FROM counters WHERE name = ?').get('part') as { value: number } | undefined
        return row?.value ?? 0
      },
      setCounter: (v: number) => {
        repos._db.prepare('INSERT OR REPLACE INTO counters (name, value) VALUES (?, ?)').run('part', v)
      }
    })

    expect(partIdGenerator.next()).toBe('part_00001')
    expect(partIdGenerator.next()).toBe('part_00002')

    const batch = partIdGenerator.nextBatch(3)
    expect(batch).toEqual(['part_00003', 'part_00004', 'part_00005'])

    // Counter should be at 5 now
    expect(partIdGenerator.next()).toBe('part_00006')
  })
})
