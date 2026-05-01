import { createAuditService } from '../services/auditService'
import { createUserService } from '../services/userService'
import { createJobService } from '../services/jobService'
import { createPathService } from '../services/pathService'
import { createPartService } from '../services/partService'
import { createCertService } from '../services/certService'
import { createTemplateService } from '../services/templateService'
import { createNoteService } from '../services/noteService'
import { createSettingsService } from '../services/settingsService'
import { createBomService } from '../services/bomService'
import { createJiraService } from '../services/jiraService'
import { createLifecycleService } from '../services/lifecycleService'
import { createLibraryService } from '../services/libraryService'
import { createAuthService } from '../services/authService'
import { createTagService } from '../services/tagService'
import { createWebhookService } from '../services/webhookService'
import { createWebhookRegistrationService } from '../services/webhookRegistrationService'
import { createWebhookDeliveryService } from '../services/webhookDeliveryService'
import { createN8nAutomationService } from '../services/n8nAutomationService'
import { createSequentialPartIdGenerator } from '../utils/idGenerator'
import type { AuditService } from '../services/auditService'
import type { UserService } from '../services/userService'
import type { JobService } from '../services/jobService'
import type { PathService } from '../services/pathService'
import type { PartService } from '../services/partService'
import type { CertService } from '../services/certService'
import type { TemplateService } from '../services/templateService'
import type { NoteService } from '../services/noteService'
import type { SettingsService } from '../services/settingsService'
import type { BomService } from '../services/bomService'
import type { JiraService } from '../services/jiraService'
import type { LifecycleService } from '../services/lifecycleService'
import type { LibraryService } from '../services/libraryService'
import type { AuthService } from '../services/authService'
import type { TagService } from '../services/tagService'
import type { WebhookService } from '../services/webhookService'
import type { WebhookRegistrationService } from '../services/webhookRegistrationService'
import type { WebhookDeliveryService } from '../services/webhookDeliveryService'
import type { N8nAutomationService } from '../services/n8nAutomationService'

export interface ServiceSet {
  auditService: AuditService
  userService: UserService
  jobService: JobService
  pathService: PathService
  partService: PartService
  certService: CertService
  templateService: TemplateService
  noteService: NoteService
  settingsService: SettingsService
  bomService: BomService
  jiraService: JiraService
  lifecycleService: LifecycleService
  libraryService: LibraryService
  authService: AuthService
  tagService: TagService
  webhookService: WebhookService
  webhookRegistrationService: WebhookRegistrationService
  webhookDeliveryService: WebhookDeliveryService
  n8nAutomationService: N8nAutomationService
  /** @deprecated Use `partService` instead. Backward-compatible alias. */
  serialService: PartService
}

let services: ServiceSet | null = null

