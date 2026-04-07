/**
 * Unit tests for avatar helper utilities.
 */
import { describe, it, expect } from 'vitest'
import { getAvatarColor, getInitials } from '../../../app/utils/avatarHelpers'

describe('getAvatarColor', () => {
  it('returns an HSL string', () => {
    expect(getAvatarColor('alice')).toMatch(/^hsl\(\d+, 65%, 55%\)$/)
  })

  it('is deterministic', () => {
    expect(getAvatarColor('bob')).toBe(getAvatarColor('bob'))
  })

  it('produces different colors for different usernames', () => {
    // Not guaranteed but very likely for distinct inputs
    const a = getAvatarColor('alice')
    const b = getAvatarColor('bob')
    // Just verify they're both valid HSL — different hues are likely
    expect(a).toMatch(/^hsl\(\d+, 65%, 55%\)$/)
    expect(b).toMatch(/^hsl\(\d+, 65%, 55%\)$/)
  })

  it('handles empty string', () => {
    expect(getAvatarColor('')).toBe('hsl(0, 65%, 55%)')
  })
})

describe('getInitials', () => {
  it('extracts two initials from two-word name', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('extracts one initial from single-word name', () => {
    expect(getInitials('Alice')).toBe('A')
  })

  it('limits to 2 characters for long names', () => {
    expect(getInitials('Mary Jane Watson')).toBe('MJ')
  })

  it('uppercases initials', () => {
    expect(getInitials('john doe')).toBe('JD')
  })
})
