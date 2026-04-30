import type { SettingsRepository } from '../repositories/interfaces/settingsRepository'
import type { UserRepository } from '../repositories/interfaces/userRepository'
import type { AppSettings, JiraConnectionSettings, JiraFieldMapping, N8nConnectionSettings, PageToggles } from '../types/domain'
import { DEFAULT_PAGE_TOGGLES, mergePageToggles } from '../utils/pageToggles'
import { requireAdmin } from '../utils/auth'

export interface SettingsRuntimeConfig {
  jiraBaseUrl: string
  jiraProjectKey: string
  jiraUsername: string
  jiraApiToken: string
  n8nBaseUrl: string
  n8nApiKey: string
}

const DEFAULT_FIELD_MAPPINGS: JiraFieldMapping[] = [
  { id: 'fm_1', jiraFieldId: 'customfield_10908', label: 'Part Number / Rev', shopErpField: 'partNumber', isDefault: true },
  { id: 'fm_2', jiraFieldId: 'customfield_10900', label: 'Quantity', shopErpField: 'goalQuantity', isDefault: true },
  { id: 'fm_3', jiraFieldId: 'customfield_10014', label: 'Epic Link', shopErpField: 'epicLink', isDefault: true },
  { id: 'fm_4', jiraFieldId: 'priority', label: 'Priority', shopErpField: 'priority', isDefault: true },
  { id: 'fm_5', jiraFieldId: 'labels', label: 'Labels', shopErpField: 'labels', isDefault: true },
]

function buildDefaultJiraConnection(runtimeConfig: SettingsRuntimeConfig): JiraConnectionSettings {
  return {
    baseUrl: runtimeConfig.jiraBaseUrl || '',
    projectKey: runtimeConfig.jiraProjectKey || 'PI',
    username: runtimeConfig.jiraUsername || '',
    apiToken: runtimeConfig.jiraApiToken || '',
    enabled: false,
    pushEnabled: false,
  }
}

/**
 * Build the default n8n connection by falling back to `N8N_BASE_URL` /
 * `N8N_API_KEY` env vars. These serve as bootstrap defaults so automated
 * deployments can pre-populate the integration without a DB seed. Once the
 * admin saves a connection through the UI, those saved values win over
 * env vars on subsequent reads.
 */
function buildDefaultN8nConnection(runtimeConfig: SettingsRuntimeConfig): N8nConnectionSettings {
  const hasEnvConfig = Boolean(runtimeConfig.n8nBaseUrl && runtimeConfig.n8nApiKey)
  return {
    baseUrl: (runtimeConfig.n8nBaseUrl || '').replace(/\/+$/, ''),
    apiKey: runtimeConfig.n8nApiKey || '',
    // If both env vars are populated, treat the integration as enabled by
    // default. Admins can disable it from the UI afterward.
    enabled: hasEnvConfig,
  }
}

function buildDefaultSettings(runtimeConfig: SettingsRuntimeConfig): AppSettings {
  return {
    id: 'app_settings',
    jiraConnection: buildDefaultJiraConnection(runtimeConfig),
    jiraFieldMappings: [...DEFAULT_FIELD_MAPPINGS],
    pageToggles: { ...DEFAULT_PAGE_TOGGLES },
    n8nConnection: buildDefaultN8nConnection(runtimeConfig),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Resolve the effective n8n connection from stored settings, tolerating
 * legacy rows that were written before the column existed (n8nConnection
 * missing or empty-string fields). When the stored connection is blank,
 * fall back to runtime env vars so existing deployments keep working.
 */
function resolveStoredN8nConnection(
  stored: AppSettings | null,
  runtimeConfig: SettingsRuntimeConfig,
): N8nConnectionSettings {
  const storedConn = stored?.n8nConnection
  if (!storedConn) return buildDefaultN8nConnection(runtimeConfig)

  // If the stored row is blank (never configured through the UI), treat
  // env vars as the source of truth so fresh deployments that only set
  // N8N_BASE_URL / N8N_API_KEY still work.
  const hasStoredConfig = Boolean(storedConn.baseUrl && storedConn.apiKey)
  if (hasStoredConfig) return storedConn
  return buildDefaultN8nConnection(runtimeConfig)
}

export function createSettingsService(
  repos: { settings: SettingsRepository, users?: UserRepository },
  runtimeConfig: SettingsRuntimeConfig,
) {
  return {
    getSettings(): AppSettings {
      const existing = repos.settings.get()
      if (existing) {
        // Backfill n8nConnection from env if the stored row has never been
        // populated through the UI. This keeps the response shape stable.
        return {
          ...existing,
          n8nConnection: resolveStoredN8nConnection(existing, runtimeConfig),
        }
      }
      return buildDefaultSettings(runtimeConfig)
    },

    updateSettings(input: {
      jiraConnection?: Partial<JiraConnectionSettings>
      jiraFieldMappings?: JiraFieldMapping[]
      pageToggles?: Partial<PageToggles>
      n8nConnection?: Partial<N8nConnectionSettings>
    }, userId?: string): AppSettings {
      // Admin-gate mutations that touch integration credentials. Non-admin
      // fields (pageToggles, jiraFieldMappings) are allowed through — the
      // existing API route has no such restriction today and we don't want
      // to break that.
      const needsAdmin = Boolean(input.jiraConnection || input.n8nConnection)
      if (needsAdmin && userId) {
        requireAdmin(repos.users, userId, 'update integration settings')
      }

      const current = repos.settings.get() ?? buildDefaultSettings(runtimeConfig)

      const updated: AppSettings = {
        ...current,
        n8nConnection: resolveStoredN8nConnection(current, runtimeConfig),
        updatedAt: new Date().toISOString(),
      }

      if (input.jiraConnection) {
        updated.jiraConnection = { ...current.jiraConnection, ...input.jiraConnection }
      }

      if (input.jiraFieldMappings) {
        updated.jiraFieldMappings = input.jiraFieldMappings
      }

      if (input.pageToggles) {
        updated.pageToggles = mergePageToggles(current.pageToggles, input.pageToggles)
      }

      if (input.n8nConnection) {
        updated.n8nConnection = { ...updated.n8nConnection, ...input.n8nConnection }
        // Normalise baseUrl so downstream code never has to worry about
        // trailing slashes producing double-slash API paths.
        if (updated.n8nConnection.baseUrl) {
          updated.n8nConnection.baseUrl = updated.n8nConnection.baseUrl.replace(/\/+$/, '')
        }
      }

      return repos.settings.upsert(updated)
    },

    getJiraConnection(): JiraConnectionSettings {
      const settings = repos.settings.get()
      if (settings) {
        return settings.jiraConnection
      }
      return buildDefaultJiraConnection(runtimeConfig)
    },

    getFieldMappings(): JiraFieldMapping[] {
      const settings = repos.settings.get()
      if (settings) {
        return settings.jiraFieldMappings
      }
      return [...DEFAULT_FIELD_MAPPINGS]
    },

    /**
     * Effective n8n connection: DB-stored values take precedence, falling
     * back to env vars so bootstrap-by-env-only deployments keep working.
     */
    getN8nConnection(): N8nConnectionSettings {
      return resolveStoredN8nConnection(repos.settings.get(), runtimeConfig)
    },
  }
}

export type SettingsService = ReturnType<typeof createSettingsService>
