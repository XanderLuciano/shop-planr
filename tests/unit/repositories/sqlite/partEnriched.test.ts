import { describe, it, expect, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '../../../../server/repositories/sqlite/index'
import { SQLiteJobRepository } from '../../../../server/repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '../../../../server/repositories/sqlite/pathRepository'
import { SQLitePartRepository } from '../../../../server/repositories/sqlite/partRepository'
import type { Path, ProcessStep } from '../../../../server/types/domain'

const migrationsDir = resolve(__dirname, '../../../../server/repositories/sqlite/migrations')
const TS = '2025-01-01T00:00:00Z'

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, migrationsDir)
  return db
}

function makeStep(overrides: Partial<ProcessStep> & { id: string, name: string, order: number }): ProcessStep {
  return {
    optional: false,
    dependencyType: 'preferred',
    completedCount: 0,
    ...overrides,
  }
}

function makePath(overrides: Partial<Path> & { id: string, jobId: string, name: string, steps: ProcessStep[] }): Path {
  return {
    goalQuantity: 10,
    advancementMode: 'strict',
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  }
}

describe('SQLitePartRepository.listAllEnriched', () => {
  let db: InstanceType<typeof Database>

  afterEach(() => {
    if (db) db.close()
  })

  function setup() {
    db = createTestDb()
    const jobs = new SQLiteJobRepository(db)
    const paths = new SQLitePathRepository(db)
    const parts = new SQLitePartRepository(db)

    // Create users referenced by step assignments (FK constraint)
    const insertUser = db.prepare(
      'INSERT INTO users (id, username, display_name, is_admin, active, created_at) VALUES (?, ?, ?, 0, 1, ?)',
    )
    insertUser.run('Alice', 'alice', 'Alice', TS)
    insertUser.run('Bob', 'bob', 'Bob', TS)

    return { jobs, paths, parts }
  }

  it('returns empty array when no parts exist', () => {
    const { parts } = setup()
    expect(parts.listAllEnriched()).toEqual([])
  })

  it('returns enriched parts with job name, path name, and step name', () => {
    const { jobs, paths, parts } = setup()

    const job = jobs.createWithAutoIncPriority({
      id: 'job_1', name: 'Widget Batch', goalQuantity: 10,
      createdAt: TS, updatedAt: TS,
    })

    paths.create(makePath({
      id: 'path_1', jobId: job.id, name: 'Main Route',
      steps: [
        makeStep({ id: 'step_1', name: 'Cut', order: 0, location: 'Shop Floor', assignedTo: 'Alice' }),
        makeStep({ id: 'step_2', name: 'Polish', order: 1 }),
      ],
    }))

    parts.create({
      id: 'part_1', jobId: job.id, pathId: 'path_1',
      currentStepId: 'step_1', status: 'in_progress',
      forceCompleted: false, createdAt: TS, updatedAt: TS,
    })

    const enriched = parts.listAllEnriched()
    expect(enriched).toHaveLength(1)
    expect(enriched[0].id).toBe('part_1')
    expect(enriched[0].jobName).toBe('Widget Batch')
    expect(enriched[0].pathName).toBe('Main Route')
    expect(enriched[0].currentStepName).toBe('Cut')
    expect(enriched[0].assignedTo).toBe('Alice')
    expect(enriched[0].status).toBe('in-progress')
  })

  it('returns "Completed" step name for completed parts', () => {
    const { jobs, paths, parts } = setup()

    jobs.createWithAutoIncPriority({ id: 'job_1', name: 'Job', goalQuantity: 1, createdAt: TS, updatedAt: TS })
    paths.create(makePath({
      id: 'path_1', jobId: 'job_1', name: 'Route',
      steps: [makeStep({ id: 'step_1', name: 'Step', order: 0 })],
    }))
    parts.create({
      id: 'part_1', jobId: 'job_1', pathId: 'path_1',
      currentStepId: null, status: 'completed',
      forceCompleted: false, createdAt: TS, updatedAt: TS,
    })

    const enriched = parts.listAllEnriched()
    expect(enriched[0].status).toBe('completed')
    expect(enriched[0].currentStepName).toBe('Completed')
    expect(enriched[0].currentStepId).toBeNull()
  })

  it('returns "Scrapped" step name for scrapped parts', () => {
    const { jobs, paths, parts } = setup()

    jobs.createWithAutoIncPriority({ id: 'job_1', name: 'Job', goalQuantity: 1, createdAt: TS, updatedAt: TS })
    paths.create(makePath({
      id: 'path_1', jobId: 'job_1', name: 'Route',
      steps: [makeStep({ id: 'step_1', name: 'Step', order: 0 })],
    }))
    parts.create({
      id: 'part_1', jobId: 'job_1', pathId: 'path_1',
      currentStepId: 'step_1', status: 'scrapped',
      scrapReason: 'damaged',
      forceCompleted: false, createdAt: TS, updatedAt: TS,
    })

    const enriched = parts.listAllEnriched()
    expect(enriched[0].status).toBe('scrapped')
    expect(enriched[0].currentStepName).toBe('Scrapped')
    expect(enriched[0].scrapReason).toBe('damaged')
  })

  it('returns undefined assignedTo when step has no assignment', () => {
    const { jobs, paths, parts } = setup()

    jobs.createWithAutoIncPriority({ id: 'job_1', name: 'Job', goalQuantity: 1, createdAt: TS, updatedAt: TS })
    paths.create(makePath({
      id: 'path_1', jobId: 'job_1', name: 'Route',
      steps: [makeStep({ id: 'step_1', name: 'Step', order: 0 })],
    }))
    parts.create({
      id: 'part_1', jobId: 'job_1', pathId: 'path_1',
      currentStepId: 'step_1', status: 'in_progress',
      forceCompleted: false, createdAt: TS, updatedAt: TS,
    })

    const enriched = parts.listAllEnriched()
    expect(enriched[0].assignedTo).toBeUndefined()
  })

  it('handles force-completed parts', () => {
    const { jobs, paths, parts } = setup()

    jobs.createWithAutoIncPriority({ id: 'job_1', name: 'Job', goalQuantity: 1, createdAt: TS, updatedAt: TS })
    paths.create(makePath({
      id: 'path_1', jobId: 'job_1', name: 'Route',
      steps: [makeStep({ id: 'step_1', name: 'Step', order: 0 })],
    }))
    parts.create({
      id: 'part_1', jobId: 'job_1', pathId: 'path_1',
      currentStepId: null, status: 'completed',
      forceCompleted: true, createdAt: TS, updatedAt: TS,
    })

    const enriched = parts.listAllEnriched()
    expect(enriched[0].forceCompleted).toBe(true)
    expect(enriched[0].status).toBe('completed')
  })

  it('returns parts across multiple jobs and paths', () => {
    const { jobs, paths, parts } = setup()

    jobs.createWithAutoIncPriority({ id: 'job_a', name: 'Job A', goalQuantity: 5, createdAt: TS, updatedAt: TS })
    jobs.createWithAutoIncPriority({ id: 'job_b', name: 'Job B', goalQuantity: 5, createdAt: TS, updatedAt: TS })
    paths.create(makePath({
      id: 'path_a', jobId: 'job_a', name: 'Route A',
      steps: [makeStep({ id: 'step_a1', name: 'Weld', order: 0, assignedTo: 'Bob' })],
    }))
    paths.create(makePath({
      id: 'path_b', jobId: 'job_b', name: 'Route B',
      steps: [makeStep({ id: 'step_b1', name: 'Paint', order: 0 })],
    }))

    parts.create({
      id: 'part_1', jobId: 'job_a', pathId: 'path_a',
      currentStepId: 'step_a1', status: 'in_progress',
      forceCompleted: false, createdAt: TS, updatedAt: TS,
    })
    parts.create({
      id: 'part_2', jobId: 'job_b', pathId: 'path_b',
      currentStepId: 'step_b1', status: 'in_progress',
      forceCompleted: false, createdAt: '2025-01-02T00:00:00Z', updatedAt: '2025-01-02T00:00:00Z',
    })

    const enriched = parts.listAllEnriched()
    expect(enriched).toHaveLength(2)

    const partA = enriched.find(e => e.id === 'part_1')!
    expect(partA.jobName).toBe('Job A')
    expect(partA.pathName).toBe('Route A')
    expect(partA.currentStepName).toBe('Weld')
    expect(partA.assignedTo).toBe('Bob')

    const partB = enriched.find(e => e.id === 'part_2')!
    expect(partB.jobName).toBe('Job B')
    expect(partB.pathName).toBe('Route B')
    expect(partB.currentStepName).toBe('Paint')
    expect(partB.assignedTo).toBeUndefined()
  })
})

