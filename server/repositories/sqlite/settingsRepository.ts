import type Database from 'better-sqlite3'
import type { AppSettings } from '../../types/domain'
import type { SettingsRepository } from '../interfaces/settingsRepository'
import { mergePageToggles } from '../../utils/pageToggles'

interface SettingsRow {
  id: string
  jira_connection: string
  jira_field_mappings: string
  page_toggles: string
  updated_at: string
}

function rowToDomain(row: SettingsRow): AppSettings {
  const parsedToggles = row.page_toggles ? JSON.parse(row.page_toggles) : {}
  return {
    id: row.id,
    jiraConnection: JSON.parse(row.jira_connection),
    jiraFieldMappings: JSON.parse(row.jira_field_mappings),
    pageToggles: mergePageToggles({}, parsedToggles),
    updatedAt: row.updated_at,
  }
}

export class SQLiteSettingsRepository implements SettingsRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  get(): AppSettings | null {
    const row = this.db.prepare(
      'SELECT * FROM settings WHERE id = \'app_settings\'',
    ).get() as SettingsRow | undefined
    return row ? rowToDomain(row) : null
  }

  upsert(settings: AppSettings): AppSettings {
    const id = settings.id || 'app_settings'
    const jiraConnection = JSON.stringify(settings.jiraConnection)
    const jiraFieldMappings = JSON.stringify(settings.jiraFieldMappings)
    const pageToggles = JSON.stringify(settings.pageToggles)

    this.db.prepare(`
      INSERT INTO settings (id, jira_connection, jira_field_mappings, page_toggles, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        jira_connection = excluded.jira_connection,
        jira_field_mappings = excluded.jira_field_mappings,
        page_toggles = excluded.page_toggles,
        updated_at = excluded.updated_at
    `).run(id, jiraConnection, jiraFieldMappings, pageToggles, settings.updatedAt)

    return this.get()!
  }
}
