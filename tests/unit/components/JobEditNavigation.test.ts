/**
 * Unit tests for job edit navigation wiring.
 *
 * Tests pure functions that mirror the navigation logic in:
 * - `app/pages/jobs/[id].vue` (Edit button URL)
 * - `app/pages/jobs/edit/[id].vue` (onSaved, onCancel destinations)
 *
 * No Vue component mounting — pure logic only.
 *
 * **Validates: Requirements 2.1, 2.2, 4.1, 5.1**
 */
import { describe, it, expect } from 'vitest'

// ---- Pure logic extracted from the edit navigation flow ----

/** Builds the edit page URL from the job detail page (mirrors Edit button @click). */
export function buildEditUrl(jobId: string): string {
  return `/jobs/edit/${encodeURIComponent(jobId)}`
}

/** Builds the redirect URL after a successful save (mirrors onSaved). */
export function buildSavedRedirectUrl(jobId: string): string {
  return `/jobs/${encodeURIComponent(jobId)}`
}

/** Builds the redirect URL after cancel (mirrors onCancel). */
export function buildCancelRedirectUrl(jobId: string): string {
  return `/jobs/${encodeURIComponent(jobId)}`
}

// ---- Tests ----

describe('JobEditNavigation — pure logic', () => {
  describe('Edit button URL (Req 2.1, 2.2)', () => {
    it('produces /jobs/edit/:id pattern (not /jobs/:id/edit)', () => {
      const url = buildEditUrl('job_abc123')
      expect(url).toBe('/jobs/edit/job_abc123')
      // Must NOT match the old nested pattern /jobs/<id>/edit
      expect(url).not.toMatch(/^\/jobs\/job_abc123\/edit$/)
      expect(url.startsWith('/jobs/edit/')).toBe(true)
    })

    it('encodes special characters in job ID', () => {
      const url = buildEditUrl('job with spaces')
      expect(url).toBe('/jobs/edit/job%20with%20spaces')
    })

    it('encodes slashes in job ID', () => {
      const url = buildEditUrl('job/123')
      expect(url).toBe('/jobs/edit/job%2F123')
    })

    it('handles already-encoded IDs', () => {
      const url = buildEditUrl('job%20abc')
      expect(url).toBe('/jobs/edit/job%2520abc')
    })
  })

  describe('onSaved redirect (Req 4.1)', () => {
    it('navigates to /jobs/:id after save', () => {
      expect(buildSavedRedirectUrl('job_abc123')).toBe('/jobs/job_abc123')
    })

    it('encodes special characters', () => {
      expect(buildSavedRedirectUrl('job/123')).toBe('/jobs/job%2F123')
    })
  })

  describe('onCancel redirect (Req 5.1)', () => {
    it('navigates to /jobs/:id on cancel', () => {
      expect(buildCancelRedirectUrl('job_abc123')).toBe('/jobs/job_abc123')
    })

    it('does not navigate to /jobs (list) — goes to detail', () => {
      const url = buildCancelRedirectUrl('job_abc123')
      expect(url).not.toBe('/jobs')
      expect(url).toBe('/jobs/job_abc123')
    })
  })
})