describe('SQLitePartRepository.countsByJob', () => {
  let db: InstanceType<typeof Database>

  afterEach(() => {
    if (db) db.close()
  })

  function setup() {
    db = createTestDb()
    const jobs = new SQLiteJobRepository(db)
    const paths = new SQLitePathRepository(db)
    const parts = new SQLitePartRepository(db)

    const insertUser = db.prepare(
      'INSERT INTO users (id, username, display_name, is_admin, active, created_at) VALUES (?, ?, ?, 0, 1, ?)',
    )
    insertUser.run('Alice', 'alice', 'Alice', TS)

    return { jobs, paths, parts }
  }

  it('returns empty map when no parts exist', () => {
    const { parts } = setup()
    expect(parts.countsByJob().size).toBe(0)
  })

  it('returns correct counts for a single job', () => {
    const { jobs, paths, parts } = setup()

    jobs.createWithAutoIncPriority({ id: 'job_1', name: 'Job', goalQuantity: 10, createdAt: TS, updatedAt: TS })
    paths.create(makePath({
      id: 'path_1', jobId: 'job_1', name: 'Route',
      steps: [makeStep({ id: 'step_1', name: 'Step', order: 0 })],
    }))

    parts.create({ id: 'p1', jobId: 'job_1', pathId: 'path_1', currentStepId: 'step_1', status: 'in_progress', forceCompleted: false, createdAt: TS, updatedAt: TS })
    parts.create({ id: 'p2', jobId: 'job_1', pathId: 'path_1', currentStepId: null, status: 'completed', forceCompleted: false, createdAt: TS, updatedAt: TS })
    parts.create({ id: 'p3', jobId: 'job_1', pathId: 'path_1', currentStepId: 'step_1', status: 'scrapped', forceCompleted: false, createdAt: TS, updatedAt: TS })

    const counts = parts.countsByJob()
    expect(counts.size).toBe(1)
    const c = counts.get('job_1')!
    expect(c.total).toBe(3)
    expect(c.completed).toBe(1)
    expect(c.scrapped).toBe(1)
  })

  it('returns separate counts for multiple jobs', () => {
    const { jobs, paths, parts } = setup()

    jobs.createWithAutoIncPriority({ id: 'job_a', name: 'A', goalQuantity: 5, createdAt: TS, updatedAt: TS })
    jobs.createWithAutoIncPriority({ id: 'job_b', name: 'B', goalQuantity: 5, createdAt: TS, updatedAt: TS })
    paths.create(makePath({
      id: 'path_a', jobId: 'job_a', name: 'Route A',
      steps: [makeStep({ id: 'step_a', name: 'Step A', order: 0 })],
    }))
    paths.create(makePath({
      id: 'path_b', jobId: 'job_b', name: 'Route B',
      steps: [makeStep({ id: 'step_b', name: 'Step B', order: 0 })],
    }))

    parts.create({ id: 'p1', jobId: 'job_a', pathId: 'path_a', currentStepId: null, status: 'completed', forceCompleted: false, createdAt: TS, updatedAt: TS })
    parts.create({ id: 'p2', jobId: 'job_a', pathId: 'path_a', currentStepId: null, status: 'completed', forceCompleted: false, createdAt: TS, updatedAt: TS })
    parts.create({ id: 'p3', jobId: 'job_b', pathId: 'path_b', currentStepId: 'step_b', status: 'in_progress', forceCompleted: false, createdAt: TS, updatedAt: TS })

    const counts = parts.countsByJob()
    expect(counts.size).toBe(2)

    const a = counts.get('job_a')!
    expect(a.total).toBe(2)
    expect(a.completed).toBe(2)
    expect(a.scrapped).toBe(0)

    const b = counts.get('job_b')!
    expect(b.total).toBe(1)
    expect(b.completed).toBe(0)
    expect(b.scrapped).toBe(0)
  })
})
