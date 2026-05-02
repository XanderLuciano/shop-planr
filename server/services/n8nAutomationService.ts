import type { N8nAutomationRepository } from '../repositories/interfaces/n8nAutomationRepository'
import type { WebhookRegistrationRepository } from '../repositories/interfaces/webhookRegistrationRepository'
import type { WebhookDeliveryRepository } from '../repositories/interfaces/webhookDeliveryRepository'
import type { UserRepository } from '../repositories/interfaces/userRepository'
import type { SettingsService } from './settingsService'
import type { N8nAutomation, N8nWorkflowDefinition, WebhookEventType, WebhookRegistration } from '../types/domain'
import { generateId } from '../utils/idGenerator'
import { NotFoundError, ValidationError } from '../utils/errors'
import { requireAdmin } from '../utils/auth'
import { extractN8nError } from '../utils/n8nErrors'

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
  webhookRegistrations: WebhookRegistrationRepository
  webhookDeliveries: WebhookDeliveryRepository
  users: UserRepository
  /**
   * Source of truth for n8n baseUrl / apiKey. Values flow from the
   * `app_settings` row (editable in Settings → n8n) with env var fallback
   * for bootstrap-by-env-only deployments.
   */
  settings: SettingsService
  db: { transaction: <T>(fn: () => T) => () => T }
}

/**
 * Name prefix used for registrations paired with an n8n automation.
 * Visible in the Registrations tab so admins can see that these rows are
 * owned by an automation (editing them there is allowed but will be
 * overwritten on the next deploy/update of the automation).
 */
const AUTO_REGISTRATION_PREFIX = 'n8n: '

/**
 * Build the n8n webhook URL that events should be POSTed to.
 * Matches the `path` on the Webhook trigger node set in `deploy()`.
 */
function buildN8nWebhookUrl(baseUrl: string, automationId: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  return `${trimmed}/webhook/shop-planr/${automationId}`
}

function registrationNameFor(automationName: string): string {
  return `${AUTO_REGISTRATION_PREFIX}${automationName}`
}

