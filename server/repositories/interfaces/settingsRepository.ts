import type { AppSettings } from '../../types/domain'

export interface SettingsRepository {
  get(): AppSettings | null
  upsert(settings: AppSettings): AppSettings
}
