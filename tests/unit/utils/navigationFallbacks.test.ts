/**
 * Unit tests for the navigation fallback route resolver.
 * Validates: Requirement 5.2 — all 8 fallback mappings.
 */
import { describe, it, expect } from 'vitest'
import { resolveFallbackRoute } from '~/app/utils/navigationFallbacks'

describe('resolveFallbackRoute', () => {
  it.each([
    ['/parts-browser/SN-00004', '/parts-browser'],
    ['/parts/step/step_abc', '/parts'],
    ['/jobs/new', '/jobs'],
    ['/jobs/edit/JOB-123', '/jobs'],
    ['/jobs/JOB-123', '/jobs'],
    ['/serials/SN-00001', '/parts-browser'],
    ['/queue', '/'],
  ])('maps %s → %s', (path, expected) => {
    expect(resolveFallbackRoute(path)).toBe(expected)
  })

  it('returns "/" for unmatched paths', () => {
    expect(resolveFallbackRoute('/some/unknown/path')).toBe('/')
  })
})