export function createN8nAutomationService(deps: Deps): N8nAutomationService {
  const { n8nAutomations, webhookRegistrations, webhookDeliveries, settings, db } = deps

  /**
   * Create or update the registration paired with this automation so events
   * are routed to the n8n webhook trigger. Called from `deploy()` after the
   * n8n workflow itself has been successfully created/updated.
   */
  function upsertLinkedRegistration(automation: N8nAutomation, n8nBaseUrl: string): WebhookRegistration {
    const url = buildN8nWebhookUrl(n8nBaseUrl, automation.id)
    const name = registrationNameFor(automation.name)

    // Try the existing link first. If it was manually deleted, the FK
    // SET NULL in the migration will have cleared the column, so we fall
    // through to creating a fresh one.
    if (automation.linkedRegistrationId) {
      const existing = webhookRegistrations.getById(automation.linkedRegistrationId)
      if (existing) {
        return webhookRegistrations.update(existing.id, {
          name,
          url,
          eventTypes: automation.eventTypes,
        })
      }
    }

    const now = new Date().toISOString()
    const registration: WebhookRegistration = {
      id: generateId('whr'),
      name,
      url,
      eventTypes: automation.eventTypes,
      createdAt: now,
      updatedAt: now,
    }
    return webhookRegistrations.create(registration)
  }

  /**
   * Sync name + eventTypes into the linked registration. Called from
   * `update()` so the registration stays in lockstep with the automation
   * without requiring a redeploy. URL is not touched here because it's
   * derived from the n8n base URL + automation id — neither changes on
   * a metadata edit.
   */
  function syncLinkedRegistration(
    automation: N8nAutomation,
    changes: { name?: string, eventTypes?: WebhookEventType[] },
  ): void {
    if (!automation.linkedRegistrationId) return
    const existing = webhookRegistrations.getById(automation.linkedRegistrationId)
    if (!existing) return

    const patch: Partial<Pick<WebhookRegistration, 'name' | 'eventTypes'>> = {}
    if (changes.name !== undefined) patch.name = registrationNameFor(changes.name)
    if (changes.eventTypes !== undefined) patch.eventTypes = changes.eventTypes

    if (Object.keys(patch).length > 0) {
      webhookRegistrations.update(existing.id, patch)
    }
  }

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
        linkedRegistrationId: null,
        createdAt: now,
        updatedAt: now,
      }

      return n8nAutomations.create(automation)
    },

    update(id, updates, userId) {
      requireAdmin(deps.users, userId, 'update automations')

      const existing = n8nAutomations.getById(id)
      if (!existing) throw new NotFoundError('N8nAutomation', id)

      // Update the automation and mirror name/eventTypes into the linked
      // registration atomically — otherwise a crash between the two writes
      // would leave the registration out of sync.
      return db.transaction(() => {
        const updated = n8nAutomations.update(id, updates)
        syncLinkedRegistration(updated, {
          name: updates.name,
          eventTypes: updates.eventTypes,
        })
        return updated
      })()
    },

    delete(id, userId) {
      requireAdmin(deps.users, userId, 'delete automations')

      const existing = n8nAutomations.getById(id)
      if (!existing) throw new NotFoundError('N8nAutomation', id)

      // Clean up the paired registration and any queued deliveries for it
      // so future events don't target a URL that's about to disappear from
      // the n8n side too.
      db.transaction(() => {
        if (existing.linkedRegistrationId) {
          const linked = webhookRegistrations.getById(existing.linkedRegistrationId)
          if (linked) {
            webhookDeliveries.cancelQueuedByRegistrationId(linked.id)
            webhookRegistrations.delete(linked.id)
          }
        }
        n8nAutomations.delete(id)
      })()
    },

    async deploy(id, userId) {
      requireAdmin(deps.users, userId, 'deploy automations')

      const automation = n8nAutomations.getById(id)
      if (!automation) throw new NotFoundError('N8nAutomation', id)

      const conn = settings.getN8nConnection()
      const baseUrl = (conn.baseUrl || '').replace(/\/+$/, '')
      const apiKey = conn.apiKey

      if (!baseUrl || !apiKey || !conn.enabled) {
        throw new ValidationError('n8n is not configured. Add your n8n URL and API key in Settings → n8n.')
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
        position: (automation.workflowJson.settings?._triggerPosition as [number, number]) ?? [0, 0],
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

      // ── Auto-attach n8n credentials ──────────────────────────────────
      // Nodes that require credentials show a "credentials not set" warning
      // in n8n unless we include a `credentials` block in the node JSON.
      //
      // We try two strategies:
      // 1. Query n8n's public API for available credentials and match by type
      // 2. Fall back to setting just the credential type name — n8n will
      //    auto-resolve if there's exactly one credential of that type
      const NODE_CREDENTIAL_TYPES: Record<string, string[]> = {
        'n8n-nodes-base.jira': ['jiraSoftwareServerPatApi', 'jiraSoftwareServerApi', 'jiraSoftwareCloudApi'],
        'n8n-nodes-base.slack': ['slackOAuth2Api', 'slackApi'],
        'n8n-nodes-base.gmail': ['gmailOAuth2'],
        'n8n-nodes-base.discord': ['discordWebhookApi'],
        'n8n-nodes-base.microsoftTeams': ['microsoftTeamsOAuth2Api'],
      }

      // Map of jiraVersion parameter → credential type for the Jira node
      const JIRA_VERSION_CRED: Record<string, string> = {
        serverPat: 'jiraSoftwareServerPatApi',
        server: 'jiraSoftwareServerApi',
        cloud: 'jiraSoftwareCloudApi',
      }

      let credentialsByType: Record<string, { id: string, name: string }> = {}
      try {
        const creds = await $fetch<{ data: Array<{ id: string, name: string, type: string }> }>(
          `${baseUrl}/api/v1/credentials`,
          { method: 'GET', headers: { 'X-N8N-API-KEY': apiKey } },
        )
        for (const c of creds.data ?? []) {
          if (!credentialsByType[c.type]) {
            credentialsByType[c.type] = { id: c.id, name: c.name }
          }
        }
      } catch {
        // Public API not available — fall back to type-only credential hints
        credentialsByType = {}
      }

      // Inject credentials into nodes that need them
      const nodesWithCredentials = [webhookNode, ...automation.workflowJson.nodes].map((node) => {
        const candidateTypes = NODE_CREDENTIAL_TYPES[node.type]
        if (!candidateTypes) return node

        // For Jira nodes, use the jiraVersion parameter to pick the right credential type
        if (node.type === 'n8n-nodes-base.jira') {
          const jiraVersion = String((node.parameters as Record<string, unknown>).jiraVersion ?? 'serverPat')
          const credType = JIRA_VERSION_CRED[jiraVersion] ?? 'jiraSoftwareServerPatApi'
          const cred = credentialsByType[credType]
          if (cred) {
            return { ...node, credentials: { [credType]: { id: cred.id, name: cred.name } } }
          }
          // No API match — set type-only so n8n auto-resolves
          return { ...node, credentials: { [credType]: {} } }
        }

        // Generic: try API lookup first, then type-only fallback
        for (const credType of candidateTypes) {
          const cred = credentialsByType[credType]
          if (cred) {
            return { ...node, credentials: { [credType]: { id: cred.id, name: cred.name } } }
          }
        }
        // Fallback: set the first candidate type with empty object
        return { ...node, credentials: { [candidateTypes[0]!]: {} } }
      })

      // n8n's REST API rejects unknown/extra fields (e.g. `active`) on
      // POST /workflows. We handle activation via the dedicated /activate
      // endpoint below, so the create/update payload only carries the
      // structural fields the API accepts.
      // Strip editor-only keys from settings before sending to n8n
      const { _triggerPosition, ...n8nSettings } = (automation.workflowJson.settings ?? {}) as Record<string, unknown>

      const workflowPayload = {
        name: `Shop Planr: ${automation.name}`,
        nodes: nodesWithCredentials,
        connections: finalConnections,
        settings: n8nSettings,
      }

      let n8nWorkflowId = automation.n8nWorkflowId

      // Step 1: Create or update the workflow on n8n
      try {
        if (n8nWorkflowId) {
          await $fetch(`${baseUrl}/api/v1/workflows/${n8nWorkflowId}`, {
            method: 'PUT',
            headers: { 'X-N8N-API-KEY': apiKey },
            body: workflowPayload,
          })
        } else {
          const result = await $fetch<{ id: string }>(`${baseUrl}/api/v1/workflows`, {
            method: 'POST',
            headers: { 'X-N8N-API-KEY': apiKey },
            body: workflowPayload,
          })
          n8nWorkflowId = result.id
        }
      } catch (e: unknown) {
        throw new ValidationError(`Failed to deploy to n8n: ${extractN8nError(e)}`)
      }

      // Step 2: Persist the workflow ID immediately so we don't orphan it
      // if activation fails below.
      db.transaction(() => {
        n8nAutomations.update(automation.id, { n8nWorkflowId })
      })()

      // Step 3: Sync activation state with n8n
      try {
        if (automation.enabled) {
          await $fetch(`${baseUrl}/api/v1/workflows/${n8nWorkflowId}/activate`, {
            method: 'POST',
            headers: { 'X-N8N-API-KEY': apiKey },
          })
        } else {
          await $fetch(`${baseUrl}/api/v1/workflows/${n8nWorkflowId}/deactivate`, {
            method: 'POST',
            headers: { 'X-N8N-API-KEY': apiKey },
          })
        }
      } catch (e: unknown) {
        throw new ValidationError(`Workflow deployed but activation sync failed: ${extractN8nError(e)}`)
      }

      // Step 4: Link a WebhookRegistration so events from emitWebhookEvent()
      // reach n8n through the existing delivery pipeline.
      return db.transaction(() => {
        const linked = upsertLinkedRegistration(automation, baseUrl)
        return n8nAutomations.update(automation.id, {
          n8nWorkflowId,
          linkedRegistrationId: linked.id,
        })
      })()
    },

    async getN8nStatus() {
      const conn = settings.getN8nConnection()
      const baseUrl = (conn.baseUrl || '').replace(/\/+$/, '')
      const apiKey = conn.apiKey || ''

      if (!baseUrl || !apiKey) {
        return { connected: false, baseUrl }
      }

      if (!conn.enabled) {
        return { connected: false, baseUrl, error: 'n8n integration is disabled. Enable it in Settings → n8n.' }
      }

      try {
        await $fetch(`${baseUrl}/api/v1/workflows`, {
          method: 'GET',
          headers: { 'X-N8N-API-KEY': apiKey },
          query: { limit: 1 },
        })
        return { connected: true, baseUrl }
      } catch (e: unknown) {
        return { connected: false, baseUrl, error: extractN8nError(e) }
      }
    },
  }
}
