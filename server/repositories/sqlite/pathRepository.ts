import type Database from 'better-sqlite3'
import type { Path, ProcessStep } from '../../types/domain'
import type { PathRepository } from '../interfaces/pathRepository'
import { NotFoundError, ValidationError } from '../../utils/errors'

interface PathRow {
  id: string
  job_id: string
  name: string
  goal_quantity: number
  advancement_mode: string
  created_at: string
  updated_at: string
}

interface StepRow {
  id: string
  path_id: string
  name: string
  step_order: number
  location: string | null
  assigned_to: string | null
  optional: number
  dependency_type: string
}

function stepRowToDomain(row: StepRow): ProcessStep {
  return {
    id: row.id,
    name: row.name,
    order: row.step_order,
    location: row.location ?? undefined,
    assignedTo: row.assigned_to ?? undefined,
    optional: row.optional === 1,
    dependencyType: (row.dependency_type as ProcessStep['dependencyType']) ?? 'preferred',
  }
}

export class SQLitePathRepository implements PathRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(path: Path): Path {
    const insertPath = this.db.prepare(`
      INSERT INTO paths (id, job_id, name, goal_quantity, advancement_mode, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const insertStep = this.db.prepare(`
      INSERT INTO process_steps (id, path_id, name, step_order, location, optional, dependency_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    this.db.transaction(() => {
      insertPath.run(path.id, path.jobId, path.name, path.goalQuantity, path.advancementMode ?? 'strict', path.createdAt, path.updatedAt)
      for (const step of path.steps) {
        insertStep.run(step.id, path.id, step.name, step.order, step.location ?? null, step.optional ? 1 : 0, step.dependencyType ?? 'preferred')
      }
    })()

    return path
  }

  getById(id: string): Path | null {
    const row = this.db.prepare('SELECT * FROM paths WHERE id = ?').get(id) as PathRow | undefined
    if (!row) return null

    const stepRows = this.db.prepare(
      'SELECT * FROM process_steps WHERE path_id = ? ORDER BY step_order ASC'
    ).all(id) as StepRow[]

    return {
      id: row.id,
      jobId: row.job_id,
      name: row.name,
      goalQuantity: row.goal_quantity,
      steps: stepRows.map(stepRowToDomain),
      advancementMode: (row.advancement_mode as Path['advancementMode']) ?? 'strict',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  listByJobId(jobId: string): Path[] {
    const rows = this.db.prepare(
      'SELECT * FROM paths WHERE job_id = ? ORDER BY created_at ASC'
    ).all(jobId) as PathRow[]

    return rows.map((row) => {
      const stepRows = this.db.prepare(
        'SELECT * FROM process_steps WHERE path_id = ? ORDER BY step_order ASC'
      ).all(row.id) as StepRow[]

      return {
        id: row.id,
        jobId: row.job_id,
        name: row.name,
        goalQuantity: row.goal_quantity,
        steps: stepRows.map(stepRowToDomain),
        advancementMode: (row.advancement_mode as Path['advancementMode']) ?? 'strict',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    })
  }

  update(id: string, partial: Partial<Path>): Path {
    const existing = this.getById(id)
    if (!existing) throw new NotFoundError('Path', id)

    const updated: Path = {
      ...existing,
      ...partial,
      id,
      updatedAt: partial.updatedAt ?? new Date().toISOString()
    }

    const updatePathStmt = this.db.prepare(`
      UPDATE paths SET name = ?, goal_quantity = ?, advancement_mode = ?, updated_at = ? WHERE id = ?
    `)
    const setTempOrderStmt = this.db.prepare(
      'UPDATE process_steps SET step_order = ? WHERE id = ?'
    )
    const updateStepStmt = this.db.prepare(`
      UPDATE process_steps SET name = ?, step_order = ?, location = ?, optional = ?, dependency_type = ? WHERE id = ?
    `)
    const insertStepStmt = this.db.prepare(`
      INSERT INTO process_steps (id, path_id, name, step_order, location, optional, dependency_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const deleteStepStmt = this.db.prepare(
      'DELETE FROM process_steps WHERE id = ?'
    )

    this.db.transaction(() => {
      // Phase 0: Update path-level fields
      updatePathStmt.run(updated.name, updated.goalQuantity, updated.advancementMode, updated.updatedAt, id)

      if (partial.steps) {
        // Phase 1: Identify steps to update, insert, and delete
        const existingIds = new Set(existing.steps.map(s => s.id))
        const newIds = new Set(updated.steps.map(s => s.id))
        const stepsToUpdate = updated.steps.filter(s => existingIds.has(s.id))
        const stepsToInsert = updated.steps.filter(s => !existingIds.has(s.id))
        const idsToDelete = [...existingIds].filter(stepId => !newIds.has(stepId))

        // Phase 2: Guard — check FK dependents before any deletes
        for (const stepId of idsToDelete) {
          if (this.hasStepDependents(stepId)) {
            throw new ValidationError(
              'Cannot remove step because it has associated data (certificates, notes, or part statuses). Remove the associated data first, or keep the step.'
            )
          }
        }

        // Phase 3: Set temporary negative step_order to avoid UNIQUE(path_id, step_order) conflicts
        for (const step of stepsToUpdate) {
          setTempOrderStmt.run(-(step.order + 1), step.id)
        }

        // Phase 4: Delete removed steps first to free up step_order slots (already verified no FK dependents)
        for (const stepId of idsToDelete) {
          deleteStepStmt.run(stepId)
        }

        // Phase 5: Update existing steps in place with new field values and correct order
        for (const step of stepsToUpdate) {
          updateStepStmt.run(step.name, step.order, step.location ?? null, step.optional ? 1 : 0, step.dependencyType ?? 'preferred', step.id)
        }

        // Phase 6: Insert new steps
        for (const step of stepsToInsert) {
          insertStepStmt.run(step.id, id, step.name, step.order, step.location ?? null, step.optional ? 1 : 0, step.dependencyType ?? 'preferred')
        }
      }
    })()

    return updated
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM paths WHERE id = ?').run(id)
    return result.changes > 0
  }

  getStepById(stepId: string): ProcessStep | null {
    const row = this.db.prepare('SELECT * FROM process_steps WHERE id = ?').get(stepId) as StepRow | undefined
    return row ? stepRowToDomain(row) : null
  }

  updateStepAssignment(stepId: string, userId: string | null): ProcessStep {
    this.db.prepare('UPDATE process_steps SET assigned_to = ? WHERE id = ?').run(userId, stepId)
    const row = this.db.prepare('SELECT * FROM process_steps WHERE id = ?').get(stepId) as StepRow | undefined
    if (!row) throw new NotFoundError('ProcessStep', stepId)
    return stepRowToDomain(row)
  }

  updateStep(stepId: string, partial: Partial<ProcessStep>): ProcessStep {
    const row = this.db.prepare('SELECT * FROM process_steps WHERE id = ?').get(stepId) as StepRow | undefined
    if (!row) throw new NotFoundError('ProcessStep', stepId)

    const existing = stepRowToDomain(row)
    const updated: ProcessStep = { ...existing, ...partial, id: stepId }

    this.db.prepare(`
      UPDATE process_steps SET name = ?, step_order = ?, location = ?, assigned_to = ?, optional = ?, dependency_type = ? WHERE id = ?
    `).run(
      updated.name, updated.order, updated.location ?? null, updated.assignedTo ?? null,
      updated.optional ? 1 : 0, updated.dependencyType ?? 'preferred', stepId,
    )
    return updated
  }

  hasStepDependents(stepId: string): boolean {
    const tables = [
      'cert_attachments',
      'step_notes',
      'part_step_statuses',
      'part_step_overrides',
    ]
    for (const table of tables) {
      const row = this.db.prepare(
        `SELECT 1 FROM ${table} WHERE step_id = ? LIMIT 1`
      ).get(stepId)
      if (row) return true
    }
    return false
  }
}
