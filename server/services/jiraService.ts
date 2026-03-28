import type { JobRepository } from '../repositories/interfaces/jobRepository'
import type { SettingsService } from './settingsService'
import type { JobService } from './jobService'
import type { PathService } from './pathService'
import type { NoteService } from './noteService'
import type { CertService } from './certService'
import type { PartService } from './partService'
import type { Job, JiraFieldMapping } from '../types/domain'
import type { LinkJiraInput } from '../types/api'
import { ValidationError } from '../utils/errors'

export interface JiraPushResult {
  success: boolean
  error?: string
}

// ---- Jira API response shapes (raw from REST API v2) ----

export interface PITicket {
  key: string
  fields: Record<string, unknown>
}

export interface JiraTicket {
  key: string
  summary: string
  status: string
  priority: string
  assignee: string
  reporter: string
  labels: string[]
  partNumber: string | null
  goalQuantity: number | null
  epicLink: string | null
  createdAt: string
  updatedAt: string
  rawFields: Record<string, unknown>
}

export interface FetchTicketsResult {
  tickets: JiraTicket[]
  error: string | null
  fromCache: boolean
}

// ---- Part number regex fallback ----
const PART_NUMBER_REGEX = /\d{6,7}-\d{3}(-\d{2})?/

/**
 * Extract a part number from a ticket.
 * Prefers the mapped customfield (default: customfield_10908),
 * falls back to regex match on the summary.
 */
function getPartNumber(
  fields: Record<string, unknown>,
  summary: string,
  partNumberFieldId: string
): string | null {
  const primary = fields[partNumberFieldId]
  if (typeof primary === 'string' && primary.trim().length > 0) {
    return primary.trim()
  }
  const match = summary.match(PART_NUMBER_REGEX)
  return match ? match[0] : null
}

/**
 * Safely read a string field from the Jira fields object.
 * Returns empty string for null/undefined/non-string values.
 */
function safeString(value: unknown): string {
  if (typeof value === 'string') return value
  return ''
}

/**
 * Safely read a nested name field (e.g. priority.name, status.name).
 */
function safeNestedName(value: unknown): string {
  if (value && typeof value === 'object' && 'name' in (value as Record<string, unknown>)) {
    return safeString((value as Record<string, unknown>).name)
  }
  return ''
}

/**
 * Safely read a nested displayName field (e.g. assignee.displayName).
 */
function safeNestedDisplayName(value: unknown): string {
  if (value && typeof value === 'object' && 'displayName' in (value as Record<string, unknown>)) {
    return safeString((value as Record<string, unknown>).displayName)
  }
  return ''
}

/**
 * Safely read a number from a Jira field. Returns null if not a valid number.
 */
function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return null
}

/**
 * Safely read a string array (e.g. labels).
 */
function safeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string')
  }
  return []
}

/**
 * Find the Jira field ID for a given shopErpField name from the field mappings.
 */
function findFieldId(mappings: JiraFieldMapping[], shopErpField: string): string | null {
  const mapping = mappings.find(m => m.shopErpField === shopErpField)
  return mapping?.jiraFieldId ?? null
}

