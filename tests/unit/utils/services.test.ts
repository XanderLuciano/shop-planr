import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../../server/repositories/sqlite/index'
import { SQLiteJobRepository } from '../../../server/repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '../../../server/repositories/sqlite/pathRepository'
import { SQLiteSerialRepository } from '../../../server/repositories/sqlite/serialRepository'
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
import { createSerialService } from '../../../server/services/serialService'
import { createCertService } from '../../../server/services/certService'
import { createTemplateService } from '../../../server/services/templateService'
import { createNoteService } from '../../../server/services/noteService'
import { createSettingsService } from '../../../server/services/settingsService'
import { createBomService } from '../../../server/services/bomService'
import { createSequentialSnGenerator } from '../../../server/utils/idGenerator'
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
    serials: new SQLiteSerialRepository(db),
    certs: new SQLiteCertRepository(db),
    templates: new SQLiteTemplateRepository(db),
    audit: new SQLiteAuditRepository(db),
    bom: new SQLiteBomRepository(db),
    settings: new SQLiteSettingsRepository(db),
    notes: new SQLiteNoteRepository(db),
    users: new SQLiteUserRepository(db),
    _db: db
  }
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
    const jobService = createJobService({ jobs: repos.jobs, paths: repos.paths, serials: repos.serials })
    const pathService = createPathService({ paths: repos.paths, serials: repos.serials })
    const templateService = createTemplateService({ templates: repos.templates, paths: repos.paths })
    const bomService = createBomService({ bom: repos.bom, serials: repos.serials })

    const snGenerator = createSequentialSnGenerator({
      getCounter: () => {
        const row = repos._db.prepare('SELECT value FROM counters WHERE name = ?').get('sn') as { value: number } | undefined
        return row?.value ?? 0
      },
      setCounter: (v: number) => {
        repos._db.prepare('INSERT OR REPLACE INTO counters (name, value) VALUES (?, ?)').run('sn', v)
      }
    })

    const serialService = createSerialService(
      { serials: repos.serials, paths: repos.paths, certs: repos.certs },
      auditService,
      snGenerator
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
    expect(serialService).toBeDefined()
    expect(certService).toBeDefined()
    expect(templateService).toBeDefined()
    expect(noteService).toBeDefined()
    expect(settingsService).toBeDefined()
    expect(bomService).toBeDefined()
  })

  it('services work end-to-end: create job → path → serials → advance', () => {
    const auditService = createAuditService({ audit: repos.audit })
    const jobService = createJobService({ jobs: repos.jobs, paths: repos.paths, serials: repos.serials })
    const pathService = createPathService({ paths: repos.paths, serials: repos.serials })

    const snGenerator = createSequentialSnGenerator({
      getCounter: () => {
        const row = repos._db.prepare('SELECT value FROM counters WHERE name = ?').get('sn') as { value: number } | undefined
        return row?.value ?? 0
      },
      setCounter: (v: number) => {
        repos._db.prepare('INSERT OR REPLACE INTO counters (name, value) VALUES (?, ?)').run('sn', v)
      }
    })

    const serialService = createSerialService(
      { serials: repos.serials, paths: repos.paths, certs: repos.certs },
      auditService,
      snGenerator
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

    // Batch create serials
    const serials = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 3 },
      'user_test'
    )
    expect(serials).toHaveLength(3)
    expect(serials[0].id).toBe('SN-00001')
    expect(serials[1].id).toBe('SN-00002')
    expect(serials[2].id).toBe('SN-00003')

    // Advance first serial
    const advanced = serialService.advanceSerial(serials[0].id, 'user_test')
    expect(advanced.currentStepIndex).toBe(1)

    // Advance to completion
    const completed = serialService.advanceSerial(serials[0].id, 'user_test')
    expect(completed.currentStepIndex).toBe(-1)

    // Check job progress
    const progress = jobService.computeJobProgress(job.id)
    expect(progress.totalSerials).toBe(3)
    expect(progress.completedSerials).toBe(1)
    expect(progress.progressPercent).toBe(20) // 1/5 * 100
  })

  it('SN generator persists counter across calls', () => {
    const snGenerator = createSequentialSnGenerator({
      getCounter: () => {
        const row = repos._db.prepare('SELECT value FROM counters WHERE name = ?').get('sn') as { value: number } | undefined
        return row?.value ?? 0
      },
      setCounter: (v: number) => {
        repos._db.prepare('INSERT OR REPLACE INTO counters (name, value) VALUES (?, ?)').run('sn', v)
      }
    })

    expect(snGenerator.next()).toBe('SN-00001')
    expect(snGenerator.next()).toBe('SN-00002')

    const batch = snGenerator.nextBatch(3)
    expect(batch).toEqual(['SN-00003', 'SN-00004', 'SN-00005'])

    // Counter should be at 5 now
    expect(snGenerator.next()).toBe('SN-00006')
  })
})
