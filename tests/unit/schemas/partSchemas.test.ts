import { describe, it, expect } from 'vitest'
import { partIdParamSchema } from '../../../server/schemas/partSchemas'

describe('partIdParamSchema', () => {
  it('accepts a valid part_ prefixed id', () => {
    const result = partIdParamSchema.safeParse({ id: 'part_00001' })
    expect(result.success).toBe(true)
  })

  it('accepts a legacy SN- prefixed id', () => {
    const result = partIdParamSchema.safeParse({ id: 'SN-00001' })
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
