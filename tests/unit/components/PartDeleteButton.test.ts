/**
 * Unit tests for PartDeleteButton pure logic.
 *
 * Tests extracted pure functions that mirror the component's internal logic.
 * No Vue component mounting — follows the same pattern as PartCreationPanel.test.ts.
 *
 * Feature: admin-part-delete
 */
import { describe, it, expect } from 'vitest'

// ---- Pure logic functions extracted from PartDeleteButton.vue ----

/** Determines whether the delete button should be visible (admin-only). */
export function isDeleteVisible(isAdmin: boolean): boolean {
  return isAdmin
}

/** Extracts a user-friendly error message from an API error response. */
export function extractDeleteError(e: any): string {
  const status = e?.response?.status ?? e?.statusCode
  if (status === 403) return 'Admin access required'
  return e?.data?.message ?? e?.message ?? 'Failed to delete part'
}

/** Builds the confirmation message for the delete modal. */
export function buildConfirmationMessage(partId: string): string {
  return `This will permanently delete part ${partId} and all associated data (certificates, step statuses, overrides). This action cannot be undone.`
}

/** Builds the success toast after deletion. */
export function buildDeleteSuccessToast(partId: string): { title: string, description: string, color: string } {
  return {
    title: 'Part deleted',
    description: `${partId} has been permanently removed`,
    color: 'success',
  }
}

// ---- Tests ----

describe('PartDeleteButton', () => {
  describe('isDeleteVisible', () => {
    it('returns true for admin users', () => {
      expect(isDeleteVisible(true)).toBe(true)
    })

    it('returns false for non-admin users', () => {
      expect(isDeleteVisible(false)).toBe(false)
    })
  })

  describe('extractDeleteError', () => {
    it('returns "Admin access required" for 403 status via response', () => {
      expect(extractDeleteError({ response: { status: 403 } })).toBe('Admin access required')
    })

    it('returns "Admin access required" for 403 via statusCode', () => {
      expect(extractDeleteError({ statusCode: 403 })).toBe('Admin access required')
    })

    it('returns data.message when present', () => {
      expect(extractDeleteError({ data: { message: 'Part not found' } })).toBe('Part not found')
    })

    it('returns message when data.message is absent', () => {
      expect(extractDeleteError({ message: 'Network error' })).toBe('Network error')
    })

    it('returns fallback when no message fields exist', () => {
      expect(extractDeleteError({})).toBe('Failed to delete part')
    })

    it('returns fallback for null error', () => {
      expect(extractDeleteError(null)).toBe('Failed to delete part')
    })

    it('returns fallback for undefined error', () => {
      expect(extractDeleteError(undefined)).toBe('Failed to delete part')
    })
  })

  describe('buildConfirmationMessage', () => {
    it('includes the part ID', () => {
      const msg = buildConfirmationMessage('part_00042')
      expect(msg).toContain('part_00042')
    })

    it('mentions cascade data types', () => {
      const msg = buildConfirmationMessage('part_00001')
      expect(msg).toContain('certificates')
      expect(msg).toContain('step statuses')
      expect(msg).toContain('overrides')
    })

    it('warns the action cannot be undone', () => {
      const msg = buildConfirmationMessage('part_00001')
      expect(msg).toContain('cannot be undone')
    })
  })

  describe('buildDeleteSuccessToast', () => {
    it('includes the part ID in the description', () => {
      const toast = buildDeleteSuccessToast('part_00042')
      expect(toast.description).toContain('part_00042')
    })

    it('uses success color', () => {
      const toast = buildDeleteSuccessToast('part_00001')
      expect(toast.color).toBe('success')
    })

    it('has a title', () => {
      const toast = buildDeleteSuccessToast('part_00001')
      expect(toast.title).toBe('Part deleted')
    })
  })
})
