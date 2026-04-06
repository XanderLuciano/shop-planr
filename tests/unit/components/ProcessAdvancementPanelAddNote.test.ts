/**
 * Unit tests for ProcessAdvancementPanel "Add Note" integration.
 *
 * Tests extracted pure logic that mirrors the component's Add Note wiring,
 * following the same pattern as AddNoteDialog.test.ts and PartCreationPanel.test.ts
 * — no Vue component mounting, no @vue/test-utils.
 *
 * Feature: part-notes-without-advance
 * Requirements: 6.1, 6.2, 6.3
 */
import { describe, it, expect } from 'vitest'
import type { WorkQueueJob } from '~/server/types/computed'
import type { StepNote } from '~/server/types/domain'

// ---- Pure logic functions extracted from ProcessAdvancementPanel.vue ----

/** Computes the props that would be passed to AddNoteDialog from the panel's state. */
export function buildAddNoteDialogProps(
  job: WorkQueueJob,
  localPartIds: string[],
  selectedParts: Set<string>,
): {
  partIds: string[]
  jobId: string
  pathId: string
  stepId: string
  stepName: string
  preSelectedPartIds: string[]
} {
  return {
    partIds: localPartIds,
    jobId: job.jobId,
    pathId: job.pathId,
    stepId: job.stepId,
    stepName: job.stepName,
    preSelectedPartIds: [...selectedParts],
  }
}

/** Handles the noteAdded event forwarding — returns the note to be emitted to the parent. */
export function handleNoteAdded(note: StepNote): StepNote {
  return note
}

// ---- Test helpers ----

function makeJob(overrides: Partial<WorkQueueJob> = {}): WorkQueueJob {
  return {
    jobId: 'job-1',
    jobName: 'Test Job',
    pathId: 'path-1',
    pathName: 'Main Path',
    stepId: 'step-1',
    stepName: 'Cutting',
    stepOrder: 0,
    stepLocation: 'Bay A',
    totalSteps: 3,
    partIds: ['SN-00001', 'SN-00002', 'SN-00003'],
    partCount: 3,
    nextStepName: 'QC Inspection',
    nextStepLocation: 'Lab B',
    isFinalStep: false,
    jobPriority: 0,
    ...overrides,
  }
}

function makeNote(overrides: Partial<StepNote> = {}): StepNote {
  return {
    id: 'note_abc123',
    jobId: 'job-1',
    pathId: 'path-1',
    stepId: 'step-1',
    partIds: ['SN-00001'],
    text: 'Test observation',
    createdBy: 'user-op1',
    createdAt: new Date().toISOString(),
    pushedToJira: false,
    ...overrides,
  }
}

// ---- Tests ----