export function createJiraService(
  repos: { jobs: JobRepository },
  settingsService: SettingsService,
  jobService: JobService,
  deps?: {
    pathService?: PathService
    noteService?: NoteService
    certService?: CertService
    partService?: PartService
  },
  fetchFn?: typeof fetch
) {
  // Cache for ticket list
  let cachedTickets: JiraTicket[] = []

  // Use provided fetch or global fetch
  const doFetch = fetchFn ?? globalThis.fetch

  /**
   * Build the Authorization header for Jira Basic auth.
   */
  function getAuthHeader(): string {
    const conn = settingsService.getJiraConnection()
    const credentials = Buffer.from(`${conn.username}:${conn.apiToken}`).toString('base64')
    return `Basic ${credentials}`
  }

  /**
   * Make a GET request to the Jira REST API with 10s timeout.
   */
  async function jiraGet(path: string): Promise<unknown> {
    const conn = settingsService.getJiraConnection()
    const baseUrl = conn.baseUrl.replace(/\/+$/, '')
    const url = `${baseUrl}/rest/api/2/${path}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)

    try {
      const response = await doFetch(url, {
        method: 'GET',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal
      })

      if (!response.ok) {
        throw new Error(`Jira API error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Make a PUT request to the Jira REST API with 10s timeout.
   */
  async function jiraPut(path: string, body: unknown): Promise<unknown> {
    const conn = settingsService.getJiraConnection()
    const baseUrl = conn.baseUrl.replace(/\/+$/, '')
    const url = `${baseUrl}/rest/api/2/${path}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)

    try {
      const response = await doFetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      if (!response.ok) {
        throw new Error(`Jira API error: ${response.status} ${response.statusText}`)
      }

      // PUT responses may be 204 No Content
      const text = await response.text()
      return text ? JSON.parse(text) : null
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Make a POST request to the Jira REST API with 10s timeout.
   */
  async function jiraPost(path: string, body: unknown): Promise<unknown> {
    const conn = settingsService.getJiraConnection()
    const baseUrl = conn.baseUrl.replace(/\/+$/, '')
    const url = `${baseUrl}/rest/api/2/${path}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)

    try {
      const response = await doFetch(url, {
        method: 'POST',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      if (!response.ok) {
        throw new Error(`Jira API error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Assert that both Jira enabled and push enabled toggles are on.
   */
  function assertPushEnabled(): void {
    const conn = settingsService.getJiraConnection()
    if (!conn.enabled) {
      throw new ValidationError('Jira integration is not enabled')
    }
    if (!conn.pushEnabled) {
      throw new ValidationError('Jira push is not enabled')
    }
  }

  /**
   * Normalize a raw Jira PI ticket into a JiraTicket using configurable field mappings.
   */
  function normalizeTicket(ticket: PITicket): JiraTicket {
    const mappings = settingsService.getFieldMappings()
    const fields = ticket.fields ?? {}

    const summary = safeString(fields.summary)
    const partNumberFieldId = findFieldId(mappings, 'partNumber') ?? 'customfield_10908'
    const quantityFieldId = findFieldId(mappings, 'goalQuantity') ?? 'customfield_10900'
    const epicLinkFieldId = findFieldId(mappings, 'epicLink') ?? 'customfield_10014'

    return {
      key: ticket.key,
      summary,
      status: safeNestedName(fields.status),
      priority: safeNestedName(fields.priority),
      assignee: safeNestedDisplayName(fields.assignee),
      reporter: safeNestedDisplayName(fields.reporter),
      labels: safeStringArray(fields.labels),
      partNumber: getPartNumber(fields, summary, partNumberFieldId),
      goalQuantity: safeNumber(fields[quantityFieldId]),
      epicLink: safeString(fields[epicLinkFieldId]) || null,
      createdAt: safeString(fields.created),
      updatedAt: safeString(fields.updated),
      rawFields: fields
    }
  }

  return {
    normalizeTicket,
    getPartNumber: (fields: Record<string, unknown>, summary: string) => {
      const mappings = settingsService.getFieldMappings()
      const partNumberFieldId = findFieldId(mappings, 'partNumber') ?? 'customfield_10908'
      return getPartNumber(fields, summary, partNumberFieldId)
    },

    /**
     * Fetch open tickets from Jira (JQL: project = {key} AND resolution is EMPTY).
     * On failure, returns cached list with error message.
     */
    async fetchOpenTickets(): Promise<FetchTicketsResult> {
      try {
        const conn = settingsService.getJiraConnection()
        const jql = `project = ${conn.projectKey} AND resolution is EMPTY`
        const fieldsParam = 'summary,status,priority,assignee,reporter,labels,created,updated'

        // Include mapped custom fields in the request
        const mappings = settingsService.getFieldMappings()
        const customFieldIds = mappings.map(m => m.jiraFieldId).join(',')
        const allFields = customFieldIds ? `${fieldsParam},${customFieldIds}` : fieldsParam

        const data = await jiraGet(
          `search?jql=${encodeURIComponent(jql)}&fields=${encodeURIComponent(allFields)}&maxResults=200`
        ) as { issues?: PITicket[] }

        const issues = data.issues ?? []
        const tickets = issues.map(issue => normalizeTicket(issue))

        // Update cache
        cachedTickets = tickets

        return { tickets, error: null, fromCache: false }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown Jira connection error'
        return { tickets: cachedTickets, error: message, fromCache: cachedTickets.length > 0 }
      }
    },

    /**
     * Fetch a single ticket's full detail from Jira.
     */
    async fetchTicketDetail(ticketKey: string): Promise<JiraTicket> {
      const data = await jiraGet(`issue/${encodeURIComponent(ticketKey)}`) as PITicket
      return normalizeTicket(data)
    },

    /**
     * Link a Jira ticket to a SHOP_ERP Job.
     * Creates a new Job from the ticket data.
     */
    async linkTicketToJob(input: LinkJiraInput): Promise<Job> {
      const ticket = await jiraGet(`issue/${encodeURIComponent(input.ticketKey)}`) as PITicket
      const normalized = normalizeTicket(ticket)

      const goalQuantity = input.goalQuantity ?? normalized.goalQuantity ?? 1

      return jobService.createJob({
        name: normalized.summary || input.ticketKey,
        goalQuantity,
        jiraTicketKey: normalized.key,
        jiraTicketSummary: normalized.summary,
        jiraPartNumber: normalized.partNumber ?? undefined,
        jiraPriority: normalized.priority || undefined,
        jiraEpicLink: normalized.epicLink ?? undefined,
        jiraLabels: normalized.labels.length > 0 ? normalized.labels : undefined
      })
    },

    /**
     * Get the cached tickets (useful for checking cache state in tests).
     */
    getCachedTickets(): JiraTicket[] {
      return cachedTickets
    },

    /**
     * Push a description table to the Jira ticket linked to a job.
     * Appends a Jira wiki markup table per path with date-row showing SN counts at each step.
     */
    async pushDescriptionTable(jobId: string): Promise<JiraPushResult> {
      assertPushEnabled()

      const job = jobService.getJob(jobId)
      if (!job.jiraTicketKey) {
        return { success: false, error: 'Job is not linked to a Jira ticket' }
      }

      if (!deps?.pathService) {
        return { success: false, error: 'PathService not available' }
      }

      try {
        const paths = deps.pathService.listPathsByJob(jobId)
        if (paths.length === 0) {
          return { success: false, error: 'Job has no paths' }
        }

        // Build wiki markup tables for each path
        const today = new Date().toISOString().split('T')[0]
        const tables: string[] = []

        for (const path of paths) {
          const distribution = deps.pathService.getStepDistribution(path.id)
          const stepNames = path.steps.map(s => s.name)
          const completedCount = distribution.length > 0 ? distribution[0]!.completedCount : 0

          // Build header row
          const header = `|| Date || ${stepNames.join(' || ')} || Completed ||`
          // Build data row with counts
          const counts = distribution.map(d => String(d.partCount))
          const dataRow = `| ${today} | ${counts.join(' | ')} | ${completedCount} |`

          tables.push(`*${path.name}*\n${header}\n${dataRow}`)
        }

        const tableMarkup = '\n\n' + tables.join('\n\n')

        // GET current ticket description
        const ticketData = await jiraGet(`issue/${encodeURIComponent(job.jiraTicketKey)}?fields=description`) as {
          fields?: { description?: string }
        }
        const currentDescription = ticketData?.fields?.description ?? ''
        const updatedDescription = currentDescription + tableMarkup

        // PUT updated description
        await jiraPut(`issue/${encodeURIComponent(job.jiraTicketKey)}`, {
          fields: { description: updatedDescription }
        })

        return { success: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown Jira push error'
        return { success: false, error: message }
      }
    },

    /**
     * Push a comment summary with current part counts per path per step.
     */
    async pushCommentSummary(jobId: string): Promise<JiraPushResult> {
      assertPushEnabled()

      const job = jobService.getJob(jobId)
      if (!job.jiraTicketKey) {
        return { success: false, error: 'Job is not linked to a Jira ticket' }
      }

      if (!deps?.pathService) {
        return { success: false, error: 'PathService not available' }
      }

      try {
        const paths = deps.pathService.listPathsByJob(jobId)
        const lines: string[] = [`*Status Summary for ${job.name}*`]

        for (const path of paths) {
          const distribution = deps.pathService.getStepDistribution(path.id)
          const completedCount = distribution.length > 0 ? distribution[0]!.completedCount : 0
          lines.push(`\n*${path.name}:*`)
          for (const step of distribution) {
            lines.push(`- ${step.stepName}: ${step.partCount} parts`)
          }
          lines.push(`- Completed: ${completedCount}`)
        }

        await jiraPost(`issue/${encodeURIComponent(job.jiraTicketKey)}/comment`, {
          body: lines.join('\n')
        })

        return { success: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown Jira push error'
        return { success: false, error: message }
      }
    },

    /**
     * Push a note as a Jira comment formatted as: {StepName} - {SN(s)}: {note text}
     */
    async pushNoteAsComment(noteId: string, jobId: string): Promise<JiraPushResult> {
      assertPushEnabled()

      const job = jobService.getJob(jobId)
      if (!job.jiraTicketKey) {
        return { success: false, error: 'Job is not linked to a Jira ticket' }
      }

      if (!deps?.noteService || !deps?.pathService) {
        return { success: false, error: 'Required services not available' }
      }

      try {
        const notes = deps.noteService.getNotesForJob(jobId)
        const note = notes.find(n => n.id === noteId)
        if (!note) {
          return { success: false, error: `Note not found: ${noteId}` }
        }

        // Find the step name from the path
        const path = deps.pathService.getPath(note.pathId)
        const step = path.steps.find(s => s.id === note.stepId)
        const stepName = step?.name ?? 'Unknown Step'

        const partList = note.partIds.join(', ')
        const commentBody = `${stepName} - ${partList}: ${note.text}`

        await jiraPost(`issue/${encodeURIComponent(job.jiraTicketKey)}/comment`, {
          body: commentBody
        })

        return { success: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown Jira push error'
        return { success: false, error: message }
      }
    },

    /**
     * Push completion docs as a Jira comment with cert list and summary.
     */
    async pushCompletionDocs(jobId: string): Promise<JiraPushResult> {
      assertPushEnabled()

      const job = jobService.getJob(jobId)
      if (!job.jiraTicketKey) {
        return { success: false, error: 'Job is not linked to a Jira ticket' }
      }

      if (!deps?.partService || !deps?.certService) {
        return { success: false, error: 'Required services not available' }
      }

      try {
        const progress = jobService.computeJobProgress(jobId)
        const parts = deps.partService.listPartsByJob(jobId)

        // Collect unique cert IDs from all parts
        const certIdSet = new Set<string>()
        for (const part of parts) {
          const attachments = deps.certService.getCertsForSerial(part.id)
          for (const att of attachments) {
            certIdSet.add(att.certId)
          }
        }

        // Build cert list
        const certLines: string[] = []
        for (const certId of certIdSet) {
          try {
            const cert = deps.certService.getCert(certId)
            certLines.push(`- ${cert.name} (${cert.type})`)
          } catch {
            certLines.push(`- ${certId} (details unavailable)`)
          }
        }

        const lines: string[] = [
          `*Job Completion Summary: ${job.name}*`,
          `Goal: ${progress.goalQuantity}`,
          `Completed: ${progress.completedParts}`,
          `Total Parts: ${progress.totalParts}`,
          `Progress: ${progress.progressPercent.toFixed(1)}%`
        ]

        if (certLines.length > 0) {
          lines.push('\n*Certificates:*')
          lines.push(...certLines)
        }

        await jiraPost(`issue/${encodeURIComponent(job.jiraTicketKey)}/comment`, {
          body: lines.join('\n')
        })

        return { success: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown Jira push error'
        return { success: false, error: message }
      }
    }
  }
}

export type JiraService = ReturnType<typeof createJiraService>
