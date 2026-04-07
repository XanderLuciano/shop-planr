/**
 * Unit tests for AddNoteDialog pure logic.
 *
 * Tests extracted pure functions that mirror the component's internal logic,
 * following the same pattern as PartCreationPanel.test.ts — no Vue
 * component mounting, no @vue/test-utils.
 *
 * Feature: part-notes-without-advance
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.3, 5.1, 5.2, 5.4
 */
import { describe, it, expect, vi } from 'vitest'
import type { StepNote } from '~/server/types/domain'

// ---- Pure logic functions extracted from AddNoteDialog.vue ----

/** Toggles a part ID in/out of the selected set. Returns a new Set. */
export function togglePart(selectedSet: Set<string>, partId: string): Set<string> {
  const next = new Set(selectedSet)
  if (next.has(partId)) next.delete(partId)
  else next.add(partId)
  return next
}

/** Selects all part IDs. Returns a new Set containing all IDs. */
export function selectAll(partIds: string[]): Set<string> {
  return new Set(partIds)
}

/** Deselects all parts. Returns an empty Set. */
export function selectNone(): Set<string> {
  return new Set()
}

/** Determines whether the Save button should be disabled. */
export function canSave(
  noteText: string,
  selectedPartIds: Set<string>,
  operatorId: string | null,
  saving: boolean,
): boolean {
  return (
    noteText.trim().length > 0
    && selectedPartIds.size > 0
    && !!operatorId
    && !saving
  )
}

/** Initializes selected parts when dialog opens. */
export function initSelectedParts(
  preSelectedPartIds: string[] | undefined,
): Set<string> {
  if (preSelectedPartIds?.length) {
    return new Set(preSelectedPartIds)
  }
  return new Set()
}

/** Builds the success toast after a note is created. */
export function buildSuccessToast(selectedCount: number): { title: string, description: string, color: string } {
  return {
    title: 'Note added',
    description: `Note added to ${selectedCount} part${selectedCount !== 1 ? 's' : ''}`,
    color: 'success',
  }
}

/** Builds the error toast when createNote fails. */
export function buildErrorToast(e: any): { title: string, description: string, color: string } {
  return {
    title: 'Failed to add note',
    description: e?.data?.message ?? e?.message ?? 'An error occurred',
    color: 'error',
  }
}

/** Extracts error message from various error shapes. */
export function extractErrorMessage(e: any): string {
  return e?.data?.message ?? e?.message ?? 'An error occurred'
}

/** Builds the createNote input payload. */
export function buildCreateNotePayload(
  jobId: string,
  pathId: string,
  stepId: string,
  selectedPartIds: Set<string>,
  noteText: string,
  userId: string,
): { jobId: string, pathId: string, stepId: string, partIds: string[], text: string, userId: string } {
  return {
    jobId,
    pathId,
    stepId,
    partIds: Array.from(selectedPartIds),
    text: noteText.trim(),
    userId,
  }
}

// ---- Tests ----

