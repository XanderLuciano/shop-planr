/**
 * Unit tests for audit formatting helpers.
 *
 * Tests pure functions used by the audit log UI: action config lookup,
 * relative time formatting, ID truncation, transition detection,
 * and details summary composition.
 *
 * Feature: audit-mobile-redesign
 */
import { describe, it, expect } from 'vitest'
import {
  actionConfigFor,
  formatRelativeTime,
  truncateId,
  hasTransition,
  buildDetailsSummary,
} from '~/app/utils/auditFormatting'

describe('actionConfigFor', () => {
  it('returns the known config for a recognized action', () => {
    const config = actionConfigFor('part_advanced')
    expect(config.label).toBe('Advanced')
    expect(config.icon).toBe('i-lucide-arrow-right')
    expect(config.color).toContain('violet')
  })

  it('returns the known config for every defined AuditAction', () => {
    // Regression guard: every action in ACTION_CONFIG should yield a non-empty label
    for (const action of [
      'cert_attached',
      'part_created',
      'part_advanced',
      'part_completed',
      'note_created',
      'part_scrapped',
      'part_force_completed',
      'step_override_created',
      'step_override_reversed',
      'step_skipped',
      'step_deferred',
      'deferred_step_completed',
      'step_waived',
      'bom_edited',
      'path_deleted',
      'part_deleted',
      'tag_created',
      'tag_updated',
      'tag_deleted',
    ] as const) {
      const config = actionConfigFor(action)
      expect(config.label.length).toBeGreaterThan(0)
      expect(config.icon).toMatch(/^i-lucide-/)
    }
  })

  it('falls back to the raw action string when unknown', () => {
    const config = actionConfigFor('mystery_action')
    expect(config.label).toBe('mystery_action')
    expect(config.icon).toBe('i-lucide-circle')
  })
})

describe('formatRelativeTime', () => {
  const now = new Date('2025-06-15T12:00:00Z')

  it('returns "just now" for timestamps under a minute old', () => {
    const ts = new Date(now.getTime() - 30_000).toISOString()
    expect(formatRelativeTime(ts, now)).toBe('just now')
  })

  it('returns "Nm ago" for minutes under an hour', () => {
    const ts = new Date(now.getTime() - 5 * 60_000).toISOString()
    expect(formatRelativeTime(ts, now)).toBe('5m ago')
  })

  it('returns "Nh ago" for hours under a day', () => {
    const ts = new Date(now.getTime() - 3 * 60 * 60_000).toISOString()
    expect(formatRelativeTime(ts, now)).toBe('3h ago')
  })

  it('returns "Nd ago" for days under a week', () => {
    const ts = new Date(now.getTime() - 2 * 24 * 60 * 60_000).toISOString()
    expect(formatRelativeTime(ts, now)).toBe('2d ago')
  })

  it('returns an absolute same-year date when older than a week', () => {
    const ts = new Date('2025-01-15T12:00:00Z').toISOString()
    const result = formatRelativeTime(ts, now)
    // e.g. "Jan 15" — no year because same year
    expect(result).toMatch(/Jan 15/)
    expect(result).not.toMatch(/2025/)
  })

  it('includes the year when the entry is from a prior year', () => {
    const ts = new Date('2023-11-01T12:00:00Z').toISOString()
    const result = formatRelativeTime(ts, now)
    expect(result).toMatch(/2023/)
  })

  it('uses the current Date when no reference is supplied', () => {
    // Just exercise the default-arg path — value will be "just now" for a timestamp we just made
    const ts = new Date().toISOString()
    expect(formatRelativeTime(ts)).toBe('just now')
  })
})

describe('truncateId', () => {
  it('returns the id unchanged when shorter than the visible window', () => {
    expect(truncateId('short', 8)).toBe('short')
  })

  it('returns the id unchanged when equal to visible + 1 chars', () => {
    expect(truncateId('123456789', 8)).toBe('123456789')
  })

  it('truncates with an ellipsis when longer than visible + 1', () => {
    expect(truncateId('step_TyxbLnVHt9OL', 8)).toBe('step_Tyx…')
  })

  it('uses a default visible length of 8', () => {
    expect(truncateId('step_TyxbLnVHt9OL')).toBe('step_Tyx…')
  })

  it('respects a custom visible length', () => {
    expect(truncateId('step_TyxbLnVHt9OL', 12)).toBe('step_TyxbLnV…')
  })
})

describe('hasTransition', () => {
  it('returns true when both fromStepId and toStepId are set', () => {
    expect(hasTransition({ fromStepId: 'a', toStepId: 'b' })).toBe(true)
  })

  it('returns false when only fromStepId is set', () => {
    expect(hasTransition({ fromStepId: 'a', toStepId: undefined })).toBe(false)
  })

  it('returns false when only toStepId is set', () => {
    expect(hasTransition({ fromStepId: undefined, toStepId: 'b' })).toBe(false)
  })

  it('returns false when both are empty strings', () => {
    expect(hasTransition({ fromStepId: '', toStepId: '' })).toBe(false)
  })
})

describe('buildDetailsSummary', () => {
  it('formats a transition with truncated step IDs', () => {
    const result = buildDetailsSummary({
      fromStepId: 'step_TyxbLnVHt9OL',
      toStepId: 'step_HqWw5ML5F4an',
    })
    expect(result).toBe('step_Tyx… → step_HqW…')
  })

  it('formats a single step without transition', () => {
    const result = buildDetailsSummary({
      stepId: 'step_TyxbLnVHt9OL',
    })
    expect(result).toBe('at step_Tyx…')
  })

  it('formats a job reference when no step info present', () => {
    const result = buildDetailsSummary({
      jobId: 'job_Lh9ZrfANJI',
    })
    expect(result).toBe('job job_Lh9Z…')
  })

  it('returns an empty string when nothing is set', () => {
    expect(buildDetailsSummary({})).toBe('')
  })

  it('prefers transition over single stepId when both present', () => {
    const result = buildDetailsSummary({
      fromStepId: 'a_one',
      toStepId: 'b_two',
      stepId: 'should_not_appear',
    })
    expect(result).toContain('→')
    expect(result).not.toContain('at')
  })

  it('prefers stepId over jobId when transition is missing', () => {
    const result = buildDetailsSummary({
      stepId: 'step_abc',
      jobId: 'job_xyz',
    })
    expect(result).toMatch(/^at /)
    expect(result).not.toContain('job_xyz')
  })
})
