import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '../../../server/repositories/sqlite/index'
import { SQLiteJobRepository } from '../../../server/repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '../../../server/repositories/sqlite/pathRepository'
import { SQLiteSerialRepository } from '../../../server/repositories/sqlite/serialRepository'
import { SQLiteSettingsRepository } from '../../../server/repositories/sqlite/settingsRepository'
import { SQLiteNoteRepository } from '../../../server/repositories/sqlite/noteRepository'
import { SQLiteCertRepository } from '../../../server/repositories/sqlite/certRepository'
import { SQLiteAuditRepository } from '../../../server/repositories/sqlite/auditRepository'
import { createSettingsService } from '../../../server/services/settingsService'
import { createJobService } from '../../../server/services/jobService'
import { createPathService } from '../../../server/services/pathService'
import { createSerialService } from '../../../server/services/serialService'
import { createCertService } from '../../../server/services/certService'
import { createNoteService } from '../../../server/services/noteService'
import { createAuditService } from '../../../server/services/auditService'
import { createJiraService } from '../../../server/services/jiraService'
import type { PITicket } from '../../../server/services/jiraService'
import type { SettingsService } from '../../../server/services/settingsService'
import type { JobService } from '../../../server/services/jobService'
import type { PathService } from '../../../server/services/pathService'
import type { SerialService } from '../../../server/services/serialService'
import type { CertService } from '../../../server/services/certService'
import type { NoteService } from '../../../server/services/noteService'
import { ValidationError } from '../../../server/utils/errors'
import { createSequentialSnGenerator } from '../../../server/utils/idGenerator'

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  const migrationsDir = resolve(__dirname, '../../../server/repositories/sqlite/migrations')
  runMigrations(db, migrationsDir)
  return db
}

function makeMockFetch(responseData: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: () => Promise.resolve(responseData),
    text: () => Promise.resolve(JSON.stringify(responseData))
  })
}

function samplePITicket(overrides: Partial<PITicket> = {}): PITicket {
  return {
    key: 'PI-7987',
    fields: {
      summary: 'Machine bracket assembly 1234567-001',
      status: { name: 'In Progress' },
      priority: { name: 'High' },
      assignee: { displayName: 'John Doe' },
      reporter: { displayName: 'Jane Smith' },
      labels: ['urgent', 'machining'],
      created: '2026-03-01T10:00:00.000Z',
      updated: '2026-03-10T15:30:00.000Z',
      customfield_10908: '7654321-002',
      customfield_10900: 25,
      customfield_10014: 'EPIC-100'
    },
    ...overrides
  }
}

