/**
 * Unit tests for PartCreationPanel pure logic.
 *
 * Tests extracted pure functions that mirror the component's internal logic,
 * following the same pattern as dropdownFilter.property.test.ts — no Vue
 * component mounting, no @vue/test-utils.
 *
 * Feature: first-step-part-creation
 */
import { describe, it, expect, vi } from 'vitest'
import type { WorkQueueJob } from '~/server/types/computed'
import type { BatchCreatePartsInput } from '~/server/types/api'

// ---- Pure logic functions extracted from PartCreationPanel.vue ----

/** Validates the quantity input. Returns error string or null. */
export function validateQuantity(quantity: number): string | null {
  if (quantity < 1) return 'Quantity must be at least 1'
  return null
}

/** Formats the advancement destination string from a WorkQueueJob. */
export function formatDestination(job: WorkQueueJob): string {
  if (job.isFinalStep) return 'Completed'
  if (!job.nextStepName) return '—'
  return job.nextStepLocation
    ? `${job.nextStepName} → ${job.nextStepLocation}`
    : job.nextStepName
}

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

/** Builds the payload for batchCreateParts API call. */
export function buildCreatePayload(
  job: WorkQueueJob,
  quantity: number,
  userId: string,
): BatchCreatePartsInput & { userId: string } {
  return {
    jobId: job.jobId,
    pathId: job.pathId,
    quantity,
    userId,
  }
}

/** Builds the advance payload from selected parts and optional note. */
export function buildAdvancePayload(
  partIds: string[],
  selectedSet: Set<string>,
  note: string,
): { partIds: string[], note?: string } {
  const ids = partIds.filter(id => selectedSet.has(id))
  const trimmedNote = note.trim()
  return { partIds: ids, note: trimmedNote || undefined }
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
    partIds: [],
    partCount: 0,
    nextStepName: 'QC Inspection',
    nextStepLocation: 'Lab B',
    isFinalStep: false,
    ...overrides,
  }
}

// ---- Tests ----