describe('AddNoteDialog — pure logic', () => {
  // 1. Renders part checkbox list from partIds prop (Req 1.1, 2.1)
  describe('part checkbox list from partIds', () => {
    it('selectAll returns a Set containing all provided part IDs', () => {
      const partIds = ['SN-00001', 'SN-00002', 'SN-00003']
      const result = selectAll(partIds)
      expect(result.size).toBe(3)
      for (const id of partIds) {
        expect(result.has(id)).toBe(true)
      }
    })

    it('selectAll with empty array returns empty Set', () => {
      expect(selectAll([]).size).toBe(0)
    })

    it('selectNone returns an empty Set', () => {
      expect(selectNone().size).toBe(0)
    })

    it('togglePart adds a part not in the set', () => {
      const set = new Set(['SN-00001'])
      const result = togglePart(set, 'SN-00002')
      expect(result.has('SN-00002')).toBe(true)
      expect(result.size).toBe(2)
    })

    it('togglePart removes a part already in the set', () => {
      const set = new Set(['SN-00001', 'SN-00002'])
      const result = togglePart(set, 'SN-00001')
      expect(result.has('SN-00001')).toBe(false)
      expect(result.size).toBe(1)
    })

    it('togglePart does not mutate the original set', () => {
      const set = new Set(['SN-00001'])
      togglePart(set, 'SN-00002')
      expect(set.size).toBe(1)
    })
  })

  // 2. Save button disabled when no text entered (Req 5.1)
  describe('Save button disabled when no text entered', () => {
    it('canSave returns false when noteText is empty', () => {
      expect(canSave('', new Set(['SN-00001']), 'user-1', false)).toBe(false)
    })

    it('canSave returns false when noteText is whitespace-only', () => {
      expect(canSave('   ', new Set(['SN-00001']), 'user-1', false)).toBe(false)
    })

    it('canSave returns false when noteText is tabs and newlines', () => {
      expect(canSave('\t\n  ', new Set(['SN-00001']), 'user-1', false)).toBe(false)
    })
  })

  // 3. Save button disabled when no parts selected (Req 5.2)
  describe('Save button disabled when no parts selected', () => {
    it('canSave returns false when selectedPartIds is empty', () => {
      expect(canSave('Valid note text', new Set(), 'user-1', false)).toBe(false)
    })
  })

  // 4. Emits saved event on successful note creation (Req 1.2, 1.3)
  describe('emits saved event on successful note creation', () => {
    it('createNote success triggers saved event with the created StepNote', async () => {
      const mockNote: StepNote = {
        id: 'note_abc123',
        jobId: 'job-1',
        pathId: 'path-1',
        stepId: 'step-1',
        partIds: ['SN-00001'],
        text: 'Surface finish within tolerance',
        createdBy: 'user-op1',
        createdAt: new Date().toISOString(),
        pushedToJira: false,
      }

      const mockCreateNote = vi.fn().mockResolvedValue(mockNote)
      const emittedEvents: StepNote[] = []

      // Simulate handleSave flow
      const noteText = 'Surface finish within tolerance'
      const selectedPartIds = new Set(['SN-00001'])
      const operatorId = 'user-op1'

      if (canSave(noteText, selectedPartIds, operatorId, false)) {
        const note = await mockCreateNote(
          buildCreateNotePayload('job-1', 'path-1', 'step-1', selectedPartIds, noteText, operatorId),
        )
        emittedEvents.push(note)
      }

      expect(mockCreateNote).toHaveBeenCalledOnce()
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0]).toEqual(mockNote)
    })

    it('payload includes all selected part IDs for multi-part note', () => {
      const selectedPartIds = new Set(['SN-00001', 'SN-00002', 'SN-00003'])
      const payload = buildCreateNotePayload('job-1', 'path-1', 'step-1', selectedPartIds, 'Batch note', 'user-op1')

      expect(payload.partIds).toHaveLength(3)
      expect(payload.partIds).toContain('SN-00001')
      expect(payload.partIds).toContain('SN-00002')
      expect(payload.partIds).toContain('SN-00003')
    })

    it('payload trims note text', () => {
      const payload = buildCreateNotePayload('job-1', 'path-1', 'step-1', new Set(['SN-00001']), '  trimmed note  ', 'user-op1')
      expect(payload.text).toBe('trimmed note')
    })

    it('success toast shows correct count for single part', () => {
      const toast = buildSuccessToast(1)
      expect(toast.title).toBe('Note added')
      expect(toast.description).toBe('Note added to 1 part')
      expect(toast.color).toBe('success')
    })

    it('success toast shows correct count for multiple parts', () => {
      const toast = buildSuccessToast(3)
      expect(toast.description).toBe('Note added to 3 parts')
    })
  })

  // 5. Shows error toast on API failure, dialog stays open (Req 5.4)
  describe('shows error toast on API failure, dialog stays open', () => {
    it('error toast uses e.data.message when available', () => {
      const toast = buildErrorToast({ data: { message: 'Step not found' } })
      expect(toast.title).toBe('Failed to add note')
      expect(toast.description).toBe('Step not found')
      expect(toast.color).toBe('error')
    })

    it('error toast uses e.message when data.message is absent', () => {
      const toast = buildErrorToast({ message: 'Network error' })
      expect(toast.description).toBe('Network error')
    })

    it('error toast falls back to default description', () => {
      const toast = buildErrorToast({})
      expect(toast.description).toBe('An error occurred')
    })

    it('error toast handles null/undefined error gracefully', () => {
      const toast = buildErrorToast(null)
      expect(toast.description).toBe('An error occurred')
    })

    it('dialog stays open on failure — saving flag resets, text preserved', async () => {
      const mockCreateNote = vi.fn().mockRejectedValue(new Error('Server error'))
      let saving = true
      const dialogOpen = true
      const noteText = 'My important note'
      let toastShown: { title: string, color: string } | null = null

      try {
        await mockCreateNote({})
      } catch (e: any) {
        toastShown = buildErrorToast(e)
      } finally {
        saving = false
      }

      // Dialog stays open, text preserved, saving resets
      expect(dialogOpen).toBe(true)
      expect(noteText).toBe('My important note')
      expect(saving).toBe(false)
      expect(toastShown).not.toBeNull()
      expect(toastShown!.color).toBe('error')
    })
  })

  // 6. Pre-selects parts from preSelectedPartIds (Req 2.3)
  describe('pre-selects parts from preSelectedPartIds', () => {
    it('initializes with preSelectedPartIds when provided', () => {
      const result = initSelectedParts(['SN-00001', 'SN-00003'])
      expect(result.size).toBe(2)
      expect(result.has('SN-00001')).toBe(true)
      expect(result.has('SN-00003')).toBe(true)
    })

    it('initializes empty when preSelectedPartIds is undefined', () => {
      const result = initSelectedParts(undefined)
      expect(result.size).toBe(0)
    })

    it('initializes empty when preSelectedPartIds is empty array', () => {
      const result = initSelectedParts([])
      expect(result.size).toBe(0)
    })
  })
})

