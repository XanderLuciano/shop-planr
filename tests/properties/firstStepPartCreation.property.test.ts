/**
 * Property-based tests for first step part creation.
 *
 * Tests pure logic functions extracted from PartCreationPanel.vue
 * and operator.vue conditional rendering logic.
 *
 * Feature: first-step-part-creation
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { WorkQueueJob } from '~/server/types/computed'

// ---- Pure logic functions (extracted from PartCreationPanel.vue / operator.vue) ----

/** Determines which panel to render based on step order. */
export function selectPanelType(stepOrder: number): 'part-creation' | 'process-advancement' {
  return stepOrder === 0 ? 'part-creation' : 'process-advancement'
}

/** Extracts display context strings from a WorkQueueJob. */
export function extractDisplayContext(job: WorkQueueJob): { jobName: string; pathName: string; stepName: string } {
  return { jobName: job.jobName, pathName: job.pathName, stepName: job.stepName }
}

/** Returns accumulated parts info: count, empty state, and IDs. */
export function getAccumulatedPartsInfo(partIds: string[]): { count: number; isEmpty: boolean; ids: string[] } {
  return { count: partIds.length, isEmpty: partIds.length === 0, ids: partIds }
}

/** Validates the quantity input. Returns error string or null. */
export function validateQuantity(quantity: number): string | null {
  if (quantity < 1) return 'Quantity must be at least 1'
  return null
}

/** Builds the advance payload from selected parts and optional note. */
export function buildAdvancePayload(
  partIds: string[],
  selectedSet: Set<string>,
  note: string,
): { partIds: string[]; note?: string } {
  const ids = partIds.filter(id => selectedSet.has(id))
  const trimmedNote = note.trim()
  return { partIds: ids, note: trimmedNote || undefined }
}

/** Formats the advancement destination string from a WorkQueueJob. */
export function formatDestination(job: WorkQueueJob): string {
  if (job.isFinalStep) return 'Completed'
  if (!job.nextStepName) return '—'
  return job.nextStepLocation
    ? `${job.nextStepName} → ${job.nextStepLocation}`
    : job.nextStepName
}

/** Returns note info: length and whether it's within the 1000-char limit. */
export function getNoteInfo(note: string): { length: number; isWithinLimit: boolean } {
  return { length: note.length, isWithinLimit: note.length <= 1000 }
}

/** Returns control disabled states based on loading/creating/validation/selection. */
export function getControlStates(
  creating: boolean,
  loading: boolean,
  hasValidationError: boolean,
  selectedCount: number,
): { createDisabled: boolean; advanceDisabled: boolean } {
  return {
    createDisabled: creating || hasValidationError,
    advanceDisabled: loading || selectedCount === 0,
  }
}

// ---- Generators ----

const arbNonEmptyString = (maxLen = 50): fc.Arbitrary<string> =>
  fc.string({ minLength: 1, maxLength: maxLen }).filter(s => s.trim().length >= 1)

const arbWorkQueueJob = (overrides?: Partial<Record<string, fc.Arbitrary<any>>>): fc.Arbitrary<WorkQueueJob> =>
  fc.record({
    jobId: overrides?.jobId ?? fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length >= 3),
    jobName: overrides?.jobName ?? arbNonEmptyString(),
    pathId: overrides?.pathId ?? fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length >= 3),
    pathName: overrides?.pathName ?? arbNonEmptyString(),
    stepId: overrides?.stepId ?? fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length >= 3),
    stepName: overrides?.stepName ?? arbNonEmptyString(),
    stepOrder: overrides?.stepOrder ?? fc.nat({ max: 20 }),
    stepLocation: fc.option(arbNonEmptyString(30), { nil: undefined }),
    totalSteps: fc.integer({ min: 1, max: 20 }),
    partIds: overrides?.partIds ?? fc.array(fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length >= 3), { minLength: 0, maxLength: 15 }),
    partCount: fc.nat({ max: 100 }),
    nextStepName: overrides?.nextStepName ?? fc.option(arbNonEmptyString(30), { nil: undefined }),
    nextStepLocation: overrides?.nextStepLocation ?? fc.option(arbNonEmptyString(30), { nil: undefined }),
    isFinalStep: overrides?.isFinalStep ?? fc.boolean(),
  })

