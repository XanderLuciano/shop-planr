import { describe, it, expect } from 'vitest'
import { generateId, createSequentialPartIdGenerator, createSequentialSnGenerator } from '../../../server/utils/idGenerator'

describe('generateId', () => {
  it('should produce an ID with the given prefix', () => {
    const id = generateId('job')
    expect(id).toMatch(/^job_/)
  })

  it('should produce unique IDs on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId('test')))
    expect(ids.size).toBe(100)
  })

  it('should produce IDs with prefix + underscore + 12 chars', () => {
    const id = generateId('path')
    // "path_" = 5 chars, then 12 nanoid chars
    expect(id.startsWith('path_')).toBe(true)
    expect(id.slice(5).length).toBe(12)
  })
})

describe('createSequentialPartIdGenerator', () => {
  it('should generate sequential part IDs starting from 1', () => {
    let counter = 0
    const gen = createSequentialPartIdGenerator({
      getCounter: () => counter,
      setCounter: (v) => { counter = v }
    })

    expect(gen.next()).toBe('part_00001')
    expect(gen.next()).toBe('part_00002')
    expect(gen.next()).toBe('part_00003')
    expect(counter).toBe(3)
  })

  it('should resume from persisted counter value', () => {
    let counter = 42
    const gen = createSequentialPartIdGenerator({
      getCounter: () => counter,
      setCounter: (v) => { counter = v }
    })

    expect(gen.next()).toBe('part_00043')
    expect(counter).toBe(43)
  })

  it('should generate a batch of sequential IDs', () => {
    let counter = 0
    const gen = createSequentialPartIdGenerator({
      getCounter: () => counter,
      setCounter: (v) => { counter = v }
    })

    const batch = gen.nextBatch(3)
    expect(batch).toEqual(['part_00001', 'part_00002', 'part_00003'])
    expect(counter).toBe(3)
  })

  it('should return empty array for batch of 0', () => {
    let counter = 5
    const gen = createSequentialPartIdGenerator({
      getCounter: () => counter,
      setCounter: (v) => { counter = v }
    })

    expect(gen.nextBatch(0)).toEqual([])
    expect(counter).toBe(5) // unchanged
  })

  it('should support custom prefix and pad length', () => {
    let counter = 0
    const gen = createSequentialPartIdGenerator({
      getCounter: () => counter,
      setCounter: (v) => { counter = v },
      prefix: 'PART-',
      padLength: 8
    })

    expect(gen.next()).toBe('PART-00000001')
  })
})

describe('createSequentialSnGenerator (backward compat alias)', () => {
  it('should be the same function as createSequentialPartIdGenerator', () => {
    expect(createSequentialSnGenerator).toBe(createSequentialPartIdGenerator)
  })
})
