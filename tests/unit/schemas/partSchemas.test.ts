import { describe, it, expect } from 'vitest'
import { partIdParamSchema } from '../../../server/schemas/partSchemas'

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
