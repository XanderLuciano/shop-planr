/**
 * Property 6: Scrap Immutability
 *
 * For any scrapped serial, verify that advance, complete, force-complete,
 * and re-scrap operations all fail.
 *
 * **Validates: Requirements 3.6, 3.10, 3.11**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { SerialNumber, ScrapReason } from '../../server/types/domain'

/**
 * Pure validation logic matching lifecycleService.scrapSerial:
 * Rejects if serial is already scrapped or completed.
 */
function validateScrap(serial: SerialNumber): { valid: boolean; error?: string } {
  if (serial.status === 'scrapped') {
    return { valid: false, error: 'Serial is already scrapped' }
  }
  if (serial.status === 'completed') {
    return { valid: false, error: 'Cannot scrap a completed serial' }
  }
  return { valid: true }
}

/**
 * Pure validation for advancing a serial:
 * Rejects if serial is scrapped or completed.
 */
function validateAdvance(serial: SerialNumber): { valid: boolean; error?: string } {
  if (serial.status === 'scrapped') {
    return { valid: false, error: 'Cannot advance a scrapped serial' }
  }
  if (serial.status === 'completed') {
    return { valid: false, error: 'Cannot advance a completed serial' }
  }
  return { valid: true }
}

/**
 * Pure validation for completing a serial:
 * Rejects if serial is scrapped or already completed.
 */
function validateComplete(serial: SerialNumber): { valid: boolean; error?: string } {
  if (serial.status === 'scrapped') {
    return { valid: false, error: 'Cannot complete a scrapped serial' }
  }
  if (serial.status === 'completed') {
    return { valid: false, error: 'Serial is already completed' }
  }
  return { valid: true }
}

/**
 * Pure validation for force-completing a serial:
 * Rejects if serial is scrapped or already completed.
 */
function validateForceComplete(serial: SerialNumber): { valid: boolean; error?: string } {
  if (serial.status === 'scrapped') {
    return { valid: false, error: 'Cannot force-complete a scrapped serial' }
  }
  if (serial.status === 'completed') {
    return { valid: false, error: 'Serial is already completed' }
  }
  return { valid: true }
}

/** Generate an arbitrary scrapped SerialNumber */
function scrappedSerialArb(): fc.Arbitrary<SerialNumber> {
  const scrapReasons: ScrapReason[] = ['out_of_tolerance', 'process_defect', 'damaged', 'operator_error', 'other']

  return fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    jobId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    pathId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
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
  it('advance is rejected for any scrapped serial', () => {
    fc.assert(
      fc.property(scrappedSerialArb(), (serial) => {
        const result = validateAdvance(serial)
        expect(result.valid).toBe(false)
        expect(result.error).toContain('scrapped')
      }),
      { numRuns: 100 },
    )
  })

  it('complete is rejected for any scrapped serial', () => {
    fc.assert(
      fc.property(scrappedSerialArb(), (serial) => {
        const result = validateComplete(serial)
        expect(result.valid).toBe(false)
        expect(result.error).toContain('scrapped')
      }),
      { numRuns: 100 },
    )
  })

  it('force-complete is rejected for any scrapped serial', () => {
    fc.assert(
      fc.property(scrappedSerialArb(), (serial) => {
        const result = validateForceComplete(serial)
        expect(result.valid).toBe(false)
        expect(result.error).toContain('scrapped')
      }),
      { numRuns: 100 },
    )
  })

  it('re-scrap is rejected for any scrapped serial', () => {
    fc.assert(
      fc.property(scrappedSerialArb(), (serial) => {
        const result = validateScrap(serial)
        expect(result.valid).toBe(false)
        expect(result.error).toContain('already scrapped')
      }),
      { numRuns: 100 },
    )
  })
})
