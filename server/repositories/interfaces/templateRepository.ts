import type { TemplateRoute } from '../../types/domain'

export interface TemplateRepository {
  create(template: TemplateRoute): TemplateRoute
  getById(id: string): TemplateRoute | null
  list(): TemplateRoute[]
  update(id: string, partial: Partial<TemplateRoute>): TemplateRoute
  delete(id: string): boolean
}
