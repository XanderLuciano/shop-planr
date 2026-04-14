import { describe, it, expect } from 'vitest'
import { createTagSchema, updateTagSchema, setJobTagsSchema } from '~/server/schemas/tagSchemas'

describe('createTagSchema', () => {
  it('accepts a valid name only', () => {
    const result = createTagSchema.safeParse({ name: 'Test' })
    expect(result.success).toBe(true)
  })

  it('accepts a valid name with a valid hex color', () => {
    const result = createTagSchema.safeParse({ name: 'Test', color: '#ef4444' })
    expect(result.success).toBe(true)
  })

  it('color is optional', () => {
    const result = createTagSchema.safeParse({ name: 'Test' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.color).toBeUndefined()
    }
  })

  it('rejects an empty name', () => {
    const result = createTagSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a non-hex color string', () => {
    const result = createTagSchema.safeParse({ name: 'Test', color: 'red' })
    expect(result.success).toBe(false)
  })

  it('rejects a short hex color (3-digit)', () => {
    const result = createTagSchema.safeParse({ name: 'Test', color: '#fff' })
    expect(result.success).toBe(false)
  })

  it('rejects a hex color with invalid characters', () => {
    const result = createTagSchema.safeParse({ name: 'Test', color: '#gggggg' })
    expect(result.success).toBe(false)
  })
})

describe('updateTagSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    const result = updateTagSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts a name-only update', () => {
    const result = updateTagSchema.safeParse({ name: 'New Name' })
    expect(result.success).toBe(true)
  })

  it('accepts a color-only update', () => {
    const result = updateTagSchema.safeParse({ color: '#3b82f6' })
    expect(result.success).toBe(true)
  })

  it('accepts both name and color', () => {
    const result = updateTagSchema.safeParse({ name: 'New', color: '#3b82f6' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty name', () => {
    const result = updateTagSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a non-hex color string', () => {
    const result = updateTagSchema.safeParse({ color: 'blue' })
    expect(result.success).toBe(false)
  })
})

describe('setJobTagsSchema', () => {
  it('accepts an empty tagIds array', () => {
    const result = setJobTagsSchema.safeParse({ tagIds: [] })
    expect(result.success).toBe(true)
  })

  it('accepts a populated tagIds array', () => {
    const result = setJobTagsSchema.safeParse({ tagIds: ['tag_a', 'tag_b'] })
    expect(result.success).toBe(true)
  })

  it('rejects a missing tagIds field', () => {
    const result = setJobTagsSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects a non-array tagIds value', () => {
    const result = setJobTagsSchema.safeParse({ tagIds: 'not-an-array' })
    expect(result.success).toBe(false)
  })
})
