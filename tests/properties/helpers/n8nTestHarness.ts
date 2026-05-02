/**
 * Shared in-memory n8n automation repository and service factory for tests.
 *
 * Mirrors the webhookTestHarness pattern: Map-backed repos with a
 * passthrough transaction shim so tests run without SQLite.
 */
import type { N8nAutomationRepository } from '~/server/repositories/interfaces/n8nAutomationRepository'
import type { N8nAutomation, WebhookEventType, N8nWorkflowDefinition } from '~/server/types/domain'
import type { SettingsService } from '~/server/services/settingsService'
import { createN8nAutomationService } from '~/server/services/n8nAutomationService'
import {
  createInMemoryRegistrationRepo,
  createInMemoryDeliveryRepo,
  createInMemoryUserRepo,
  passthroughDb,
  WEBHOOK_ADMIN_USER,
  WEBHOOK_REGULAR_USER,
} from './webhookTestHarness'

export { WEBHOOK_ADMIN_USER, WEBHOOK_REGULAR_USER, passthroughDb }

// ---- In-memory N8nAutomation repository ----

export function createInMemoryN8nAutomationRepo(): N8nAutomationRepository {
  const store = new Map<string, N8nAutomation>()
  return {
    create(automation: N8nAutomation) {
      store.set(automation.id, automation)
      return automation
    },
    getById(id: string) {
      return store.get(id)
    },
    list() {
      return [...store.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    update(id: string, updates: Partial<Pick<N8nAutomation, 'name' | 'description' | 'eventTypes' | 'workflowJson' | 'enabled' | 'n8nWorkflowId' | 'linkedRegistrationId'>>) {
      const existing = store.get(id)!
      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      }
      store.set(id, updated)
      return updated
    },
    delete(id: string) {
      store.delete(id)
    },
    listByEventType(eventType: string) {
      return [...store.values()].filter(a => a.eventTypes.includes(eventType as WebhookEventType))
    },
    listEnabled() {
      return [...store.values()].filter(a => a.enabled)
    },
  }
}

// ---- Mock settings service ----

export interface MockN8nConnection {
  baseUrl: string
  apiKey: string
  enabled: boolean
}

export function createMockSettingsService(connection: MockN8nConnection = {
  baseUrl: 'http://localhost:5678',
  apiKey: 'test-api-key-123',
  enabled: true,
}): SettingsService {
  return {
    getN8nConnection: () => connection,
    // Stub remaining methods — not used by n8nAutomationService
    getSettings: () => ({}) as any,
    updateSettings: () => ({}) as any,
    getJiraConnection: () => ({}) as any,
    getFieldMappings: () => ({}) as any,
    getPageToggles: () => ({}) as any,
    testN8nConnection: async () => ({ connected: true }),
  } as unknown as SettingsService
}

// ---- Service factory ----

export function createN8nTestService(options?: {
  n8nConnection?: MockN8nConnection
}) {
  const n8nAutomationRepo = createInMemoryN8nAutomationRepo()
  const registrationRepo = createInMemoryRegistrationRepo()
  const deliveryRepo = createInMemoryDeliveryRepo()
  const userRepo = createInMemoryUserRepo([WEBHOOK_ADMIN_USER, WEBHOOK_REGULAR_USER])
  const settingsService = createMockSettingsService(options?.n8nConnection)

  const service = createN8nAutomationService({
    n8nAutomations: n8nAutomationRepo,
    webhookRegistrations: registrationRepo,
    webhookDeliveries: deliveryRepo,
    users: userRepo,
    settings: settingsService,
    db: passthroughDb,
  })

  return {
    service,
    n8nAutomationRepo,
    registrationRepo,
    deliveryRepo,
    userRepo,
    settingsService,
  }
}

// ---- Fixture helpers ----

/** Minimal valid workflow definition for tests */
export function minimalWorkflow(nodes: N8nWorkflowDefinition['nodes'] = []): N8nWorkflowDefinition {
  return {
    nodes,
    connections: {},
  }
}

/** Create a simple single-node workflow */
export function singleNodeWorkflow(nodeType = 'n8n-nodes-base.httpRequest'): N8nWorkflowDefinition {
  return {
    nodes: [
      {
        id: 'node-1',
        name: 'HTTP Request',
        type: nodeType,
        typeVersion: 4,
        position: [200, 200],
        parameters: { method: 'POST', url: 'https://example.com/hook' },
      },
    ],
    connections: {
      'Shop Planr Event': {
        main: [[{ node: 'HTTP Request', type: 'main', index: 0 }]],
      },
    },
  }
}
