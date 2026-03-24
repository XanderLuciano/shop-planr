/**
 * Property 2: Serial Number Uniqueness
 *
 * For any sequence of batch SN creation operations across any number of Jobs and Paths,
 * all SN identifiers are unique.
 *
 * **Validates: Requirements 4.1, 4.2**
 */
import { describe, it, afterEach } from 'vitest'
import fc from 'fast-check'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '../../server/repositories/sqlite/index'
import { SQLiteJobRepository } from '../../server/repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '../../server/repositories/sqlite/pathRepository'
import { SQLiteSerialRepository } from '../../server/repositories/sqlite/serialRepository'
import { SQLiteCertRepository } from '../../server/repositories/sqlite/certRepository'
import { SQLiteAuditRepository } from '../../server/repositories/sqlite/auditRepository'
import { createJobService } from '../../server/services/jobService'
import { createPathService } from '../../server/services/pathService'
import { createSerialService } from '../../server/services/serialService'
import { createAuditService } from '../../server/services/auditService'
import { createSequentialSnGenerator } from '../../server/utils/idGenerator'

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  const migrationsDir = resolve(__dirname, '../../server/repositories/sqlite/migrations')
  runMigrations(db, migrationsDir)
  return db
}

function setupServices(db: Database.default.Database) {
  const repos = {
    jobs: new SQLiteJobRepository(db),
    paths: new SQLitePathRepository(db),
    serials: new SQLiteSerialRepository(db),
    certs: new SQLiteCertRepository(db),
    audit: new SQLiteAuditRepository(db)
  }

  const snGenerator = createSequentialSnGenerator({
    getCounter: () => {
      const row = db.prepare('SELECT value FROM counters WHERE name = ?').get('sn') as { value: number } | undefined
      return row?.value ?? 0
    },
    setCounter: (v: number) => {
      db.prepare('INSERT OR REPLACE INTO counters (name, value) VALUES (?, ?)').run('sn', v)
    }
  })

  const auditService = createAuditService({ audit: repos.audit })
  const jobService = createJobService({ jobs: repos.jobs, paths: repos.paths, serials: repos.serials })
  const pathService = createPathService({ paths: repos.paths, serials: repos.serials })
  const serialService = createSerialService(
    { serials: repos.serials, paths: repos.paths, certs: repos.certs },
    auditService,
    snGenerator
  )

  return { jobService, pathService, serialService }
}

describe('Property 2: Serial Number Uniqueness', () => {
  let db: Database.default.Database

  afterEach(() => {
    if (db) db.close()
  })

  it('all SN identifiers are unique across multiple jobs, paths, and batch creates', () => {
    fc.assert(
      fc.property(
        // Generate 1-3 jobs, each with 1-3 paths, each with 1-20 SNs
        fc.array(
          fc.array(
            fc.integer({ min: 1, max: 20 }),
            { minLength: 1, maxLength: 3 }
          ),
          { minLength: 1, maxLength: 3 }
        ),
        (jobPathQuantities) => {
          db = createTestDb()
          const { jobService, pathService, serialService } = setupServices(db)

          const allSerialIds: string[] = []

          for (let j = 0; j < jobPathQuantities.length; j++) {
            const job = jobService.createJob({
              name: `Job ${j}`,
              goalQuantity: 100
            })

            for (let p = 0; p < jobPathQuantities[j].length; p++) {
              const quantity = jobPathQuantities[j][p]
              const path = pathService.createPath({
                jobId: job.id,
                name: `Path ${p}`,
                goalQuantity: quantity,
                steps: [{ name: 'OP1' }, { name: 'OP2' }]
              })

              const serials = serialService.batchCreateSerials(
                { jobId: job.id, pathId: path.id, quantity },
                'user_test'
              )

              for (const s of serials) {
                allSerialIds.push(s.id)
              }
            }
          }

          // ASSERT: all IDs are unique
          const uniqueIds = new Set(allSerialIds)
          expect(uniqueIds.size).toBe(allSerialIds.length)

          db.close()
          db = null as any
        }
      ),
      { numRuns: 100 }
    )
  })
})