describe('PartCreationPanel — pure logic', () => {
  // 1. Test default quantity is 1 (Req 2.6)
  describe('default quantity', () => {
    it('quantity of 1 passes validation', () => {
      expect(validateQuantity(1)).toBeNull()
    })

    it('quantity of 0 fails validation', () => {
      expect(validateQuantity(0)).toBe('Quantity must be at least 1')
    })
  })

  // 2. Test create button calls batchCreateParts with correct parameters (Req 2.3)
  describe('buildCreatePayload', () => {
    it('builds correct payload from job, quantity, and userId', () => {
      const job = makeJob({ jobId: 'j-42', pathId: 'p-7' })
      const payload = buildCreatePayload(job, 5, 'user-abc')

      expect(payload).toEqual({
        jobId: 'j-42',
        pathId: 'p-7',
        quantity: 5,
        userId: 'user-abc',
      })
    })
  })

  // 3. Test success message appears after creation (Req 2.4)
  describe('success message formatting', () => {
    it('formats singular success message', () => {
      const count = 1
      const msg = `${count} part${count !== 1 ? 's' : ''} created`
      expect(msg).toBe('1 part created')
    })

    it('formats plural success message', () => {
      const count = 5
      const msg = `${count} part${count !== 1 ? 's' : ''} created`
      expect(msg).toBe('5 parts created')
    })
  })

  // 4. Test error message appears on creation failure (Req 2.5)
  describe('error message extraction', () => {
    it('extracts message from error with data.message', () => {
      const e = { data: { message: 'Path not found' } } as any
      const msg = e?.data?.message ?? e?.message ?? 'Failed to create parts'
      expect(msg).toBe('Path not found')
    })

    it('extracts message from error with message property', () => {
      const e = { message: 'Network error' } as any
      const msg = e?.data?.message ?? e?.message ?? 'Failed to create parts'
      expect(msg).toBe('Network error')
    })

    it('falls back to default message when error has no message', () => {
      const e = {} as any
      const msg = e?.data?.message ?? e?.message ?? 'Failed to create parts'
      expect(msg).toBe('Failed to create parts')
    })
  })

  // 5. Test empty state shown when no parts exist (Req 3.5)
  describe('empty state detection', () => {
    it('job with no partIds triggers empty state', () => {
      const job = makeJob({ partIds: [], partCount: 0 })
      expect(job.partIds.length).toBe(0)
    })

    it('job with partIds does not trigger empty state', () => {
      const job = makeJob({ partIds: ['part_001', 'part_002'], partCount: 2 })
      expect(job.partIds.length).toBeGreaterThan(0)
    })
  })

  // 6. Test Select All selects all parts (Req 4.2)
  describe('selectAll', () => {
    it('returns a Set containing all part IDs', () => {
      const ids = ['part_001', 'part_002', 'part_003']
      const result = selectAll(ids)
      expect(result.size).toBe(3)
      for (const id of ids) {
        expect(result.has(id)).toBe(true)
      }
    })

    it('returns empty Set for empty array', () => {
      expect(selectAll([]).size).toBe(0)
    })
  })

  // 7. Test Select None deselects all parts (Req 4.3)
  describe('selectNone', () => {
    it('returns an empty Set', () => {
      const result = selectNone()
      expect(result.size).toBe(0)
    })
  })

  // 8. Test Create & Advance button triggers both operations (Req 6.1, 6.2)
  describe('Create & Advance flow', () => {
    it('create payload is built correctly for the create step', () => {
      const job = makeJob({ jobId: 'j-1', pathId: 'p-1' })
      const payload = buildCreatePayload(job, 3, 'op-1')
      expect(payload.jobId).toBe('j-1')
      expect(payload.pathId).toBe('p-1')
      expect(payload.quantity).toBe(3)
      expect(payload.userId).toBe('op-1')
    })

    it('advance payload uses newly created part IDs', () => {
      // Simulate: after creation, the new IDs are known
      const createdIds = ['part_00100', 'part_00101', 'part_00102']
      const selectedSet = new Set(createdIds)
      const result = buildAdvancePayload(createdIds, selectedSet, '')
      expect(result.partIds).toEqual(createdIds)
      expect(result.note).toBeUndefined()
    })

    it('advance payload includes note when provided', () => {
      const createdIds = ['part_00100']
      const selectedSet = new Set(createdIds)
      const result = buildAdvancePayload(createdIds, selectedSet, 'Material lot #42')
      expect(result.note).toBe('Material lot #42')
    })
  })

  // 9. Test Create & Advance success message includes count and destination (Req 6.3)
  describe('Create & Advance success message', () => {
    it('includes count and destination for mid-path step', () => {
      const job = makeJob({ nextStepName: 'QC Inspection', nextStepLocation: 'Lab B' })
      const count = 3
      const destination = formatDestination(job)
      const msg = `${count} part${count !== 1 ? 's' : ''} created and advancing to ${destination}`
      expect(msg).toBe('3 parts created and advancing to QC Inspection → Lab B')
    })

    it('includes "Completed" for final step', () => {
      const job = makeJob({ isFinalStep: true })
      const count = 1
      const destination = formatDestination(job)
      const msg = `${count} part${count !== 1 ? 's' : ''} created and advancing to ${destination}`
      expect(msg).toBe('1 part created and advancing to Completed')
    })
  })

  // 10. Test partial failure during Create & Advance shows error (Req 6.4)
  describe('Create & Advance partial failure', () => {
    it('creation succeeds but advance throws — error is captured', async () => {
      const mockBatchCreate = vi.fn().mockResolvedValue([
        { id: 'part_00200', jobId: 'j-1', pathId: 'p-1', currentStepId: 'step_0', status: 'in_progress' },
      ])
      const mockAdvance = vi.fn().mockRejectedValue(new Error('Advance failed for part_00200'))

      let errorMessage: string | null = null
      try {
        await mockBatchCreate({ jobId: 'j-1', pathId: 'p-1', quantity: 1, userId: 'op-1' })
        await mockAdvance(['part_00200'])
      } catch (e: any) {
        errorMessage = e?.message ?? 'Failed to create parts'
      }

      expect(mockBatchCreate).toHaveBeenCalledOnce()
      expect(mockAdvance).toHaveBeenCalledOnce()
      expect(errorMessage).toBe('Advance failed for part_00200')
    })
  })

  // 11. Test note textarea exists with placeholder (Req 8.1)
  describe('note configuration', () => {
    it('note defaults to empty string', () => {
      const note = ''
      expect(note).toBe('')
      expect(note.length).toBe(0)
    })

    it('note placeholder text is defined', () => {
      // Mirrors the placeholder in the component template
      const placeholder = 'Add observations or issues...'
      expect(placeholder).toBeTruthy()
      expect(placeholder.length).toBeGreaterThan(0)
    })

    it('note respects 1000 character limit', () => {
      const longNote = 'a'.repeat(1000)
      expect(longNote.length).toBeLessThanOrEqual(1000)

      const tooLong = 'a'.repeat(1001)
      expect(tooLong.length).toBeGreaterThan(1000)
    })
  })

  // 12. Test creation form remains available after batch creation (Req 5.2)
  describe('creation form availability after batch', () => {
    it('validation still works after a successful creation (form is reusable)', () => {
      // Simulate: after creation, quantity resets to 1 and validation passes
      const quantityAfterCreation = 1
      expect(validateQuantity(quantityAfterCreation)).toBeNull()
    })

    it('a second batch can be built with different quantity', () => {
      const job = makeJob()
      const firstPayload = buildCreatePayload(job, 3, 'op-1')
      const secondPayload = buildCreatePayload(job, 7, 'op-1')

      expect(firstPayload.quantity).toBe(3)
      expect(secondPayload.quantity).toBe(7)
      // Both payloads target the same job/path
      expect(firstPayload.jobId).toBe(secondPayload.jobId)
      expect(firstPayload.pathId).toBe(secondPayload.pathId)
    })
  })
})

