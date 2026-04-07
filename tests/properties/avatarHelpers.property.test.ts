/**
 * Property tests for avatar helper utilities.
 *
 * Feature: pin-auth-jwt, Property 9: Deterministic avatar color and initials
 * **Validates: Requirements 10.2**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { getAvatarColor, getInitials } from '../../app/utils/avatarHelpers'

describe('Property 9: Deterministic avatar color and initials', () => {
  it('getAvatarColor returns the same HSL string for the same username', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (username) => {
          const color1 = getAvatarColor(username)
          const color2 = getAvatarColor(username)
          expect(color1).toBe(color2)
          expect(color1).toMatch(/^hsl\(\d+, 65%, 55%\)$/)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('getInitials returns the same 1-2 char uppercase string for the same displayName', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (displayName) => {
          const initials1 = getInitials(displayName)
          const initials2 = getInitials(displayName)
          expect(initials1).toBe(initials2)
          expect(initials1.length).toBeGreaterThanOrEqual(1)
          expect(initials1.length).toBeLessThanOrEqual(2)
          expect(initials1).toBe(initials1.toUpperCase())
        },
      ),
      { numRuns: 200 },
    )
  })

  it('getInitials extracts correct initials from multi-word names', () => {
    expect(getInitials('John Doe')).toBe('JD')
    expect(getInitials('Alice')).toBe('A')
    expect(getInitials('Mary Jane Watson')).toBe('MJ')
  })
})
