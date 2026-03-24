import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNoteService } from '../../../server/services/noteService'
import { ValidationError } from '../../../server/utils/errors'
import type { NoteRepository } from '../../../server/repositories/interfaces/noteRepository'
import type { StepNote } from '../../../server/types/domain'
import type { AuditService } from '../../../server/services/auditService'

function createMockNoteRepo(): NoteRepository {
  const store = new Map<string, StepNote>()
  return {
    create: vi.fn((note: StepNote) => { store.set(note.id, note); return note }),
    listBySerialId: vi.fn((serialId: string) =>
      [...store.values()].filter(n => n.serialIds.includes(serialId))
    ),
    listByStepId: vi.fn((stepId: string) =>
      [...store.values()].filter(n => n.stepId === stepId)
    ),
    listByJobId: vi.fn((jobId: string) =>
      [...store.values()].filter(n => n.jobId === jobId)
    )
  }
}

function createMockAuditService(): AuditService {
  return {
    recordCertAttachment: vi.fn(),
    recordSerialCreation: vi.fn(),
    recordSerialAdvancement: vi.fn(),
    recordSerialCompletion: vi.fn(),
    recordNoteCreation: vi.fn(),
    getSerialAuditTrail: vi.fn(() => []),
    getJobAuditTrail: vi.fn(() => []),
    listAuditEntries: vi.fn(() => [])
  } as unknown as AuditService
}

describe('NoteService', () => {
  let noteRepo: NoteRepository
  let auditService: AuditService
  let service: ReturnType<typeof createNoteService>

  beforeEach(() => {
    noteRepo = createMockNoteRepo()
    auditService = createMockAuditService()
    service = createNoteService({ notes: noteRepo }, auditService)
  })

  describe('createNote', () => {
    it('creates a note with generated ID and timestamp', () => {
      const note = service.createNote({
        jobId: 'job_1',
        pathId: 'path_1',
        stepId: 'step_1',
        serialIds: ['sn_1', 'sn_2'],
        text: 'Threaded feature is missing',
        userId: 'user_1'
      })

      expect(note.id).toMatch(/^note_/)
      expect(note.jobId).toBe('job_1')
      expect(note.pathId).toBe('path_1')
      expect(note.stepId).toBe('step_1')
      expect(note.serialIds).toEqual(['sn_1', 'sn_2'])
      expect(note.text).toBe('Threaded feature is missing')
      expect(note.createdBy).toBe('user_1')
      expect(note.createdAt).toBeTruthy()
      expect(note.pushedToJira).toBe(false)
    })

    it('trims whitespace from text', () => {
      const note = service.createNote({
        jobId: 'job_1',
        pathId: 'path_1',
        stepId: 'step_1',
        serialIds: ['sn_1'],
        text: '  some note  ',
        userId: 'user_1'
      })
      expect(note.text).toBe('some note')
    })

    it('records audit entry on creation', () => {
      service.createNote({
        jobId: 'job_1',
        pathId: 'path_1',
        stepId: 'step_1',
        serialIds: ['sn_1'],
        text: 'Defect found',
        userId: 'user_1'
      })

      expect(auditService.recordNoteCreation).toHaveBeenCalledWith({
        userId: 'user_1',
        jobId: 'job_1',
        pathId: 'path_1',
        stepId: 'step_1'
      })
    })

    it('throws ValidationError for empty text', () => {
      expect(() => service.createNote({
        jobId: 'job_1',
        pathId: 'path_1',
        stepId: 'step_1',
        serialIds: ['sn_1'],
        text: '',
        userId: 'user_1'
      })).toThrow(ValidationError)
    })

    it('throws ValidationError for whitespace-only text', () => {
      expect(() => service.createNote({
        jobId: 'job_1',
        pathId: 'path_1',
        stepId: 'step_1',
        serialIds: ['sn_1'],
        text: '   ',
        userId: 'user_1'
      })).toThrow(ValidationError)
    })

    it('throws ValidationError for empty serialIds array', () => {
      expect(() => service.createNote({
        jobId: 'job_1',
        pathId: 'path_1',
        stepId: 'step_1',
        serialIds: [],
        text: 'Some note',
        userId: 'user_1'
      })).toThrow(ValidationError)
    })
  })

  describe('getNotesForSerial', () => {
    it('returns notes containing the serial ID', () => {
      service.createNote({
        jobId: 'job_1', pathId: 'path_1', stepId: 'step_1',
        serialIds: ['sn_1', 'sn_2'], text: 'Note A', userId: 'user_1'
      })
      service.createNote({
        jobId: 'job_1', pathId: 'path_1', stepId: 'step_2',
        serialIds: ['sn_3'], text: 'Note B', userId: 'user_1'
      })

      const notes = service.getNotesForSerial('sn_1')
      expect(notes).toHaveLength(1)
      expect(notes[0].text).toBe('Note A')
    })

    it('returns empty array when no notes match', () => {
      expect(service.getNotesForSerial('nonexistent')).toHaveLength(0)
    })
  })

  describe('getNotesForStep', () => {
    it('returns notes for the given step', () => {
      service.createNote({
        jobId: 'job_1', pathId: 'path_1', stepId: 'step_1',
        serialIds: ['sn_1'], text: 'Step note', userId: 'user_1'
      })

      const notes = service.getNotesForStep('step_1')
      expect(notes).toHaveLength(1)
      expect(notes[0].text).toBe('Step note')
    })
  })

  describe('getNotesForJob', () => {
    it('returns notes for the given job', () => {
      service.createNote({
        jobId: 'job_1', pathId: 'path_1', stepId: 'step_1',
        serialIds: ['sn_1'], text: 'Job note', userId: 'user_1'
      })

      const notes = service.getNotesForJob('job_1')
      expect(notes).toHaveLength(1)
      expect(notes[0].text).toBe('Job note')
    })

    it('returns empty array when no notes match', () => {
      expect(service.getNotesForJob('nonexistent')).toHaveLength(0)
    })
  })
})
