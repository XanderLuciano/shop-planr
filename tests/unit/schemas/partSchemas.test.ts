import { describe, it, expect } from 'vitest'
import { partIdParamSchema, batchAdvanceSchema } from '~/server/schemas/partSchemas'

describe('partIdParamSchema', () => {
  it.each([
    ['part_00001'],
    ['SN-00001'],
    ['any-non-empty-string'],
  ])('accepts non-empty string: %s', (id) => {
    const result = partIdParamSchema.safeParse({ id })
    expect(result.success).toBe(true)
  })

  it('rejects an empty string id', () => {
    const result = partIdParamSchema.safeParse({ id: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing id field', () => {
    const result = partIdParamSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('batchAdvanceSchema', () => {
  it('accepts a valid array of non-empty strings', () => {
    const result = batchAdvanceSchema.safeParse({ partIds: ['part_001', 'part_002', 'part_003'] })
    expect(result.success).toBe(true)
  })

  it('accepts a single-element array', () => {
    const result = batchAdvanceSchema.safeParse({ partIds: ['part_001'] })
    expect(result.success).toBe(true)
  })

  it('accepts exactly 100 elements', () => {
    const partIds = Array.from({ length: 100 }, (_, i) => `part_${i}`)
    const result = batchAdvanceSchema.safeParse({ partIds })
    expect(result.success).toBe(true)
  })

  it('rejects an empty array', () => {
    const result = batchAdvanceSchema.safeParse({ partIds: [] })
    expect(result.success).toBe(false)
  })

  it('rejects an array containing an empty string', () => {
    const result = batchAdvanceSchema.safeParse({ partIds: ['part_001', '', 'part_003'] })
    expect(result.success).toBe(false)
  })

  it('rejects an array with more than 100 elements', () => {
    const partIds = Array.from({ length: 101 }, (_, i) => `part_${i}`)
    const result = batchAdvanceSchema.safeParse({ partIds })
    expect(result.success).toBe(false)
  })

  it('rejects non-array input for partIds', () => {
    const result = batchAdvanceSchema.safeParse({ partIds: 'not-an-array' })
    expect(result.success).toBe(false)
  })

  it('rejects missing partIds field', () => {
    const result = batchAdvanceSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