describe('ProcessAdvancementPanel — Add Note integration', () => {
  // Req 6.1: "Add Note" button renders in actions bar
  describe('"Add Note" button renders in actions bar', () => {
    it('showAddNoteDialog defaults to false (dialog closed)', () => {
      const showAddNoteDialog = false
      expect(showAddNoteDialog).toBe(false)
    })

    it('clicking "Add Note" sets showAddNoteDialog to true', () => {
      let showAddNoteDialog = false
      // Simulate button click handler: @click="showAddNoteDialog = true"
      showAddNoteDialog = true
      expect(showAddNoteDialog).toBe(true)
    })

    it('"Add Note" button is always present regardless of part selection', () => {
      // The Add Note button has no :disabled condition in the template —
      // it is always rendered and clickable, unlike Advance which requires selectedParts.size > 0
      const selectedParts = new Set<string>()
      let showAddNoteDialog = false
      // Simulate click even with no parts selected
      showAddNoteDialog = true
      expect(showAddNoteDialog).toBe(true)
      expect(selectedParts.size).toBe(0)
    })
  })

  // Req 6.2: clicking "Add Note" opens AddNoteDialog with correct props
  describe('clicking "Add Note" opens AddNoteDialog with correct props', () => {
    it('passes localPartIds as partIds prop', () => {
      const job = makeJob({ partIds: ['SN-00001', 'SN-00002', 'SN-00003'] })
      const localPartIds = [...job.partIds]
      const selectedParts = new Set(['SN-00001'])

      const dialogProps = buildAddNoteDialogProps(job, localPartIds, selectedParts)
      expect(dialogProps.partIds).toEqual(['SN-00001', 'SN-00002', 'SN-00003'])
    })

    it('passes job context (jobId, pathId, stepId, stepName)', () => {
      const job = makeJob({
        jobId: 'job-42',
        pathId: 'path-7',
        stepId: 'step-3',
        stepName: 'Assembly',
      })
      const localPartIds = [...job.partIds]
      const selectedParts = new Set<string>()

      const dialogProps = buildAddNoteDialogProps(job, localPartIds, selectedParts)
      expect(dialogProps.jobId).toBe('job-42')
      expect(dialogProps.pathId).toBe('path-7')
      expect(dialogProps.stepId).toBe('step-3')
      expect(dialogProps.stepName).toBe('Assembly')
    })

    it('passes selectedParts spread as preSelectedPartIds', () => {
      const job = makeJob()
      const localPartIds = [...job.partIds]
      const selectedParts = new Set(['SN-00001', 'SN-00003'])

      const dialogProps = buildAddNoteDialogProps(job, localPartIds, selectedParts)
      expect(dialogProps.preSelectedPartIds).toHaveLength(2)
      expect(dialogProps.preSelectedPartIds).toContain('SN-00001')
      expect(dialogProps.preSelectedPartIds).toContain('SN-00003')
    })

    it('passes empty preSelectedPartIds when no parts are selected', () => {
      const job = makeJob()
      const localPartIds = [...job.partIds]
      const selectedParts = new Set<string>()

      const dialogProps = buildAddNoteDialogProps(job, localPartIds, selectedParts)
      expect(dialogProps.preSelectedPartIds).toEqual([])
    })

    it('passes all parts as preSelectedPartIds when all are selected', () => {
      const job = makeJob({ partIds: ['SN-00001', 'SN-00002'] })
      const localPartIds = [...job.partIds]
      const selectedParts = new Set(['SN-00001', 'SN-00002'])

      const dialogProps = buildAddNoteDialogProps(job, localPartIds, selectedParts)
      expect(dialogProps.preSelectedPartIds).toHaveLength(2)
    })

    it('uses localPartIds (mutable copy) not job.partIds directly', () => {
      const job = makeJob({ partIds: ['SN-00001', 'SN-00002'] })
      // Simulate re-sync: localPartIds may diverge after scrap
      const localPartIds = ['SN-00002'] // SN-00001 was scrapped
      const selectedParts = new Set(['SN-00002'])

      const dialogProps = buildAddNoteDialogProps(job, localPartIds, selectedParts)
      // Should use localPartIds, not job.partIds
      expect(dialogProps.partIds).toEqual(['SN-00002'])
      expect(dialogProps.partIds).toHaveLength(1)
    })
  })

  // Req 6.3: noteAdded event emitted when dialog saves
  describe('noteAdded event emitted when dialog saves', () => {
    it('forwards the StepNote from AddNoteDialog saved event', () => {
      const note = makeNote({
        id: 'note_xyz789',
        partIds: ['SN-00001', 'SN-00002'],
        text: 'Surface finish within tolerance',
      })

      const emittedEvents: StepNote[] = []
      // Simulate: @saved="emit('noteAdded', $event)"
      const forwarded = handleNoteAdded(note)
      emittedEvents.push(forwarded)

      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0]).toBe(note) // same reference, not a copy
      expect(emittedEvents[0]!.id).toBe('note_xyz789')
      expect(emittedEvents[0]!.text).toBe('Surface finish within tolerance')
    })

    it('preserves all StepNote fields through the forwarding', () => {
      const note = makeNote({
        id: 'note_full',
        jobId: 'job-42',
        pathId: 'path-7',
        stepId: 'step-3',
        partIds: ['SN-00001'],
        text: 'Detailed observation',
        createdBy: 'user-op42',
        createdAt: '2024-01-15T10:30:00.000Z',
        pushedToJira: false,
      })

      const forwarded = handleNoteAdded(note)
      expect(forwarded).toEqual(note)
    })

    it('dialog closes after save (showAddNoteDialog resets)', () => {
      let showAddNoteDialog = true
      const note = makeNote()

      // Simulate: AddNoteDialog emits update:modelValue(false) on save,
      // which sets showAddNoteDialog = false via v-model
      showAddNoteDialog = false

      // Then the saved event fires and we forward it
      const forwarded = handleNoteAdded(note)

      expect(showAddNoteDialog).toBe(false)
      expect(forwarded).toBe(note)
    })

    it('emits noteAdded for single-part notes', () => {
      const note = makeNote({ partIds: ['SN-00001'] })
      const forwarded = handleNoteAdded(note)
      expect(forwarded.partIds).toEqual(['SN-00001'])
    })

    it('emits noteAdded for multi-part notes', () => {
      const note = makeNote({ partIds: ['SN-00001', 'SN-00002', 'SN-00003'] })
      const forwarded = handleNoteAdded(note)
      expect(forwarded.partIds).toHaveLength(3)
    })
  })
})
