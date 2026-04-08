/**
 * Unit tests for the navigation label registry.
 * Validates: Requirement 3.2 — all 13 route-to-label mappings.
 */
import { describe, it, expect } from 'vitest'
import { resolveLabel, routePattern } from '~/app/utils/navigationLabels'

describe('resolveLabel', () => {
  it.each([
    ['/', 'Dashboard'],
    ['/jobs', 'Jobs'],
    ['/jobs/JOB-123', 'Job'],
    ['/parts-browser', 'Parts Browser'],
    ['/parts-browser/SN-00004', 'Part SN-00004'],
    ['/parts', 'Parts'],
    ['/parts/step/step_abc', 'Step View'],
    ['/queue', 'Work Queue'],
    ['/templates', 'Templates'],
    ['/bom', 'BOM'],
    ['/certs', 'Certs'],
    ['/audit', 'Audit'],
    ['/settings', 'Settings'],
  ])('maps %s → %s', (path, expected) => {
    expect(resolveLabel(path)).toBe(expected)
  })

  it('returns "Back" for unknown paths', () => {
    expect(resolveLabel('/unknown/route')).toBe('Back')
  })
})

describe('routePattern', () => {
  it('returns the same pattern for same-type routes with different dynamic segments', () => {
    expect(routePattern('/jobs/JOB-001')).toBe(routePattern('/jobs/JOB-999'))
    expect(routePattern('/parts-browser/SN-001')).toBe(routePattern('/parts-browser/SN-999'))
    expect(routePattern('/parts/step/step_a')).toBe(routePattern('/parts/step/step_z'))
  })
})