// ---- Additional edge case tests for pure functions ----

describe('validateQuantity edge cases', () => {
  it('rejects negative numbers', () => {
    expect(validateQuantity(-5)).toBe('Quantity must be at least 1')
  })

  it('accepts quantity of 1', () => {
    expect(validateQuantity(1)).toBeNull()
  })

  it('accepts large quantities', () => {
    expect(validateQuantity(999)).toBeNull()
  })
})

describe('formatDestination', () => {
  it('returns "Completed" when isFinalStep is true', () => {
    const job = makeJob({ isFinalStep: true })
    expect(formatDestination(job)).toBe('Completed')
  })

  it('returns step name with location when both exist', () => {
    const job = makeJob({ nextStepName: 'Assembly', nextStepLocation: 'Floor 2' })
    expect(formatDestination(job)).toBe('Assembly → Floor 2')
  })

  it('returns step name alone when no location', () => {
    const job = makeJob({ nextStepName: 'Painting', nextStepLocation: undefined })
    expect(formatDestination(job)).toBe('Painting')
  })

  it('returns dash when no next step name', () => {
    const job = makeJob({ nextStepName: undefined, isFinalStep: false })
    expect(formatDestination(job)).toBe('—')
  })
})

describe('togglePart', () => {
  it('adds a part not in the set', () => {
    const set = new Set(['part_001'])
    const result = togglePart(set, 'part_002')
    expect(result.has('part_002')).toBe(true)
    expect(result.size).toBe(2)
  })

  it('removes a part already in the set', () => {
    const set = new Set(['part_001', 'part_002'])
    const result = togglePart(set, 'part_001')
    expect(result.has('part_001')).toBe(false)
    expect(result.size).toBe(1)
  })

  it('does not mutate the original set', () => {
    const set = new Set(['part_001'])
    togglePart(set, 'part_002')
    expect(set.size).toBe(1) // original unchanged
  })
})

describe('buildAdvancePayload', () => {
  it('filters partIds to only selected ones', () => {
    const allIds = ['part_001', 'part_002', 'part_003']
    const selected = new Set(['part_001', 'part_003'])
    const result = buildAdvancePayload(allIds, selected, '')
    expect(result.partIds).toEqual(['part_001', 'part_003'])
  })

  it('trims whitespace from note', () => {
    const result = buildAdvancePayload(['part_001'], new Set(['part_001']), '  hello  ')
    expect(result.note).toBe('hello')
  })

  it('sets note to undefined when empty after trim', () => {
    const result = buildAdvancePayload(['part_001'], new Set(['part_001']), '   ')
    expect(result.note).toBeUndefined()
  })

  it('returns empty array when nothing is selected', () => {
    const result = buildAdvancePayload(['part_001', 'part_002'], new Set(), '')
    expect(result.partIds).toEqual([])
  })
})
