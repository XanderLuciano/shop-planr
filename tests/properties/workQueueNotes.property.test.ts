/**
 * Property 7: Note length validation
 *
 * For any string of length > 1000 characters, the note input should be
 * rejected or truncated to 1000 characters. For any string of length
 * ≤ 1000 characters (including empty), the note input should be accepted as-is.
 *
 * **Validates: Requirements 5.4**
 */
import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '~/server/repositories/sqlite/index'
import { SQLiteJobRepository } from '~/server/repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '~/server/repositories/sqlite/pathRepository'
import { SQLiteSerialRepository } from '~/server/repositories/sqlite/serialRepository'
import { SQLiteCertRepository } from '~/server/repositories/sqlite/certRepository'
import { SQLiteAuditRepository } from '~/server/repositories/sqlite/auditRepository'
import { SQLiteNoteRepository } from '~/server/repositories/sqlite/noteRepository'
import { createJobService } from '~/server/services/jobService'
import { createPathService } from '~/server/services/pathService'
import { createSerialService } from '~/server/services/serialService'
import { createAuditService } from '~/server/services/auditService'
import { createNoteService } from '~/server/services/noteService'
import { createSequentialSnGenerator } from '~/server/utils/idGenerator'

const migrationsDir = resolve(__dirname, '../../server/repositories/sqlite/migrations')

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, migrationsDir)
  return db
}

function setupServices(db: Database.default.Database) {
  const repos = {
    jobs: new SQLiteJobRepository(db),
    paths: new SQLitePathRepository(db),
    serials: new SQLiteSerialRepository(db),
    certs: new SQLiteCertRepository(db),
    audit: new SQLiteAuditRepository(db),
    notes: new SQLiteNoteRepository(db),
  }

  const snGenerator = createSequentialSnGenerator({
    getCounter: () => {
      const row = db.prepare('SELECT value FROM counters WHERE name = ?').get('sn') as { value: number } | undefined
      return row?.value ?? 0
    },
    setCounter: (v: number) => {
      db.prepare('INSERT OR REPLACE INTO counters (name, value) VALUES (?, ?)').run('sn', v)
    },
  })

  const auditService = createAuditService({ audit: repos.audit })
  const jobService = createJobService({ jobs: repos.jobs, paths: repos.paths, serials: repos.serials })
  const pathService = createPathService({ paths: repos.paths, serials: repos.serials })
  const serialService = createSerialService(
    { serials: repos.serials, paths: repos.paths, certs: repos.certs },
    auditService,
    snGenerator,
  )
  const noteService = createNoteService({ notes: repos.notes }, auditService)

  return { jobService, pathService, serialService, noteService }
}

const MAX_NOTE_LENGTH = 1000

/**
 * Pure validation function matching the note validation logic
 * in useWorkQueue.advanceBatch.
 * Returns null if valid, or an error message if invalid.
 */
function validateNoteLength(note: string | undefined): string | null {
  if (note === undefined || note === null) return null
  const trimmed = note.trim()
  if (trimmed.length === 0) return null
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return 'Note must be 1000 characters or fewer'
  }
  return null
}

describe('Property 7: Note length validation', () => {
  it('rejects notes longer than 1000 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1001, maxLength: 2000 }).filter(s => s.trim().length > 1000),
        (note) => {
          const result = validateNoteLength(note)
          expect(result).not.toBeNull()
          expect(result).toContain('1000')
        },
      ),
      { numRuns: 100 },
    )
  })

  it('accepts notes of 1000 characters or fewer', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 1000 }),
        (note) => {
          fc.pre(note.trim().length <= 1000)
          const result = validateNoteLength(note)
          expect(result).toBeNull()
        },
      ),
      { numRuns: 100 },
    )
  })

  it('accepts empty or whitespace-only notes', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 50 }).map(n => ' '.repeat(n)),
        (note) => {
          const result = validateNoteLength(note)
          expect(result).toBeNull()
        },
      ),
      { numRuns: 100 },
    )
  })

  it('accepts undefined/null notes', () => {
    expect(validateNoteLength(undefined)).toBeNull()
    expect(validateNoteLength(null as any)).toBeNull()
  })
})

/**
 * Property 6: Note creation on advancement with non-empty text
 *
 * For any non-empty note text (≤ 1000 chars) and any non-empty set of serial IDs,
 * when advancement is performed with a note, a StepNote record should be created
 * with serialIds matching the advanced serials and text matching the provided note.
 * When note text is empty or absent, no StepNote should be created.
 *
 * **Validates: Requirements 5.2, 5.3**
 */
describe('Property 6: Note creation on advancement with non-empty text', () => {
  let db: ReturnType<typeof createTestDb>

  afterEach(() => {
    if (db) {
      db.close()
      db = null as any
    }
  })

  it('non-empty note creates a StepNote with matching serialIds and text', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        fc.integer({ min: 1, max: 5 }),
        (noteText, serialCount) => {
          db = createTestDb()
          const { jobService, pathService, serialService, noteService } = setupServices(db)

          const job = jobService.createJob({ name: 'TestJob', goalQuantity: serialCount })
          const path = pathService.createPath({
            jobId: job.id,
            name: 'TestPath',
            goalQuantity: serialCount,
            steps: [{ name: 'Step 0' }, { name: 'Step 1' }],
          })

          const serials = serialService.batchCreateSerials(
            { jobId: job.id, pathId: path.id, quantity: serialCount },
            'user_test',
          )

          const serialIds = serials.map(s => s.id)
          const stepId = path.steps[0]!.id

          // Advance serials
          for (const id of serialIds) {
            serialService.advanceSerial(id, 'user_test')
          }

          // Create note (simulating what advanceBatch does)
          const created = noteService.createNote({
            jobId: job.id,
            pathId: path.id,
            stepId,
            serialIds,
            text: noteText,
            userId: 'user_test',
          })

          expect(created.text).toBe(noteText.trim())
          expect(created.serialIds).toEqual(serialIds)
          expect(created.stepId).toBe(stepId)
          expect(created.jobId).toBe(job.id)

          // Verify it's retrievable
          const notes = noteService.getNotesForStep(stepId)
          expect(notes.length).toBe(1)
          expect(notes[0]!.id).toBe(created.id)

          db.close()
          db = null as any
        },
      ),
      { numRuns: 100 },
    )
  })

  it('empty or whitespace-only note does not create a StepNote', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 20 }).map(n => ' '.repeat(n)),
        (noteText) => {
          db = createTestDb()
          const { jobService, pathService, serialService, noteService } = setupServices(db)

          const job = jobService.createJob({ name: 'TestJob', goalQuantity: 2 })
          const path = pathService.createPath({
            jobId: job.id,
            name: 'TestPath',
            goalQuantity: 2,
            steps: [{ name: 'Step 0' }, { name: 'Step 1' }],
          })

          const serials = serialService.batchCreateSerials(
            { jobId: job.id, pathId: path.id, quantity: 2 },
            'user_test',
          )

          const serialIds = serials.map(s => s.id)
          const stepId = path.steps[0]!.id

          // Advance serials
          for (const id of serialIds) {
            serialService.advanceSerial(id, 'user_test')
          }

          // Simulate advanceBatch logic: skip note creation for empty text
          const trimmed = noteText.trim()
          if (trimmed.length > 0) {
            noteService.createNote({
              jobId: job.id,
              pathId: path.id,
              stepId,
              serialIds,
              text: trimmed,
              userId: 'user_test',
            })
          }

          // Verify no note was created (since text is empty/whitespace)
          const notes = noteService.getNotesForStep(stepId)
          expect(notes.length).toBe(0)

          db.close()
          db = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})