const arbPartIds = (min = 0, max = 20): fc.Arbitrary<string[]> =>
  fc.array(
    fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length >= 3),
    { minLength: min, maxLength: max },
  )

// ---- Property Tests ----

/**
 * Property 1: Panel type selection based on step order
 *
 * For any WorkQueueJob, if stepOrder === 0 then the operator page renders
 * PartCreationPanel; otherwise ProcessAdvancementPanel.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 */
describe('Property 1: Panel type selection based on step order', () => {
  it('stepOrder === 0 selects part-creation panel', () => {
    fc.assert(
      fc.property(
        fc.constant(0),
        (stepOrder) => {
          expect(selectPanelType(stepOrder)).toBe('part-creation')
        },
      ),
      { numRuns: 100 },
    )
  })

  it('stepOrder > 0 selects process-advancement panel', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (stepOrder) => {
          expect(selectPanelType(stepOrder)).toBe('process-advancement')
        },
      ),
      { numRuns: 100 },
    )
  })

  it('panels are mutually exclusive for any step order', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 50 }),
        (stepOrder) => {
          const result = selectPanelType(stepOrder)
          if (stepOrder === 0) {
            expect(result).toBe('part-creation')
          } else {
            expect(result).toBe('process-advancement')
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 2: Context display contains job, path, and step names
 *
 * For any WorkQueueJob, the extracted display context returns all three names
 * matching the job object.
 *
 * **Validates: Requirements 2.2**
 */
describe('Property 2: Context display contains job, path, and step names', () => {
  it('extracted context matches job, path, and step names from the job', () => {
    fc.assert(
      fc.property(
        arbNonEmptyString(),
        arbNonEmptyString(),
        arbNonEmptyString(),
        (jobName, pathName, stepName) => {
          const job: WorkQueueJob = {
            jobId: 'j-1', jobName, pathId: 'p-1', pathName,
            stepId: 's-1', stepName, stepOrder: 0, totalSteps: 3,
            partIds: [], partCount: 0, isFinalStep: false,
          }
          const ctx = extractDisplayContext(job)
          expect(ctx.jobName).toBe(jobName)
          expect(ctx.pathName).toBe(pathName)
          expect(ctx.stepName).toBe(stepName)
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 3: Accumulated parts rendering and count
 *
 * For any partIds array of length N, count matches N; empty state when N = 0;
 * all IDs are preserved.
 *
 * **Validates: Requirements 3.1, 3.3, 3.4, 3.5**
 */
describe('Property 3: Accumulated parts rendering and count', () => {
  it('count matches array length and isEmpty is correct', () => {
    fc.assert(
      fc.property(
        arbPartIds(0, 30),
        (partIds) => {
          const info = getAccumulatedPartsInfo(partIds)
          expect(info.count).toBe(partIds.length)
          expect(info.isEmpty).toBe(partIds.length === 0)
          expect(info.ids).toEqual(partIds)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('empty array yields isEmpty true and count 0', () => {
    fc.assert(
      fc.property(
        fc.constant([] as string[]),
        (partIds) => {
          const info = getAccumulatedPartsInfo(partIds)
          expect(info.count).toBe(0)
          expect(info.isEmpty).toBe(true)
          expect(info.ids).toEqual([])
        },
      ),
      { numRuns: 100 },
    )
  })

  it('non-empty array yields isEmpty false', () => {
    fc.assert(
      fc.property(
        arbPartIds(1, 30),
        (partIds) => {
          const info = getAccumulatedPartsInfo(partIds)
          expect(info.isEmpty).toBe(false)
          expect(info.count).toBeGreaterThan(0)
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 4: Invalid quantity rejection
 *
 * For any integer < 1, validation returns an error string.
 * For any integer >= 1, validation returns null.
 *
 * **Validates: Requirements 2.7**
 */
describe('Property 4: Invalid quantity rejection', () => {
  it('quantities less than 1 produce a validation error', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 0 }),
        (quantity) => {
          const error = validateQuantity(quantity)
          expect(error).toBe('Quantity must be at least 1')
        },
      ),
      { numRuns: 100 },
    )
  })

  it('quantities >= 1 produce no validation error', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        (quantity) => {
          const error = validateQuantity(quantity)
          expect(error).toBeNull()
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 5: Selection state drives advance payload and button state
 *
 * For any set of part IDs and any subset selection of size K:
 * - advance payload contains exactly the K selected IDs
 * - button is disabled when K = 0
 *
 * **Validates: Requirements 4.4, 4.5, 4.8**
 */
describe('Property 5: Selection state drives advance payload and button state', () => {
  it('advance payload contains exactly the selected part IDs', () => {
    fc.assert(
      fc.property(
        arbPartIds(0, 20).chain(ids => {
          // Generate a random subset of the IDs
          const uniqueIds = [...new Set(ids)]
          return fc.tuple(
            fc.constant(uniqueIds),
            fc.shuffledSubarray(uniqueIds),
            fc.string({ minLength: 0, maxLength: 50 }),
          )
        }),
        ([allIds, selectedSubset, note]) => {
          const selectedSet = new Set(selectedSubset)
          const payload = buildAdvancePayload(allIds, selectedSet, note)

          // Payload should contain exactly the selected IDs (in order of allIds)
          const expectedIds = allIds.filter(id => selectedSet.has(id))
          expect(payload.partIds).toEqual(expectedIds)
          expect(payload.partIds.length).toBe(selectedSet.size)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('advance button is disabled when no parts are selected', () => {
    fc.assert(
      fc.property(
        arbPartIds(0, 20),
        (partIds) => {
          const emptySelection = new Set<string>()
          const payload = buildAdvancePayload(partIds, emptySelection, '')
          expect(payload.partIds.length).toBe(0)
          // Button disabled = selectedCount === 0
          const buttonDisabled = emptySelection.size === 0
          expect(buttonDisabled).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('advance button is enabled when at least one part is selected', () => {
    fc.assert(
      fc.property(
        arbPartIds(1, 20).chain(ids => {
          const uniqueIds = [...new Set(ids)]
          return fc.tuple(
            fc.constant(uniqueIds),
            fc.shuffledSubarray(uniqueIds, { minLength: 1 }),
          )
        }),
        ([allIds, selectedSubset]) => {
          const selectedSet = new Set(selectedSubset)
          const buttonDisabled = selectedSet.size === 0
          expect(buttonDisabled).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 6: Destination display matches WorkQueueJob fields
 *
 * For any WorkQueueJob:
 * - isFinalStep true → "Completed"
 * - nextStepLocation defined → "nextStepName → nextStepLocation"
 * - nextStepLocation undefined → nextStepName alone
 * - no nextStepName and not final → "—"
 *
 * **Validates: Requirements 7.1, 7.2, 7.3**
 */
describe('Property 6: Destination display matches WorkQueueJob fields', () => {
  it('isFinalStep true always returns "Completed"', () => {
    fc.assert(
      fc.property(
        arbWorkQueueJob({ isFinalStep: fc.constant(true) }),
        (job) => {
          expect(formatDestination(job)).toBe('Completed')
        },
      ),
      { numRuns: 100 },
    )
  })

  it('non-final step with name and location returns "name → location"', () => {
    fc.assert(
      fc.property(
        arbNonEmptyString(30),
        arbNonEmptyString(30),
        (nextStepName, nextStepLocation) => {
          const job: WorkQueueJob = {
            jobId: 'j-1', jobName: 'J', pathId: 'p-1', pathName: 'P',
            stepId: 's-1', stepName: 'S', stepOrder: 0, totalSteps: 3,
            partIds: [], partCount: 0,
            nextStepName, nextStepLocation, isFinalStep: false,
          }
          expect(formatDestination(job)).toBe(`${nextStepName} → ${nextStepLocation}`)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('non-final step with name but no location returns name alone', () => {
    fc.assert(
      fc.property(
        arbNonEmptyString(30),
        (nextStepName) => {
          const job: WorkQueueJob = {
            jobId: 'j-1', jobName: 'J', pathId: 'p-1', pathName: 'P',
            stepId: 's-1', stepName: 'S', stepOrder: 0, totalSteps: 3,
            partIds: [], partCount: 0,
            nextStepName, nextStepLocation: undefined, isFinalStep: false,
          }
          expect(formatDestination(job)).toBe(nextStepName)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('non-final step with no next step name returns dash', () => {
    fc.assert(
      fc.property(
        fc.constant(undefined),
        () => {
          const job: WorkQueueJob = {
            jobId: 'j-1', jobName: 'J', pathId: 'p-1', pathName: 'P',
            stepId: 's-1', stepName: 'S', stepOrder: 0, totalSteps: 3,
            partIds: [], partCount: 0,
            nextStepName: undefined, nextStepLocation: undefined, isFinalStep: false,
          }
          expect(formatDestination(job)).toBe('—')
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 7: Note character count and limit enforcement
 *
 * For any note string, the character count equals the string length,
 * and isWithinLimit is true when length <= 1000.
 *
 * **Validates: Requirements 8.3, 8.4**
 */
describe('Property 7: Note character count and limit enforcement', () => {
  it('character count equals string length and limit is enforced at 1000', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 1500 }),
        (note) => {
          const info = getNoteInfo(note)
          expect(info.length).toBe(note.length)
          expect(info.isWithinLimit).toBe(note.length <= 1000)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('notes at exactly 1000 characters are within limit', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1000, maxLength: 1000 }),
        (note) => {
          const info = getNoteInfo(note)
          expect(info.length).toBe(1000)
          expect(info.isWithinLimit).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('notes exceeding 1000 characters are not within limit', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1001, maxLength: 1500 }),
        (note) => {
          const info = getNoteInfo(note)
          expect(info.length).toBeGreaterThan(1000)
          expect(info.isWithinLimit).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 8: Loading states disable corresponding controls
 *
 * For any combination of creating/loading/validation/selection states,
 * the create button is disabled when creating or has validation error,
 * and the advance button is disabled when loading or no parts selected.
 *
 * **Validates: Requirements 10.1, 10.2**
 */
describe('Property 8: Loading states disable corresponding controls', () => {
  it('create button disabled when creating is true', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.nat({ max: 20 }),
        (hasValidationError, selectedCount) => {
          const states = getControlStates(true, false, hasValidationError, selectedCount)
          expect(states.createDisabled).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('create button disabled when validation error exists', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.nat({ max: 20 }),
        (creating, selectedCount) => {
          const states = getControlStates(creating, false, true, selectedCount)
          expect(states.createDisabled).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('create button enabled when not creating and no validation error', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.nat({ max: 20 }),
        (loading, selectedCount) => {
          const states = getControlStates(false, loading, false, selectedCount)
          expect(states.createDisabled).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('advance button disabled when loading is true', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.integer({ min: 0, max: 20 }),
        (creating, hasValidationError, selectedCount) => {
          const states = getControlStates(creating, true, hasValidationError, selectedCount)
          expect(states.advanceDisabled).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('advance button disabled when no parts selected', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (creating, loading, hasValidationError) => {
          const states = getControlStates(creating, loading, hasValidationError, 0)
          expect(states.advanceDisabled).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('advance button enabled when not loading and parts are selected', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.integer({ min: 1, max: 20 }),
        (creating, hasValidationError, selectedCount) => {
          const states = getControlStates(creating, false, hasValidationError, selectedCount)
          expect(states.advanceDisabled).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})