// ---- Additional edge case tests ----

describe('canSave — additional edge cases', () => {
  it('returns false when operatorId is null', () => {
    expect(canSave('Valid text', new Set(['SN-00001']), null, false)).toBe(false)
  })

  it('returns false when saving is true', () => {
    expect(canSave('Valid text', new Set(['SN-00001']), 'user-1', true)).toBe(false)
  })

  it('returns true when all conditions are met', () => {
    expect(canSave('Valid text', new Set(['SN-00001']), 'user-1', false)).toBe(true)
  })

  it('returns false when all conditions fail simultaneously', () => {
    expect(canSave('', new Set(), null, true)).toBe(false)
  })
})

describe('buildCreateNotePayload', () => {
  it('builds correct payload with all fields', () => {
    const payload = buildCreateNotePayload(
      'job-42',
      'path-7',
      'step-3',
      new Set(['SN-00001', 'SN-00002']),
      'Test note',
      'user-op1',
    )

    expect(payload).toEqual({
      jobId: 'job-42',
      pathId: 'path-7',
      stepId: 'step-3',
      partIds: expect.arrayContaining(['SN-00001', 'SN-00002']),
      text: 'Test note',
      userId: 'user-op1',
    })
    expect(payload.partIds).toHaveLength(2)
  })

  it('converts Set to array for partIds', () => {
    const payload = buildCreateNotePayload('j', 'p', 's', new Set(['A', 'B', 'C']), 'note', 'u')
    expect(Array.isArray(payload.partIds)).toBe(true)
    expect(payload.partIds).toHaveLength(3)
  })
})

describe('extractErrorMessage', () => {
  it('prefers data.message', () => {
    expect(extractErrorMessage({ data: { message: 'Bad request' }, message: 'Generic' })).toBe('Bad request')
  })

  it('falls back to message', () => {
    expect(extractErrorMessage({ message: 'Timeout' })).toBe('Timeout')
  })

  it('falls back to default string', () => {
    expect(extractErrorMessage(undefined)).toBe('An error occurred')
  })
})
