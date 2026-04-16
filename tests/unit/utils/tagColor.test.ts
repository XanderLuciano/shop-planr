import { describe, it, expect } from 'vitest'
import { readableForeground } from '~/app/utils/tagColor'

describe('readableForeground', () => {
  it('returns black on a light background', () => {
    expect(readableForeground('#ffffff')).toBe('#000')
    expect(readableForeground('#ffff00')).toBe('#000') // yellow — the pre-fix failure case
    expect(readableForeground('#e5e7eb')).toBe('#000')
    expect(readableForeground('#a7f3d0')).toBe('#000') // light green
  })

  it('returns white on a dark background', () => {
    expect(readableForeground('#000000')).toBe('#fff')
    expect(readableForeground('#8b5cf6')).toBe('#fff') // default violet
    expect(readableForeground('#ef4444')).toBe('#fff') // red-500
    expect(readableForeground('#3b82f6')).toBe('#fff') // blue-500
  })

  it('accepts uppercase hex', () => {
    expect(readableForeground('#FFFFFF')).toBe('#000')
    expect(readableForeground('#000000')).toBe('#fff')
  })

  it('defaults to white on malformed input (fail-safe against dark backgrounds)', () => {
    expect(readableForeground('')).toBe('#fff')
    expect(readableForeground('red')).toBe('#fff')
    expect(readableForeground('#fff')).toBe('#fff') // 3-digit not supported
    expect(readableForeground('#gggggg')).toBe('#fff')
  })
})
