import type Database from 'better-sqlite3'
import type { TemplateRoute, TemplateStep } from '../../types/domain'
import type { TemplateRepository } from '../interfaces/templateRepository'
import { NotFoundError } from '../../utils/errors'

interface TemplateRow {
  id: string
  name: string
  created_at: string
  updated_at: string
}

interface TemplateStepRow {
  id: number
  template_id: string
  name: string
  step_order: number
  location: string | null
  optional: number
  dependency_type: string
}

function stepRowToDomain(row: TemplateStepRow): TemplateStep {
  return {
    name: row.name,
    order: row.step_order,
    location: row.location ?? undefined,
    optional: row.optional === 1,
    dependencyType: (row.dependency_type as TemplateStep['dependencyType']) ?? 'preferred',
  }
}

function rowToDomain(row: TemplateRow, steps: TemplateStep[]): TemplateRoute {
  return {
    id: row.id,
    name: row.name,
    steps,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SQLiteTemplateRepository implements TemplateRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(template: TemplateRoute): TemplateRoute {
    const insertTemplate = this.db.prepare(`
      INSERT INTO templates (id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `)
    const insertStep = this.db.prepare(`
      INSERT INTO template_steps (template_id, name, step_order, location, optional, dependency_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    this.db.transaction(() => {
      insertTemplate.run(template.id, template.name, template.createdAt, template.updatedAt)
      for (const step of template.steps) {
        insertStep.run(template.id, step.name, step.order, step.location ?? null, step.optional ? 1 : 0, step.dependencyType ?? 'preferred')
      }
    })()

    return template
  }

  getById(id: string): TemplateRoute | null {
    const row = this.db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as TemplateRow | undefined
    if (!row) return null

    const stepRows = this.db.prepare(
      'SELECT * FROM template_steps WHERE template_id = ? ORDER BY step_order ASC',
    ).all(id) as TemplateStepRow[]

    return rowToDomain(row, stepRows.map(stepRowToDomain))
  }

  list(): TemplateRoute[] {
    const rows = this.db.prepare('SELECT * FROM templates ORDER BY created_at DESC').all() as TemplateRow[]
    return rows.map((row) => {
      const stepRows = this.db.prepare(
        'SELECT * FROM template_steps WHERE template_id = ? ORDER BY step_order ASC',
      ).all(row.id) as TemplateStepRow[]
      return rowToDomain(row, stepRows.map(stepRowToDomain))
    })
  }

  update(id: string, partial: Partial<TemplateRoute>): TemplateRoute {
    const existing = this.getById(id)
    if (!existing) throw new NotFoundError('Template', id)

    const updated: TemplateRoute = {
      ...existing,
      ...partial,
      id,
      updatedAt: partial.updatedAt ?? new Date().toISOString(),
    }

    const updateTemplate = this.db.prepare('UPDATE templates SET name = ?, updated_at = ? WHERE id = ?')
    const deleteSteps = this.db.prepare('DELETE FROM template_steps WHERE template_id = ?')
    const insertStep = this.db.prepare(`
      INSERT INTO template_steps (template_id, name, step_order, location, optional, dependency_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    this.db.transaction(() => {
      updateTemplate.run(updated.name, updated.updatedAt, id)
      if (partial.steps) {
        deleteSteps.run(id)
        for (const step of updated.steps) {
          insertStep.run(id, step.name, step.order, step.location ?? null, step.optional ? 1 : 0, step.dependencyType ?? 'preferred')
        }
      }
    })()

    return updated
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM templates WHERE id = ?').run(id)
    return result.changes > 0
  }
}
