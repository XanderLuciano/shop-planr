/**
 * Property 2: Independent failure isolation
 *
 * For any batch containing a mix of valid and invalid part IDs, all valid
 * parts SHALL advance successfully regardless of failures in other parts,
 * and each failed part SHALL have an error message in its result entry.
 *
 * **Validates: Requirements 2.4, 2.5**
 */
import { describe, it, afterEach, expect } from 'vitest'
import fc from 'fast-check'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '../../server/repositories/sqlite/index'
import { SQLiteJobRepository } from '../../server/repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '../../server/repositories/sqlite/pathRepository'
import { SQLitePartRepository } from '../../server/repositories/sqlite/partRepository'
import { SQLiteCertRepository } from '../../server/repositories/sqlite/certRepository'
import { SQLiteAuditRepository } from '../../server/repositories/sqlite/auditRepository'
import { createJobService } from '../../server/services/jobService'
import { createPathService } from '../../server/services/pathService'
import { createPartService } from '../../server/services/partService'
import { createAuditService } from '../../server/services/auditService'
import { createSequentialPartIdGenerator } from '../../server/utils/idGenerator'

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  const migrationsDir = resolve(__dirname, '../../server/repositories/sqlite/migrations')
  runMigrations(db, migrationsDir)
  return db
}

function setupServices(db: InstanceType<typeof Database>) {
  const repos = {
    jobs: new SQLiteJobRepository(db),
    paths: new SQLitePathRepository(db),
    parts: new SQLitePartRepository(db),
    certs: new SQLiteCertRepository(db),
    audit: new SQLiteAuditRepository(db),
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
  const jobService = createJobService({ jobs: repos.jobs, paths: repos.paths, parts: repos.parts })
  const pathService = createPathService({ paths: repos.paths, parts: repos.parts })
  const partService = createPartService(
    { parts: repos.parts, paths: repos.paths, certs: repos.certs },
    auditService,
    partIdGenerator,
  )

  return { jobService, pathService, partService }
}

describe('Property 2: Independent failure isolation', () => {
  let db: InstanceType<typeof Database>

  afterEach(() => {
    if (db) db.close()
  })

  it('valid parts advance regardless of invalid IDs in the same batch', () => {
    fc.assert(
      fc.property(
        fc.record({
          validCount: fc.integer({ min: 1, max: 8 }),
          invalidCount: fc.integer({ min: 1, max: 5 }),
        }),
        ({ validCount, invalidCount }) => {
          db = createTestDb()
          const { jobService, pathService, partService } = setupServices(db)

          const job = jobService.createJob({ name: 'Isolation Job', goalQuantity: validCount })
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Main Path',
            goalQuantity: validCount,
            steps: [{ name: 'OP1' }, { name: 'OP2' }],
          })

          const parts = partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: validCount },
            'user_test',
          )

          const validIds = parts.map(p => p.id)
          const invalidIds = Array.from({ length: invalidCount }, (_, i) => `nonexistent_${i}`)

          // Interleave valid and invalid IDs
          const mixedIds: string[] = []
          let vi = 0
          let ii = 0
          while (vi < validIds.length || ii < invalidIds.length) {
            if (vi < validIds.length) mixedIds.push(validIds[vi++])
            if (ii < invalidIds.length) mixedIds.push(invalidIds[ii++])
          }

          const result = partService.batchAdvanceParts(mixedIds, 'user_test')

          // ASSERT: total results match input length
          expect(result.results.length).toBe(mixedIds.length)
          expect(result.advanced + result.failed).toBe(mixedIds.length)

          // ASSERT: all valid parts advanced successfully
          expect(result.advanced).toBe(validCount)

          // ASSERT: all invalid parts failed
          expect(result.failed).toBe(invalidCount)

          // ASSERT: each valid part result is success
          for (const validId of validIds) {
            const entry = result.results.find(r => r.partId === validId)
            expect(entry).toBeDefined()
            expect(entry!.success).toBe(true)
          }

          // ASSERT: each invalid part result has an error message
          for (const invalidId of invalidIds) {
            const entry = result.results.find(r => r.partId === invalidId)
            expect(entry).toBeDefined()
            expect(entry!.success).toBe(false)
            expect(entry!.error).toBeDefined()
            expect(typeof entry!.error).toBe('string')
            expect(entry!.error!.length).toBeGreaterThan(0)
          }

          db.close()
          db = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})
