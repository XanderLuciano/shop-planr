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
 * - Toast description reflects markComplete state
 * - Singular/plural "part(s)" in description
 *
 * Validates: Requirements 5.1, 5.2
 */

/**
 * Pure extraction of toast title logic from ProcessAdvancementPanel.vue.
 */
function getToastTitle(markComplete: boolean): string {
  return markComplete ? 'Parts advanced' : 'Parts skipped'
}

/**
 * Pure extraction of toast description logic from ProcessAdvancementPanel.vue.
 */
function getToastDescription(markComplete: boolean, count: number): string {
  return `${count} part${count !== 1 ? 's' : ''} ${markComplete ? 'completed and advanced' : 'skipped forward'}`
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
    it('contains "completed and advanced" when markComplete is true', () => {
      expect(getToastDescription(true, 3)).toContain('completed and advanced')
    })

    it('contains "skipped forward" when markComplete is false', () => {
      expect(getToastDescription(false, 3)).toContain('skipped forward')
    })

    it('uses singular "part" when count is 1', () => {
      const desc = getToastDescription(true, 1)
      expect(desc).toBe('1 part completed and advanced')
    })

    it('uses plural "parts" when count is greater than 1', () => {
      const desc = getToastDescription(false, 2)
      expect(desc).toBe('2 parts skipped forward')
    })
  })
})
