import type { N8nAutomation } from '../../types/domain'

export interface N8nAutomationRepository {
  create(automation: N8nAutomation): N8nAutomation
  getById(id: string): N8nAutomation | undefined
  list(): N8nAutomation[]
  update(id: string, updates: Partial<Pick<N8nAutomation, 'name' | 'description' | 'eventTypes' | 'workflowJson' | 'enabled' | 'n8nWorkflowId'>>): N8nAutomation
  delete(id: string): void
  listByEventType(eventType: string): N8nAutomation[]
  listEnabled(): N8nAutomation[]
}
