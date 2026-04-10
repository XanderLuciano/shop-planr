/**
 * Unit tests for PartDeleteButton pure logic.
 *
 * Tests the shared helper functions that the component imports.
 *
 * Feature: admin-part-delete
 */
import { describe, it, expect } from 'vitest'
import {
  isDeleteVisible,
  extractDeleteError,
  buildConfirmationMessage,
  buildDeleteSuccessToast,
} from '~/app/utils/partDeleteHelpers'

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
