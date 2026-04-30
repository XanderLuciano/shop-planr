import type { N8nAutomationRepository } from '../repositories/interfaces/n8nAutomationRepository'
import type { UserRepository } from '../repositories/interfaces/userRepository'
import type { N8nAutomation, N8nWorkflowDefinition, WebhookEventType } from '../types/domain'
import { generateId } from '../utils/idGenerator'
import { NotFoundError, ValidationError } from '../utils/errors'
import { requireAdmin } from '../utils/auth'

export interface N8nAutomationService {
  list(): N8nAutomation[]
  getById(id: string): N8nAutomation
  create(input: {
    name: string
    description?: string
    eventTypes: WebhookEventType[]
    workflowJson: N8nWorkflowDefinition
    enabled?: boolean
  }, userId: string): N8nAutomation
  update(id: string, updates: {
    name?: string
    description?: string
    eventTypes?: WebhookEventType[]
    workflowJson?: N8nWorkflowDefinition
    enabled?: boolean
  }, userId: string): N8nAutomation
  delete(id: string, userId: string): void
  deploy(id: string, userId: string): Promise<N8nAutomation>
  getN8nStatus(): Promise<{ connected: boolean, baseUrl: string, error?: string }>
}

interface Deps {
  n8nAutomations: N8nAutomationRepository
  users: UserRepository
}

export function createN8nAutomationService(deps: Deps): N8nAutomationService {
  const { n8nAutomations } = deps

  return {
    list(): N8nAutomation[] {
      return n8nAutomations.list()
    },

    getById(id: string): N8nAutomation {
      const automation = n8nAutomations.getById(id)
      if (!automation) throw new NotFoundError('N8nAutomation', id)
      return automation
    },

    create(input, userId) {
      requireAdmin(deps.users, userId, 'create automations')

      const now = new Date().toISOString()
      const automation: N8nAutomation = {
        id: generateId('auto'),
        name: input.name,
        description: input.description ?? '',
        eventTypes: input.eventTypes,
        workflowJson: input.workflowJson,
        enabled: input.enabled ?? false,
        n8nWorkflowId: null,
        createdAt: now,
        updatedAt: now,
      }

      return n8nAutomations.create(automation)
    },

    update(id, updates, userId) {
      requireAdmin(deps.users, userId, 'update automations')

      const existing = n8nAutomations.getById(id)
      if (!existing) throw new NotFoundError('N8nAutomation', id)

      return n8nAutomations.update(id, updates)
    },

    delete(id, userId) {
      requireAdmin(deps.users, userId, 'delete automations')

      const existing = n8nAutomations.getById(id)
      if (!existing) throw new NotFoundError('N8nAutomation', id)

      n8nAutomations.delete(id)
    },

    async deploy(id, userId) {
      requireAdmin(deps.users, userId, 'deploy automations')

      const automation = n8nAutomations.getById(id)
      if (!automation) throw new NotFoundError('N8nAutomation', id)

      const config = useRuntimeConfig()
      const baseUrl = config.n8nBaseUrl
      const apiKey = config.n8nApiKey

      if (!baseUrl || !apiKey) {
        throw new ValidationError('n8n is not configured. Set N8N_BASE_URL and N8N_API_KEY in your environment.')
      }

      // The editor saves nodes WITHOUT the trigger, but preserves any connections
      // FROM "Shop Planr Event" that the user drew on the canvas. At deploy time
      // we prepend the actual n8n Webhook node and use those stored connections
      // (falling back to auto-wiring into the first node if the user never
      // connected the trigger explicitly).
      const TRIGGER_NAME = 'Shop Planr Event'

      const webhookNode = {
        id: 'webhook-trigger',
        name: TRIGGER_NAME,
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        position: [0, 0] as [number, number],
        parameters: {
          httpMethod: 'POST',
          path: `shop-planr/${automation.id}`,
          responseMode: 'lastNode',
        },
        webhookId: automation.id,
      }

      const storedConnections = (automation.workflowJson.connections ?? {}) as Record<string, unknown>
      const hasTriggerConnection = TRIGGER_NAME in storedConnections

      let finalConnections: Record<string, unknown> = { ...storedConnections }
      if (!hasTriggerConnection && automation.workflowJson.nodes.length > 0) {
        const firstNodeName = automation.workflowJson.nodes[0]!.name
        finalConnections = {
          [TRIGGER_NAME]: {
            main: [[{ node: firstNodeName, type: 'main', index: 0 }]],
          },
          ...storedConnections,
        }
      }

      const workflowPayload = {
        name: `Shop Planr: ${automation.name}`,
        nodes: [webhookNode, ...automation.workflowJson.nodes],
        connections: finalConnections,
        active: automation.enabled,
        settings: automation.workflowJson.settings ?? {},
      }

      try {
        let n8nWorkflowId = automation.n8nWorkflowId

        if (n8nWorkflowId) {
          // Update existing workflow
          await $fetch(`${baseUrl}/api/v1/workflows/${n8nWorkflowId}`, {
            method: 'PATCH',
            headers: { 'X-N8N-API-KEY': apiKey },
            body: workflowPayload,
          })
        } else {
          // Create new workflow
          const result = await $fetch<{ id: string }>(`${baseUrl}/api/v1/workflows`, {
            method: 'POST',
            headers: { 'X-N8N-API-KEY': apiKey },
            body: workflowPayload,
          })
          n8nWorkflowId = result.id
        }

        // Activate the workflow
        if (automation.enabled) {
          await $fetch(`${baseUrl}/api/v1/workflows/${n8nWorkflowId}/activate`, {
            method: 'POST',
            headers: { 'X-N8N-API-KEY': apiKey },
          })
        }

        return n8nAutomations.update(automation.id, { n8nWorkflowId })
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error deploying to n8n'
        throw new ValidationError(`Failed to deploy to n8n: ${message}`)
      }
    },

    async getN8nStatus() {
      const config = useRuntimeConfig()
      const baseUrl = config.n8nBaseUrl || ''
      const apiKey = config.n8nApiKey || ''

      if (!baseUrl || !apiKey) {
        return { connected: false, baseUrl, error: 'n8n not configured (N8N_BASE_URL / N8N_API_KEY missing)' }
      }

      try {
        await $fetch(`${baseUrl}/api/v1/workflows`, {
          method: 'GET',
          headers: { 'X-N8N-API-KEY': apiKey },
          query: { limit: 1 },
        })
        return { connected: true, baseUrl }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Connection failed'
        return { connected: false, baseUrl, error: message }
      }
    },
  }
}