export function getServices(): ServiceSet {
  if (!services) {
    const repos = getRepositories()
    const config = useRuntimeConfig()

    // Services with no service dependencies
    const auditService = createAuditService({ audit: repos.audit })
    const userService = createUserService({ users: repos.users })
    const authService = createAuthService({ users: repos.users, cryptoKeys: repos.cryptoKeys })
    const jobService = createJobService({ jobs: repos.jobs, paths: repos.paths, parts: repos.parts, bom: repos.bom, jobTags: repos.jobTags, tags: repos.tags })
    const pathService = createPathService({
      paths: repos.paths,
      parts: repos.parts,
      users: repos.users,
      notes: repos.notes,
      partStepOverrides: repos.partStepOverrides,
      certs: repos.certs,
      partStepStatuses: repos.partStepStatuses,
      db: repos._db,
    }, auditService)
    const templateService = createTemplateService({ templates: repos.templates, paths: repos.paths })

    // Lifecycle service depends on auditService
    const lifecycleService = createLifecycleService({
      parts: repos.parts,
      paths: repos.paths,
      jobs: repos.jobs,
      partStepStatuses: repos.partStepStatuses,
      partStepOverrides: repos.partStepOverrides,
    }, auditService)

    // Library service
    const libraryService = createLibraryService({ library: repos.library })

    // BOM service with version support and audit
    const bomService = createBomService(
      { bom: repos.bom, parts: repos.parts, jobs: repos.jobs, users: repos.users, bomVersions: repos.bomVersions },
      auditService,
    )

    // Part ID generator backed by the counters table
    const db = repos._db
    const partIdGenerator = createSequentialPartIdGenerator({
      getCounter: () => {
        const row = db.prepare('SELECT value FROM counters WHERE name = ?').get('part') as { value: number } | undefined
        return row?.value ?? 0
      },
      setCounter: (v: number) => {
        db.prepare('INSERT OR REPLACE INTO counters (name, value) VALUES (?, ?)').run('part', v)
      },
    })

    // Services that depend on auditService (and optionally lifecycleService)
    const partService = createPartService(
      {
        parts: repos.parts,
        paths: repos.paths,
        certs: repos.certs,
        jobs: repos.jobs,
        users: repos.users,
        partStepStatuses: repos.partStepStatuses,
        partStepOverrides: repos.partStepOverrides,
        db: repos._db,
      },
      auditService,
      partIdGenerator,
      lifecycleService,
    )
    const certService = createCertService({ certs: repos.certs, parts: repos.parts, paths: repos.paths }, auditService)
    const noteService = createNoteService({ notes: repos.notes }, auditService)

    // Settings service depends on runtimeConfig + users repo (for admin gating)
    const settingsService = createSettingsService({ settings: repos.settings, users: repos.users }, {
      jiraBaseUrl: config.jiraBaseUrl,
      jiraProjectKey: config.jiraProjectKey,
      jiraUsername: config.jiraUsername,
      jiraApiToken: config.jiraApiToken,
      n8nBaseUrl: config.n8nBaseUrl,
      n8nApiKey: config.n8nApiKey,
    })

    // Jira service depends on settingsService and jobService
    const jiraService = createJiraService({ jobs: repos.jobs }, settingsService, jobService, {
      pathService,
      noteService,
      certService,
      partService,
    })

    const tagService = createTagService(
      { tags: repos.tags, jobTags: repos.jobTags, jobs: repos.jobs, users: repos.users },
      auditService,
    )

    const webhookDeliveryService = createWebhookDeliveryService({
      webhookDeliveries: repos.webhookDeliveries,
      webhookRegistrations: repos.webhookRegistrations,
      webhookEvents: repos.webhookEvents,
      users: repos.users,
      db: repos._db,
    })

    const webhookService = createWebhookService({
      webhookEvents: repos.webhookEvents,
      users: repos.users,
      db: repos._db,
    }, webhookDeliveryService)

    const webhookRegistrationService = createWebhookRegistrationService({
      webhookRegistrations: repos.webhookRegistrations,
      webhookDeliveries: repos.webhookDeliveries,
      users: repos.users,
      db: repos._db,
    })

    const n8nAutomationService = createN8nAutomationService({
      n8nAutomations: repos.n8nAutomations,
      webhookRegistrations: repos.webhookRegistrations,
      webhookDeliveries: repos.webhookDeliveries,
      users: repos.users,
      settings: settingsService,
      db: repos._db,
    })

    services = {
      auditService,
      userService,
      authService,
      jobService,
      pathService,
      partService,
      certService,
      templateService,
      noteService,
      settingsService,
      bomService,
      jiraService,
      lifecycleService,
      libraryService,
      tagService,
      webhookService,
      webhookRegistrationService,
      webhookDeliveryService,
      n8nAutomationService,
      // Backward-compatible alias
      serialService: partService,
    }
  }
  return services
}

export async function initServices(): Promise<void> {
  const { authService } = getServices()
  await authService.ensureKeyPair()
  authService.ensureDefaultAdmin()
}
