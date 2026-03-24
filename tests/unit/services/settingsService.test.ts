import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSettingsService } from '../../../server/services/settingsService'
import type { SettingsRuntimeConfig } from '../../../server/services/settingsService'
import type { SettingsRepository } from '../../../server/repositories/interfaces/settingsRepository'
import type { AppSettings } from '../../../server/types/domain'

function createMockSettingsRepo(): SettingsRepository {
  let stored: AppSettings | null = null
  return {
    get: vi.fn(() => stored),
    upsert: vi.fn((settings: AppSettings) => { stored = settings; return settings })
  }
}

const defaultRuntimeConfig: SettingsRuntimeConfig = {
  jiraBaseUrl: '',
  jiraProjectKey: '',
  jiraUsername: '',
  jiraApiToken: ''
}

describe('SettingsService', () => {
  let settingsRepo: SettingsRepository
  let service: ReturnType<typeof createSettingsService>

  beforeEach(() => {
    settingsRepo = createMockSettingsRepo()
    service = createSettingsService({ settings: settingsRepo }, defaultRuntimeConfig)
  })

  describe('getSettings', () => {
    it('returns default settings when no DB settings exist', () => {
      const settings = service.getSettings()

      expect(settings.id).toBe('app_settings')
      expect(settings.jiraConnection.baseUrl).toBe('')
      expect(settings.jiraConnection.projectKey).toBe('PI')
      expect(settings.jiraConnection.username).toBe('')
      expect(settings.jiraConnection.apiToken).toBe('')
      expect(settings.jiraConnection.enabled).toBe(false)
      expect(settings.jiraConnection.pushEnabled).toBe(false)
      expect(settings.jiraFieldMappings).toHaveLength(5)
    })

    it('uses runtimeConfig env var fallbacks for defaults', () => {
      const config: SettingsRuntimeConfig = {
        jiraBaseUrl: 'https://custom.jira.com',
        jiraProjectKey: 'CUSTOM',
        jiraUsername: 'admin',
        jiraApiToken: 'secret-token'
      }
      const svc = createSettingsService({ settings: settingsRepo }, config)
      const settings = svc.getSettings()

      expect(settings.jiraConnection.baseUrl).toBe('https://custom.jira.com')
      expect(settings.jiraConnection.projectKey).toBe('CUSTOM')
      expect(settings.jiraConnection.username).toBe('admin')
      expect(settings.jiraConnection.apiToken).toBe('secret-token')
    })

    it('returns DB settings when they exist', () => {
      const dbSettings: AppSettings = {
        id: 'app_settings',
        jiraConnection: {
          baseUrl: 'https://saved.jira.com',
          projectKey: 'SAVED',
          username: 'saved-user',
          apiToken: 'saved-token',
          enabled: true,
          pushEnabled: true
        },
        jiraFieldMappings: [],
        updatedAt: '2024-01-01T00:00:00.000Z'
      }
      settingsRepo.upsert(dbSettings)

      const settings = service.getSettings()
      expect(settings.jiraConnection.baseUrl).toBe('https://saved.jira.com')
      expect(settings.jiraConnection.enabled).toBe(true)
    })

    it('ships with 5 default field mappings', () => {
      const settings = service.getSettings()
      const mappings = settings.jiraFieldMappings

      expect(mappings).toHaveLength(5)
      expect(mappings[0]).toEqual({
        id: 'fm_1', jiraFieldId: 'customfield_10908',
        label: 'Part Number / Rev', shopErpField: 'partNumber', isDefault: true
      })
      expect(mappings[1].shopErpField).toBe('goalQuantity')
      expect(mappings[2].shopErpField).toBe('epicLink')
      expect(mappings[3].shopErpField).toBe('priority')
      expect(mappings[4].shopErpField).toBe('labels')
    })
  })

  describe('updateSettings', () => {
    it('merges jiraConnection with existing settings', () => {
      const updated = service.updateSettings({
        jiraConnection: { enabled: true, baseUrl: 'https://new.jira.com' }
      })

      expect(updated.jiraConnection.enabled).toBe(true)
      expect(updated.jiraConnection.baseUrl).toBe('https://new.jira.com')
      // Other fields should retain defaults
      expect(updated.jiraConnection.projectKey).toBe('PI')
      expect(updated.jiraConnection.pushEnabled).toBe(false)
    })

    it('replaces jiraFieldMappings entirely', () => {
      const customMappings = [
        { id: 'fm_custom', jiraFieldId: 'custom_1', label: 'Custom', shopErpField: 'custom', isDefault: false }
      ]
      const updated = service.updateSettings({ jiraFieldMappings: customMappings })

      expect(updated.jiraFieldMappings).toHaveLength(1)
      expect(updated.jiraFieldMappings[0].id).toBe('fm_custom')
    })

    it('persists via upsert', () => {
      service.updateSettings({ jiraConnection: { enabled: true } })
      expect(settingsRepo.upsert).toHaveBeenCalled()
    })

    it('sets updatedAt timestamp', () => {
      const updated = service.updateSettings({ jiraConnection: { enabled: true } })
      expect(updated.updatedAt).toBeTruthy()
    })

    it('merges with DB settings when they already exist', () => {
      // First save
      service.updateSettings({
        jiraConnection: { baseUrl: 'https://first.jira.com', enabled: true }
      })

      // Second save — should merge with first
      const updated = service.updateSettings({
        jiraConnection: { pushEnabled: true }
      })

      expect(updated.jiraConnection.baseUrl).toBe('https://first.jira.com')
      expect(updated.jiraConnection.enabled).toBe(true)
      expect(updated.jiraConnection.pushEnabled).toBe(true)
    })
  })

  describe('getJiraConnection', () => {
    it('returns default connection when no DB settings', () => {
      const conn = service.getJiraConnection()
      expect(conn.baseUrl).toBe('')
      expect(conn.enabled).toBe(false)
    })

    it('returns saved connection from DB', () => {
      service.updateSettings({
        jiraConnection: { baseUrl: 'https://saved.jira.com', enabled: true }
      })

      const conn = service.getJiraConnection()
      expect(conn.baseUrl).toBe('https://saved.jira.com')
      expect(conn.enabled).toBe(true)
    })
  })

  describe('getFieldMappings', () => {
    it('returns default mappings when no DB settings', () => {
      const mappings = service.getFieldMappings()
      expect(mappings).toHaveLength(5)
      expect(mappings.every(m => m.isDefault)).toBe(true)
    })

    it('returns saved mappings from DB', () => {
      const custom = [
        { id: 'fm_x', jiraFieldId: 'x', label: 'X', shopErpField: 'x', isDefault: false }
      ]
      service.updateSettings({ jiraFieldMappings: custom })

      const mappings = service.getFieldMappings()
      expect(mappings).toHaveLength(1)
      expect(mappings[0].id).toBe('fm_x')
    })
  })
})
