import type { SettingsRepository } from '../repositories/interfaces/settingsRepository'
import type { AppSettings, JiraConnectionSettings, JiraFieldMapping, PageToggles } from '../types/domain'
import { DEFAULT_PAGE_TOGGLES, mergePageToggles } from '../utils/pageToggles'

export interface SettingsRuntimeConfig {
  jiraBaseUrl: string
  jiraProjectKey: string
  jiraUsername: string
  jiraApiToken: string
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

function buildDefaultSettings(runtimeConfig: SettingsRuntimeConfig): AppSettings {
  return {
    id: 'app_settings',
    jiraConnection: buildDefaultJiraConnection(runtimeConfig),
    jiraFieldMappings: [...DEFAULT_FIELD_MAPPINGS],
    pageToggles: { ...DEFAULT_PAGE_TOGGLES },
    updatedAt: new Date().toISOString(),
  }
}

export function createSettingsService(
  repos: { settings: SettingsRepository },
  runtimeConfig: SettingsRuntimeConfig,
) {
  return {
    getSettings(): AppSettings {
      const existing = repos.settings.get()
      if (existing) {
        return existing
      }
      return buildDefaultSettings(runtimeConfig)
    },

    updateSettings(input: {
      jiraConnection?: Partial<JiraConnectionSettings>
      jiraFieldMappings?: JiraFieldMapping[]
      pageToggles?: Partial<PageToggles>
    }): AppSettings {
      const current = repos.settings.get() ?? buildDefaultSettings(runtimeConfig)

      const updated: AppSettings = {
        ...current,
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
  }
}

export type SettingsService = ReturnType<typeof createSettingsService>
