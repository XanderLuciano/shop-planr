import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createTestDb } from '../../integration/helpers'
import { SQLitePathRepository } from '~/server/repositories/sqlite/pathRepository'
import { generateId } from '~/server/utils/idGenerator'

describe('hasStepDependents', () => {
  let db: Database.Database
  let repo: SQLitePathRepository
  let jobId: string
  let pathId: string
  let stepId: string
  let partId: string
  let certId: string

  beforeEach(() => {
    db = createTestDb()
    repo = new SQLitePathRepository(db)

    jobId = generateId('job')
    pathId = generateId('path')
    stepId = generateId('step')
    partId = generateId('part')
    certId = generateId('cert')
    const now = new Date().toISOString()

    // Create prerequisite rows: job, path, step, part, cert
    db.prepare('INSERT INTO jobs (id, name, goal_quantity, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(jobId, 'Test Job', 10, now, now)
    db.prepare('INSERT INTO paths (id, job_id, name, goal_quantity, advancement_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(pathId, jobId, 'Test Path', 10, 'strict', now, now)
    db.prepare('INSERT INTO process_steps (id, path_id, name, step_order, optional, dependency_type, completed_count) VALUES (?, ?, ?, ?, ?, ?, 0)').run(stepId, pathId, 'Step 1', 0, 0, 'preferred')
    db.prepare('INSERT INTO parts (id, job_id, path_id, current_step_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(partId, jobId, pathId, stepId, 'in_progress', now, now)
    db.prepare('INSERT INTO certs (id, type, name, created_at) VALUES (?, ?, ?, ?)').run(certId, 'material', 'Test Cert', now)
  })

  afterEach(() => {
    db.close()
  })

  it('returns true when step has cert_attachments', () => {
    const now = new Date().toISOString()
    db.prepare('INSERT INTO cert_attachments (part_id, cert_id, step_id, attached_at, attached_by) VALUES (?, ?, ?, ?, ?)').run(partId, certId, stepId, now, 'user1')

    expect(repo.hasStepDependents(stepId)).toBe(true)
  })

  it('returns true when step has step_notes', () => {
    const noteId = generateId('note')
    const now = new Date().toISOString()
    db.prepare('INSERT INTO step_notes (id, job_id, path_id, step_id, serial_ids, text, created_by, created_at, pushed_to_jira) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(noteId, jobId, pathId, stepId, '[]', 'A note', 'user1', now, 0)

    expect(repo.hasStepDependents(stepId)).toBe(true)
  })

  it('returns true when step has part_step_statuses', () => {
    const statusId = generateId('pss')
    const now = new Date().toISOString()
    db.prepare('INSERT INTO part_step_statuses (id, part_id, step_id, sequence_number, status, entered_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(statusId, partId, stepId, 1, 'pending', now, now)

    expect(repo.hasStepDependents(stepId)).toBe(true)
  })

  it('returns true when step has part_step_overrides', () => {
    const overrideId = generateId('pso')
    const now = new Date().toISOString()
    db.prepare('INSERT INTO part_step_overrides (id, part_id, step_id, active, reason, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(overrideId, partId, stepId, 1, 'fast-track', 'user1', now)

    expect(repo.hasStepDependents(stepId)).toBe(true)
  })

  it('returns false when step has no dependents', () => {
    expect(repo.hasStepDependents(stepId)).toBe(false)
  })
})