describe('JiraService', () => {
  let db: ReturnType<typeof createTestDb>
  let settingsService: SettingsService
  let jobService: JobService

  beforeEach(() => {
    db = createTestDb()
    const settingsRepo = new SQLiteSettingsRepository(db)
    settingsService = createSettingsService({ settings: settingsRepo }, {
      jiraBaseUrl: 'https://jira.example.com',
      jiraProjectKey: 'PI',
      jiraUsername: 'testuser',
      jiraApiToken: 'testtoken'
    })
    const jobsRepo = new SQLiteJobRepository(db)
    const pathsRepo = new SQLitePathRepository(db)
    const serialsRepo = new SQLiteSerialRepository(db)
    jobService = createJobService({ jobs: jobsRepo, paths: pathsRepo, serials: serialsRepo })
  })

  afterEach(() => {
    db.close()
  })

  describe('normalizeTicket', () => {
    it('maps all standard fields from a PI ticket', () => {
      const mockFetch = makeMockFetch({})
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, mockFetch)

      const ticket = samplePITicket()
      const normalized = jira.normalizeTicket(ticket)

      expect(normalized.key).toBe('PI-7987')
      expect(normalized.summary).toBe('Machine bracket assembly 1234567-001')
      expect(normalized.status).toBe('In Progress')
      expect(normalized.priority).toBe('High')
      expect(normalized.assignee).toBe('John Doe')
      expect(normalized.reporter).toBe('Jane Smith')
      expect(normalized.labels).toEqual(['urgent', 'machining'])
      expect(normalized.partNumber).toBe('7654321-002')
      expect(normalized.goalQuantity).toBe(25)
      expect(normalized.epicLink).toBe('EPIC-100')
      expect(normalized.createdAt).toBe('2026-03-01T10:00:00.000Z')
      expect(normalized.updatedAt).toBe('2026-03-10T15:30:00.000Z')
    })

    it('handles null/missing mapped fields gracefully', () => {
      const mockFetch = makeMockFetch({})
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, mockFetch)

      const ticket: PITicket = {
        key: 'PI-1000',
        fields: {
          summary: 'Simple ticket with no custom fields',
          status: null,
          priority: null,
          assignee: null,
          reporter: null,
          labels: null,
          created: null,
          updated: null
        }
      }
      const normalized = jira.normalizeTicket(ticket)

      expect(normalized.key).toBe('PI-1000')
      expect(normalized.summary).toBe('Simple ticket with no custom fields')
      expect(normalized.status).toBe('')
      expect(normalized.priority).toBe('')
      expect(normalized.assignee).toBe('')
      expect(normalized.reporter).toBe('')
      expect(normalized.labels).toEqual([])
      expect(normalized.partNumber).toBeNull()
      expect(normalized.goalQuantity).toBeNull()
      expect(normalized.epicLink).toBeNull()
    })

    it('handles completely empty fields object', () => {
      const mockFetch = makeMockFetch({})
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, mockFetch)

      const ticket: PITicket = { key: 'PI-999', fields: {} }
      const normalized = jira.normalizeTicket(ticket)

      expect(normalized.key).toBe('PI-999')
      expect(normalized.summary).toBe('')
      expect(normalized.partNumber).toBeNull()
      expect(normalized.goalQuantity).toBeNull()
    })
  })

  describe('getPartNumber', () => {
    it('prefers customfield_10908 over summary regex', () => {
      const mockFetch = makeMockFetch({})
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, mockFetch)

      const result = jira.getPartNumber(
        { customfield_10908: 'PN-FROM-FIELD' },
        'Summary with 1234567-001 in it'
      )
      expect(result).toBe('PN-FROM-FIELD')
    })

    it('falls back to summary regex when custom field is null', () => {
      const mockFetch = makeMockFetch({})
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, mockFetch)

      const result = jira.getPartNumber(
        { customfield_10908: null },
        'Bracket 1234567-001-02 assembly'
      )
      expect(result).toBe('1234567-001-02')
    })

    it('falls back to summary regex when custom field is empty string', () => {
      const mockFetch = makeMockFetch({})
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, mockFetch)

      const result = jira.getPartNumber(
        { customfield_10908: '' },
        'Part 123456-789 needs work'
      )
      expect(result).toBe('123456-789')
    })

    it('returns null when neither field nor regex match', () => {
      const mockFetch = makeMockFetch({})
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, mockFetch)

      const result = jira.getPartNumber(
        { customfield_10908: null },
        'No part number here'
      )
      expect(result).toBeNull()
    })
  })

  describe('fetchOpenTickets', () => {
    it('fetches and normalizes open tickets', async () => {
      const mockFetch = makeMockFetch({
        issues: [samplePITicket(), samplePITicket({ key: 'PI-8000' })]
      })
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, mockFetch)

      const result = await jira.fetchOpenTickets()

      expect(result.error).toBeNull()
      expect(result.fromCache).toBe(false)
      expect(result.tickets).toHaveLength(2)
      expect(result.tickets[0].key).toBe('PI-7987')
      expect(result.tickets[1].key).toBe('PI-8000')

      // Verify the fetch was called with correct JQL
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('rest/api/2/search')
      expect(calledUrl).toContain('resolution%20is%20EMPTY')
    })

    it('returns cached tickets on connection failure', async () => {
      // First call succeeds and populates cache
      const successFetch = makeMockFetch({
        issues: [samplePITicket()]
      })
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, successFetch)

      await jira.fetchOpenTickets()
      expect(jira.getCachedTickets()).toHaveLength(1)

      // Now make fetch fail
      successFetch.mockRejectedValueOnce(new Error('Network timeout'))

      const result = await jira.fetchOpenTickets()
      expect(result.error).toBe('Network timeout')
      expect(result.fromCache).toBe(true)
      expect(result.tickets).toHaveLength(1)
      expect(result.tickets[0].key).toBe('PI-7987')
    })

    it('returns empty list with error when no cache and connection fails', async () => {
      const failFetch = vi.fn().mockRejectedValue(new Error('Connection refused'))
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, failFetch)

      const result = await jira.fetchOpenTickets()
      expect(result.error).toBe('Connection refused')
      expect(result.fromCache).toBe(false)
      expect(result.tickets).toEqual([])
    })

    it('handles non-ok HTTP response', async () => {
      const mockFetch = makeMockFetch({ errorMessages: ['Unauthorized'] }, false, 401)
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, mockFetch)

      const result = await jira.fetchOpenTickets()
      expect(result.error).toContain('Jira API error: 401')
      expect(result.tickets).toEqual([])
    })

    it('uses 10s timeout via AbortController', async () => {
      const mockFetch = makeMockFetch({ issues: [] })
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, mockFetch)

      await jira.fetchOpenTickets()

      // Verify signal was passed
      const callOptions = mockFetch.mock.calls[0][1]
      expect(callOptions.signal).toBeInstanceOf(AbortSignal)
    })

    it('includes Authorization header with Basic auth', async () => {
      const mockFetch = makeMockFetch({ issues: [] })
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, mockFetch)

      await jira.fetchOpenTickets()

      const callOptions = mockFetch.mock.calls[0][1]
      const expectedAuth = `Basic ${Buffer.from('testuser:testtoken').toString('base64')}`
      expect(callOptions.headers.Authorization).toBe(expectedAuth)
    })
  })

  describe('fetchTicketDetail', () => {
    it('fetches and normalizes a single ticket', async () => {
      const ticket = samplePITicket()
      const mockFetch = makeMockFetch(ticket)
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, mockFetch)

      const result = await jira.fetchTicketDetail('PI-7987')

      expect(result.key).toBe('PI-7987')
      expect(result.summary).toBe('Machine bracket assembly 1234567-001')
      expect(result.partNumber).toBe('7654321-002')

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('rest/api/2/issue/PI-7987')
    })
  })

  describe('linkTicketToJob', () => {
    it('creates a Job from Jira ticket data', async () => {
      const ticket = samplePITicket()
      const mockFetch = makeMockFetch(ticket)
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, mockFetch)

      const job = await jira.linkTicketToJob({ ticketKey: 'PI-7987' })

      expect(job.id).toMatch(/^job_/)
      expect(job.name).toBe('Machine bracket assembly 1234567-001')
      expect(job.goalQuantity).toBe(25)
      expect(job.jiraTicketKey).toBe('PI-7987')
      expect(job.jiraTicketSummary).toBe('Machine bracket assembly 1234567-001')
      expect(job.jiraPartNumber).toBe('7654321-002')
      expect(job.jiraPriority).toBe('High')
      expect(job.jiraEpicLink).toBe('EPIC-100')
      expect(job.jiraLabels).toEqual(['urgent', 'machining'])
    })

    it('uses user-provided goalQuantity when specified', async () => {
      const ticket = samplePITicket()
      const mockFetch = makeMockFetch(ticket)
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, mockFetch)

      const job = await jira.linkTicketToJob({ ticketKey: 'PI-7987', goalQuantity: 50 })

      expect(job.goalQuantity).toBe(50)
    })

    it('defaults goalQuantity to 1 when ticket has no quantity and none provided', async () => {
      const ticket: PITicket = {
        key: 'PI-5000',
        fields: {
          summary: 'No quantity ticket',
          status: { name: 'Open' },
          priority: { name: 'Medium' },
          assignee: null,
          reporter: null,
          labels: [],
          created: '2026-01-01T00:00:00.000Z',
          updated: '2026-01-01T00:00:00.000Z'
        }
      }
      const mockFetch = makeMockFetch(ticket)
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, mockFetch)

      const job = await jira.linkTicketToJob({ ticketKey: 'PI-5000' })

      expect(job.goalQuantity).toBe(1)
      expect(job.name).toBe('No quantity ticket')
    })

    it('uses ticket key as name when summary is empty', async () => {
      const ticket: PITicket = {
        key: 'PI-6000',
        fields: {}
      }
      const mockFetch = makeMockFetch(ticket)
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, mockFetch)

      const job = await jira.linkTicketToJob({ ticketKey: 'PI-6000' })

      expect(job.name).toBe('PI-6000')
    })
  })

  describe('configurable field mappings', () => {
    it('uses custom field mappings from settings', () => {
      // Update settings with custom field mappings
      settingsService.updateSettings({
        jiraFieldMappings: [
          { id: 'fm_1', jiraFieldId: 'customfield_99999', label: 'Custom PN', shopErpField: 'partNumber', isDefault: false },
          { id: 'fm_2', jiraFieldId: 'customfield_88888', label: 'Custom Qty', shopErpField: 'goalQuantity', isDefault: false },
          { id: 'fm_3', jiraFieldId: 'customfield_77777', label: 'Custom Epic', shopErpField: 'epicLink', isDefault: false }
        ]
      })

      const mockFetch = makeMockFetch({})
      const jira = createJiraService({ jobs: new SQLiteJobRepository(db) }, settingsService, jobService, {}, mockFetch)

      const ticket: PITicket = {
        key: 'PI-CUSTOM',
        fields: {
          summary: 'Custom mapped ticket',
          customfield_99999: 'CUSTOM-PN-001',
          customfield_88888: 42,
          customfield_77777: 'CUSTOM-EPIC'
        }
      }

      const normalized = jira.normalizeTicket(ticket)
      expect(normalized.partNumber).toBe('CUSTOM-PN-001')
      expect(normalized.goalQuantity).toBe(42)
      expect(normalized.epicLink).toBe('CUSTOM-EPIC')
    })
  })

  describe('push methods', () => {
    let pathService: PathService
    let serialService: SerialService
    let certService: CertService
    let noteService: NoteService
    let jobsRepo: SQLiteJobRepository
    let pathsRepo: SQLitePathRepository
    let serialsRepo: SQLiteSerialRepository
    let certsRepo: SQLiteCertRepository
    let notesRepo: SQLiteNoteRepository
    let auditRepo: SQLiteAuditRepository

    beforeEach(() => {
      jobsRepo = new SQLiteJobRepository(db)
      pathsRepo = new SQLitePathRepository(db)
      serialsRepo = new SQLiteSerialRepository(db)
      certsRepo = new SQLiteCertRepository(db)
      notesRepo = new SQLiteNoteRepository(db)
      auditRepo = new SQLiteAuditRepository(db)

      const auditService = createAuditService({ audit: auditRepo })
      pathService = createPathService({ paths: pathsRepo, serials: serialsRepo })
      const snGenerator = createSequentialSnGenerator({
        getCounter: () => {
          const row = db.prepare('SELECT value FROM counters WHERE name = ?').get('sn') as { value: number } | undefined
          return row?.value ?? 0
        },
        setCounter: (v: number) => {
          db.prepare('INSERT OR REPLACE INTO counters (name, value) VALUES (?, ?)').run('sn', v)
        }
      })
      serialService = createSerialService({ serials: serialsRepo, paths: pathsRepo, certs: certsRepo }, auditService, snGenerator)
      certService = createCertService({ certs: certsRepo }, auditService)
      noteService = createNoteService({ notes: notesRepo }, auditService)
    })

    function enablePush() {
      settingsService.updateSettings({
        jiraConnection: { enabled: true, pushEnabled: true }
      })
    }

    function createJobWithPath(mockFetch: ReturnType<typeof makeMockFetch>) {
      const job = jobService.createJob({ name: 'Test Job', goalQuantity: 10, jiraTicketKey: 'PI-100' })
      const path = pathService.createPath({
        jobId: job.id, name: 'Main Path', goalQuantity: 10,
        steps: [{ name: 'Machining' }, { name: 'Inspection' }, { name: 'Coating' }]
      })
      return { job, path }
    }

    describe('assertPushEnabled', () => {
      it('throws ValidationError when Jira is not enabled', async () => {
        const mockFetch = makeMockFetch({})
        const jira = createJiraService({ jobs: jobsRepo }, settingsService, jobService, { pathService }, mockFetch)
        const job = jobService.createJob({ name: 'Test', goalQuantity: 5, jiraTicketKey: 'PI-1' })

        await expect(jira.pushDescriptionTable(job.id)).rejects.toThrow(ValidationError)
        await expect(jira.pushDescriptionTable(job.id)).rejects.toThrow('Jira integration is not enabled')
      })

      it('throws ValidationError when push is not enabled', async () => {
        settingsService.updateSettings({ jiraConnection: { enabled: true, pushEnabled: false } })
        const mockFetch = makeMockFetch({})
        const jira = createJiraService({ jobs: jobsRepo }, settingsService, jobService, { pathService }, mockFetch)
        const job = jobService.createJob({ name: 'Test', goalQuantity: 5, jiraTicketKey: 'PI-1' })

        await expect(jira.pushCommentSummary(job.id)).rejects.toThrow('Jira push is not enabled')
      })
    })

    describe('pushDescriptionTable', () => {
      it('appends wiki markup table to ticket description', async () => {
        enablePush()
        const mockFetch = makeMockFetch({ fields: { description: 'Existing description' } })
        const jira = createJiraService({ jobs: jobsRepo }, settingsService, jobService, { pathService }, mockFetch)
        const { job } = createJobWithPath(mockFetch)

        const result = await jira.pushDescriptionTable(job.id)

        expect(result.success).toBe(true)
        // Should have made a GET (description) then a PUT
        expect(mockFetch).toHaveBeenCalledTimes(2)
        const putCall = mockFetch.mock.calls[1]
        expect(putCall[1].method).toBe('PUT')
        const putBody = JSON.parse(putCall[1].body)
        expect(putBody.fields.description).toContain('Existing description')
        expect(putBody.fields.description).toContain('Machining')
        expect(putBody.fields.description).toContain('Inspection')
        expect(putBody.fields.description).toContain('Coating')
        expect(putBody.fields.description).toContain('Completed')
      })

      it('returns error when job has no Jira ticket', async () => {
        enablePush()
        const mockFetch = makeMockFetch({})
        const jira = createJiraService({ jobs: jobsRepo }, settingsService, jobService, { pathService }, mockFetch)
        const job = jobService.createJob({ name: 'No Jira', goalQuantity: 5 })

        const result = await jira.pushDescriptionTable(job.id)
        expect(result.success).toBe(false)
        expect(result.error).toContain('not linked to a Jira ticket')
      })

      it('returns error on Jira API failure instead of throwing', async () => {
        enablePush()
        const mockFetch = makeMockFetch({}, false, 500)
        const jira = createJiraService({ jobs: jobsRepo }, settingsService, jobService, { pathService }, mockFetch)
        const { job } = createJobWithPath(mockFetch)

        const result = await jira.pushDescriptionTable(job.id)
        expect(result.success).toBe(false)
        expect(result.error).toContain('Jira API error')
      })
    })

    describe('pushCommentSummary', () => {
      it('posts a comment with part counts per path per step', async () => {
        enablePush()
        const mockFetch = makeMockFetch({ id: '12345' })
        const jira = createJiraService({ jobs: jobsRepo }, settingsService, jobService, { pathService }, mockFetch)
        const { job } = createJobWithPath(mockFetch)

        const result = await jira.pushCommentSummary(job.id)

        expect(result.success).toBe(true)
        const postCall = mockFetch.mock.calls[0]
        expect(postCall[1].method).toBe('POST')
        expect(postCall[0]).toContain('/comment')
        const body = JSON.parse(postCall[1].body)
        expect(body.body).toContain('Status Summary')
        expect(body.body).toContain('Main Path')
        expect(body.body).toContain('Machining')
      })

      it('returns error when job has no Jira ticket', async () => {
        enablePush()
        const mockFetch = makeMockFetch({})
        const jira = createJiraService({ jobs: jobsRepo }, settingsService, jobService, { pathService }, mockFetch)
        const job = jobService.createJob({ name: 'No Jira', goalQuantity: 5 })

        const result = await jira.pushCommentSummary(job.id)
        expect(result.success).toBe(false)
        expect(result.error).toContain('not linked to a Jira ticket')
      })
    })

    describe('pushNoteAsComment', () => {
      it('posts a formatted comment for a note', async () => {
        enablePush()
        const mockFetch = makeMockFetch({ id: '12345' })
        const jira = createJiraService(
          { jobs: jobsRepo }, settingsService, jobService,
          { pathService, noteService }, mockFetch
        )
        const { job, path } = createJobWithPath(mockFetch)

        // Create serials and a note
        const serials = serialService.batchCreateSerials(
          { jobId: job.id, pathId: path.id, quantity: 2 }, 'user1'
        )
        const note = noteService.createNote({
          jobId: job.id, pathId: path.id, stepId: path.steps[0].id,
          serialIds: serials.map(s => s.id), text: 'threaded feature is missing', userId: 'user1'
        })

        const result = await jira.pushNoteAsComment(note.id, job.id)

        expect(result.success).toBe(true)
        const postCall = mockFetch.mock.calls[0]
        expect(postCall[1].method).toBe('POST')
        const body = JSON.parse(postCall[1].body)
        expect(body.body).toContain('Machining')
        expect(body.body).toContain('threaded feature is missing')
      })

      it('returns error when note is not found', async () => {
        enablePush()
        const mockFetch = makeMockFetch({})
        const jira = createJiraService(
          { jobs: jobsRepo }, settingsService, jobService,
          { pathService, noteService }, mockFetch
        )
        const job = jobService.createJob({ name: 'Test', goalQuantity: 5, jiraTicketKey: 'PI-1' })

        const result = await jira.pushNoteAsComment('nonexistent', job.id)
        expect(result.success).toBe(false)
        expect(result.error).toContain('Note not found')
      })
    })

    describe('pushCompletionDocs', () => {
      it('posts a completion summary comment', async () => {
        enablePush()
        const mockFetch = makeMockFetch({ id: '12345' })
        const jira = createJiraService(
          { jobs: jobsRepo }, settingsService, jobService,
          { pathService, serialService, certService }, mockFetch
        )
        const { job, path } = createJobWithPath(mockFetch)

        // Create serials
        serialService.batchCreateSerials({ jobId: job.id, pathId: path.id, quantity: 3 }, 'user1')

        const result = await jira.pushCompletionDocs(job.id)

        expect(result.success).toBe(true)
        const postCall = mockFetch.mock.calls[0]
        const body = JSON.parse(postCall[1].body)
        expect(body.body).toContain('Job Completion Summary')
        expect(body.body).toContain('Test Job')
        expect(body.body).toContain('Goal: 10')
        expect(body.body).toContain('Total Serials: 3')
      })

      it('includes certificate list in completion summary', async () => {
        enablePush()
        const mockFetch = makeMockFetch({ id: '12345' })
        const jira = createJiraService(
          { jobs: jobsRepo }, settingsService, jobService,
          { pathService, serialService, certService }, mockFetch
        )
        const { job, path } = createJobWithPath(mockFetch)

        const cert = certService.createCert({ type: 'material', name: 'Steel Cert 304L' })
        const serials = serialService.batchCreateSerials(
          { jobId: job.id, pathId: path.id, quantity: 1, certId: cert.id }, 'user1'
        )

        const result = await jira.pushCompletionDocs(job.id)

        expect(result.success).toBe(true)
        const postCall = mockFetch.mock.calls[0]
        const body = JSON.parse(postCall[1].body)
        expect(body.body).toContain('Certificates')
        expect(body.body).toContain('Steel Cert 304L')
        expect(body.body).toContain('material')
      })

      it('returns error when job has no Jira ticket', async () => {
        enablePush()
        const mockFetch = makeMockFetch({})
        const jira = createJiraService(
          { jobs: jobsRepo }, settingsService, jobService,
          { serialService, certService }, mockFetch
        )
        const job = jobService.createJob({ name: 'No Jira', goalQuantity: 5 })

        const result = await jira.pushCompletionDocs(job.id)
        expect(result.success).toBe(false)
        expect(result.error).toContain('not linked to a Jira ticket')
      })
    })
  })
})
