import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSettingsService } from '../../../server/services/settingsService'
import type { SettingsRuntimeConfig } from '../../../server/services/settingsService'
import type { SettingsRepository } from '../../../server/repositories/interfaces/settingsRepository'
import type { AppSettings } from '../../../server/types/domain'

function createMockSettingsRepo(): SettingsRepository {
  let stored: AppSettings | null = null
  return {
    get: vi.fn(() => stored),
    upsert: vi.fn((settings: AppSettings) => {
      stored = settings
      return settings
    }),
  }
}

const defaultRuntimeConfig: SettingsRuntimeConfig = {
  jiraBaseUrl: '',
  jiraProjectKey: '',
  jiraUsername: '',
  jiraApiToken: '',
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
        jiraApiToken: 'secret-token',
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
          pushEnabled: true,
        },
        jiraFieldMappings: [],
        pageToggles: {
          jobs: true,
          partsBrowser: true,
          parts: true,
          queue: true,
          templates: true,
          bom: true,
          certs: true,
          jira: true,
          audit: true,
        },
        updatedAt: '2024-01-01T00:00:00.000Z',
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
        id: 'fm_1',
        jiraFieldId: 'customfield_10908',
        label: 'Part Number / Rev',
        shopErpField: 'partNumber',
        isDefault: true,
      })
      expect(mappings[1].shopErpField).toBe('goalQuantity')
      expect(mappings[2].shopErpField).toBe('epicLink')
      expect(mappings[3].shopErpField).toBe('priority')
      expect(mappings[4].shopErpField).toBe('labels')
    })

    it('returns all 9 pageToggles defaulted to true when no DB settings', () => {
      const settings = service.getSettings()
      const toggles = settings.pageToggles

      expect(Object.keys(toggles).sort()).toEqual([
        'audit',
        'bom',
        'certs',
        'jira',
        'jobs',
        'parts',
        'partsBrowser',
        'queue',
        'templates',
      ])
      expect(Object.values(toggles).every((v) => v === true)).toBe(true)
    })

    it('returns pageToggles from DB settings', () => {
      const dbSettings: AppSettings = {
        id: 'app_settings',
        jiraConnection: {
          baseUrl: '',
          projectKey: 'PI',
          username: '',
          apiToken: '',
          enabled: false,
          pushEnabled: false,
        },
        jiraFieldMappings: [],
        pageToggles: {
          jobs: false,
          partsBrowser: false,
          parts: true,
          queue: true,
          templates: true,
          bom: false,
          certs: true,
          jira: true,
          audit: false,
        },
        updatedAt: '2024-01-01T00:00:00.000Z',
      }
      settingsRepo.upsert(dbSettings)

      const settings = service.getSettings()
      expect(settings.pageToggles.jobs).toBe(false)
      expect(settings.pageToggles.partsBrowser).toBe(false)
      expect(settings.pageToggles.parts).toBe(true)
      expect(settings.pageToggles.bom).toBe(false)
      expect(settings.pageToggles.audit).toBe(false)
      expect(settings.pageToggles.jira).toBe(true)
    })
  })

  describe('updateSettings', () => {
    it('merges jiraConnection with existing settings', () => {
      const updated = service.updateSettings({
        jiraConnection: { enabled: true, baseUrl: 'https://new.jira.com' },
      })

      expect(updated.jiraConnection.enabled).toBe(true)
      expect(updated.jiraConnection.baseUrl).toBe('https://new.jira.com')
      // Other fields should retain defaults
      expect(updated.jiraConnection.projectKey).toBe('PI')
      expect(updated.jiraConnection.pushEnabled).toBe(false)
    })

    it('replaces jiraFieldMappings entirely', () => {
      const customMappings = [
        {
          id: 'fm_custom',
          jiraFieldId: 'custom_1',
          label: 'Custom',
          shopErpField: 'custom',
          isDefault: false,
        },
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
        jiraConnection: { baseUrl: 'https://first.jira.com', enabled: true },
      })

      // Second save — should merge with first
      const updated = service.updateSettings({
        jiraConnection: { pushEnabled: true },
      })

      expect(updated.jiraConnection.baseUrl).toBe('https://first.jira.com')
      expect(updated.jiraConnection.enabled).toBe(true)
      expect(updated.jiraConnection.pushEnabled).toBe(true)
    })

    describe('pageToggles', () => {
      it('partial merge preserves existing toggle values', () => {
        // First: disable jobs and jira
        service.updateSettings({
          pageToggles: { jobs: false, jira: false },
        })

        // Second: disable only partsBrowser — jobs and jira should stay false
        const updated = service.updateSettings({
          pageToggles: { partsBrowser: false },
        })

        expect(updated.pageToggles.jobs).toBe(false)
        expect(updated.pageToggles.jira).toBe(false)
        expect(updated.pageToggles.partsBrowser).toBe(false)
        // Untouched keys remain true (defaults)
        expect(updated.pageToggles.parts).toBe(true)
        expect(updated.pageToggles.queue).toBe(true)
        expect(updated.pageToggles.templates).toBe(true)
        expect(updated.pageToggles.bom).toBe(true)
        expect(updated.pageToggles.certs).toBe(true)
        expect(updated.pageToggles.audit).toBe(true)
      })

      it('unknown keys are ignored during merge', () => {
        const updated = service.updateSettings({
          pageToggles: { jobs: false, foo: false, dashboard: false } as any,
        })

        expect(updated.pageToggles.jobs).toBe(false)
        // Unknown keys should not appear
        expect((updated.pageToggles as any).foo).toBeUndefined()
        expect((updated.pageToggles as any).dashboard).toBeUndefined()
        // All valid keys still present
        expect(Object.keys(updated.pageToggles).sort()).toEqual([
          'audit',
          'bom',
          'certs',
          'jira',
          'jobs',
          'parts',
          'partsBrowser',
          'queue',
          'templates',
        ])
      })

      it('non-boolean values are rejected and ignored', () => {
        const updated = service.updateSettings({
          pageToggles: { jobs: 'no', partsBrowser: 0, parts: null, queue: false } as any,
        })

        // Only the valid boolean (queue: false) should be applied
        expect(updated.pageToggles.queue).toBe(false)
        // Non-boolean values should be ignored — keys keep defaults
        expect(updated.pageToggles.jobs).toBe(true)
        expect(updated.pageToggles.partsBrowser).toBe(true)
        expect(updated.pageToggles.parts).toBe(true)
      })

      it('idempotent update produces same toggle values', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))

        // Set initial state
        service.updateSettings({
          pageToggles: { jobs: false, audit: false },
        })

        const before = service.getSettings()

        // Advance time so updatedAt differs
        vi.setSystemTime(new Date('2024-01-01T00:01:00.000Z'))

        // Apply the same toggles again
        const after = service.updateSettings({
          pageToggles: { jobs: false, audit: false },
        })

        // Toggle values should be identical
        expect(after.pageToggles).toEqual(before.pageToggles)
        // updatedAt should differ (proves the update ran)
        expect(after.updatedAt).not.toBe(before.updatedAt)

        vi.useRealTimers()
      })
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
        jiraConnection: { baseUrl: 'https://saved.jira.com', enabled: true },
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
      expect(mappings.every((m) => m.isDefault)).toBe(true)
    })

    it('returns saved mappings from DB', () => {
      const custom = [
        { id: 'fm_x', jiraFieldId: 'x', label: 'X', shopErpField: 'x', isDefault: false },
      ]
      service.updateSettings({ jiraFieldMappings: custom })

      const mappings = service.getFieldMappings()
      expect(mappings).toHaveLength(1)
      expect(mappings[0].id).toBe('fm_x')
    })
  })
})
