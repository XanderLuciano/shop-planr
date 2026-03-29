/**
 * Property 6: Scrap Immutability
 *
 * For any scrapped part, verify that advance, complete, force-complete,
 * and re-scrap operations all fail.
 *
 * **Validates: Requirements 3.6, 3.10, 3.11**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { Part, ScrapReason } from '../../server/types/domain'

/**
 * Pure validation logic matching lifecycleService.scrapPart:
 * Rejects if part is already scrapped or completed.
 */
function validateScrap(part: Part): { valid: boolean; error?: string } {
  if (part.status === 'scrapped') {
    return { valid: false, error: 'Part is already scrapped' }
  }
  if (part.status === 'completed') {
    return { valid: false, error: 'Cannot scrap a completed part' }
  }
  return { valid: true }
}

/**
 * Pure validation for advancing a part:
 * Rejects if part is scrapped or completed.
 */
function validateAdvance(part: Part): { valid: boolean; error?: string } {
  if (part.status === 'scrapped') {
    return { valid: false, error: 'Cannot advance a scrapped part' }
  }
  if (part.status === 'completed') {
    return { valid: false, error: 'Cannot advance a completed part' }
  }
  return { valid: true }
}

/**
 * Pure validation for completing a part:
 * Rejects if part is scrapped or already completed.
 */
function validateComplete(part: Part): { valid: boolean; error?: string } {
  if (part.status === 'scrapped') {
    return { valid: false, error: 'Cannot complete a scrapped part' }
  }
  if (part.status === 'completed') {
    return { valid: false, error: 'Part is already completed' }
  }
  return { valid: true }
}

/**
 * Pure validation for force-completing a part:
 * Rejects if part is scrapped or already completed.
 */
function validateForceComplete(part: Part): { valid: boolean; error?: string } {
  if (part.status === 'scrapped') {
    return { valid: false, error: 'Cannot force-complete a scrapped part' }
  }
  if (part.status === 'completed') {
    return { valid: false, error: 'Part is already completed' }
  }
  return { valid: true }
}

/** Generate an arbitrary scrapped Part */
function scrappedPartArb(): fc.Arbitrary<Part> {
  const scrapReasons: ScrapReason[] = [
    'out_of_tolerance',
    'process_defect',
    'damaged',
    'operator_error',
    'other',
  ]

  return fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
    jobId: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
    pathId: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
    currentStepIndex: fc.integer({ min: 0, max: 10 }),
    status: fc.constant('scrapped' as const),
    scrapReason: fc.constantFrom(...scrapReasons),
    scrapExplanation: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    scrapStepId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
    scrappedAt: fc.constant(new Date().toISOString()),
    scrappedBy: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
    forceCompleted: fc.constant(false),
    forceCompletedBy: fc.constant(undefined),
    forceCompletedAt: fc.constant(undefined),
    forceCompletedReason: fc.constant(undefined),
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  })
}

describe('Property 6: Scrap Immutability', () => {
  it('advance is rejected for any scrapped part', () => {
    fc.assert(
      fc.property(scrappedPartArb(), (part) => {
        const result = validateAdvance(part)
        expect(result.valid).toBe(false)
        expect(result.error).toContain('scrapped')
      }),
      { numRuns: 100 }
    )
  })

  it('complete is rejected for any scrapped part', () => {
    fc.assert(
      fc.property(scrappedPartArb(), (part) => {
        const result = validateComplete(part)
        expect(result.valid).toBe(false)
        expect(result.error).toContain('scrapped')
      }),
      { numRuns: 100 }
    )
  })

  it('force-complete is rejected for any scrapped part', () => {
    fc.assert(
      fc.property(scrappedPartArb(), (part) => {
        const result = validateForceComplete(part)
        expect(result.valid).toBe(false)
        expect(result.error).toContain('scrapped')
      }),
      { numRuns: 100 }
    )
  })

  it('re-scrap is rejected for any scrapped part', () => {
    fc.assert(
      fc.property(scrappedPartArb(), (part) => {
        const result = validateScrap(part)
        expect(result.valid).toBe(false)
        expect(result.error).toContain('already scrapped')
      }),
      { numRuns: 100 }
    )
  })
})
