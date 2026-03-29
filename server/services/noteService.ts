import type { NoteRepository } from '../repositories/interfaces/noteRepository'
import type { StepNote } from '../types/domain'
import type { AuditService } from '../services/auditService'
import { generateId } from '../utils/idGenerator'
import { assertNonEmpty, assertNonEmptyArray } from '../utils/validation'

export function createNoteService(repos: { notes: NoteRepository }, auditService: AuditService) {
  return {
    createNote(input: {
      jobId: string
      pathId: string
      stepId: string
      partIds: string[]
      text: string
      userId: string
    }): StepNote {
      assertNonEmpty(input.text, 'text')
      assertNonEmptyArray(input.partIds, 'partIds')

      const note: StepNote = {
        id: generateId('note'),
        jobId: input.jobId,
        pathId: input.pathId,
        stepId: input.stepId,
        partIds: input.partIds,
        text: input.text.trim(),
        createdBy: input.userId,
        createdAt: new Date().toISOString(),
        pushedToJira: false,
      }

      const created = repos.notes.create(note)

      auditService.recordNoteCreation({
        userId: input.userId,
        jobId: input.jobId,
        pathId: input.pathId,
        stepId: input.stepId,
      })

      return created
    },

    getNotesForPart(partId: string): StepNote[] {
      return repos.notes.listByPartId(partId)
    },

    getNotesForStep(stepId: string): StepNote[] {
      return repos.notes.listByStepId(stepId)
    },

    getNotesForJob(jobId: string): StepNote[] {
      return repos.notes.listByJobId(jobId)
    },
  }
}

export type NoteService = ReturnType<typeof createNoteService>
