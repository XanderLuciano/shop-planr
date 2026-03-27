import { describe, it, expect } from 'vitest'
import { resolveBackNavigation } from '~/app/utils/resolveBackNavigation'

describe('resolveBackNavigation', () => {
  it('returns job path and "Back to Job" for a valid job path', () => {
    const result = resolveBackNavigation('/jobs/JOB-123')
    expect(result).toEqual({ to: '/jobs/JOB-123', label: 'Back to Job' })
  })

  it('returns /parts and "Back to Parts" for undefined', () => {
    const result = resolveBackNavigation(undefined)
    expect(result).toEqual({ to: '/parts', label: 'Back to Parts' })
  })

  it('returns /parts and "Back to Parts" for empty string', () => {
    const result = resolveBackNavigation('')
    expect(result).toEqual({ to: '/parts', label: 'Back to Parts' })
  })

  it('returns /parts and "Back to Parts" for an external URL', () => {
    const result = resolveBackNavigation('https://evil.com')
    expect(result).toEqual({ to: '/parts', label: 'Back to Parts' })
  })

  it('returns /parts and "Back to Parts" for javascript: URI', () => {
    const result = resolveBackNavigation('javascript:alert(1)')
    expect(result).toEqual({ to: '/parts', label: 'Back to Parts' })
  })

  it('returns /parts and "Back to Parts" for /settings', () => {
    const result = resolveBackNavigation('/settings')
    expect(result).toEqual({ to: '/parts', label: 'Back to Parts' })
  })

  it('returns /parts and "Back to Parts" for /parts', () => {
    const result = resolveBackNavigation('/parts')
    expect(result).toEqual({ to: '/parts', label: 'Back to Parts' })
  })
})
