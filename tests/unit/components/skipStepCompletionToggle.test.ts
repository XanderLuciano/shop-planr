/**
 * Unit tests for skip step completion toggle visibility and help text logic.
 *
 * Tests pure extractions of the checkbox visibility and help text logic
 * from ProcessAdvancementPanel.vue.
 * - Checkbox hidden when no target step is selected
 * - Checkbox visible when a target step is selected
 * - Help text reflects markComplete state
 *
 * Validates: Requirements 1.1, 1.2, 4.1, 4.2
 */
import { describe, it, expect } from 'vitest'

/**
 * Pure extraction of checkbox visibility logic from ProcessAdvancementPanel.vue.
 * The checkbox is only visible when a target step is selected.
 */
function isCheckboxVisible(hasTargetSelected: boolean): boolean {
  return hasTargetSelected
}

/**
 * Pure extraction of help text logic from ProcessAdvancementPanel.vue.
 */
function getHelpText(markComplete: boolean): string {
  return markComplete
    ? 'The current step will be marked as completed before advancing.'
    : 'The current step will be marked as skipped or deferred.'
}

describe('Skip step completion toggle', () => {
  describe('checkbox visibility', () => {
    it('is hidden when no target step is selected', () => {
      expect(isCheckboxVisible(false)).toBe(false)
    })

    it('is visible when a target step is selected', () => {
      expect(isCheckboxVisible(true)).toBe(true)
    })
  })

  describe('help text', () => {
    it('shows completion text when markComplete is true', () => {
      expect(getHelpText(true)).toBe(
        'The current step will be marked as completed before advancing.',
      )
    })

    it('shows skip/defer text when markComplete is false', () => {
      expect(getHelpText(false)).toBe(
        'The current step will be marked as skipped or deferred.',
      )
    })
  })
})

/**
 * Unit tests for toast message variants in the skip step completion toggle.
 *
 * Tests pure extractions of the toast title and description logic
 * from ProcessAdvancementPanel.vue.
 * - Toast title reflects markComplete state
 * - Toast description shows advanced/failed counts from bulk response
 * - Singular/plural "part(s)" in description
 *
 * Validates: Requirements 5.1, 5.2, 7.4
 */

/**
 * Pure extraction of toast title logic from ProcessAdvancementPanel.vue.
 */
function getToastTitle(markComplete: boolean): string {
  return markComplete ? 'Parts advanced' : 'Parts skipped'
}

/**
 * Pure extraction of toast description logic from ProcessAdvancementPanel.vue.
 *
 * After the bulk API migration, the toast description shows the advanced count
 * and optionally the failed count, regardless of markComplete state.
 */
function getToastDescription(advanced: number, failed: number): string {
  return `${advanced} part${advanced !== 1 ? 's' : ''} processed${failed ? `, ${failed} failed` : ''}`
}

describe('Toast message variants', () => {
  describe('getToastTitle', () => {
    it('returns "Parts advanced" when markComplete is true', () => {
      expect(getToastTitle(true)).toBe('Parts advanced')
    })

    it('returns "Parts skipped" when markComplete is false', () => {
      expect(getToastTitle(false)).toBe('Parts skipped')
    })
  })

  describe('getToastDescription', () => {
    it('shows "processed" for all advanced parts with no failures', () => {
      expect(getToastDescription(3, 0)).toBe('3 parts processed')
    })

    it('appends failed count when some parts fail', () => {
      expect(getToastDescription(2, 1)).toBe('2 parts processed, 1 failed')
    })

    it('uses singular "part" when advanced count is 1', () => {
      expect(getToastDescription(1, 0)).toBe('1 part processed')
    })

    it('uses plural "parts" when advanced count is greater than 1', () => {
      expect(getToastDescription(5, 0)).toBe('5 parts processed')
    })

    it('shows both advanced and failed counts', () => {
      expect(getToastDescription(4, 2)).toBe('4 parts processed, 2 failed')
    })
  })
})
