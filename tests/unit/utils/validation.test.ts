import { describe, it, expect } from 'vitest'
import { ValidationError } from '../../../server/utils/errors'
import {
  assertPositive,
  assertNonEmpty,
  assertNonEmptyArray,
  assertOneOf,
  assertNonNegativeInteger,
  assertDefined
} from '../../../server/utils/validation'

describe('assertPositive', () => {
  it('should pass for positive numbers', () => {
    expect(() => assertPositive(1, 'qty')).not.toThrow()
    expect(() => assertPositive(0.5, 'qty')).not.toThrow()
  })

  it('should throw for zero', () => {
    expect(() => assertPositive(0, 'goalQuantity')).toThrow(ValidationError)
    expect(() => assertPositive(0, 'goalQuantity')).toThrow('goalQuantity must be greater than zero')
  })

  it('should throw for negative numbers', () => {
    expect(() => assertPositive(-5, 'qty')).toThrow(ValidationError)
  })

  it('should throw for NaN and Infinity', () => {
    expect(() => assertPositive(NaN, 'qty')).toThrow(ValidationError)
    expect(() => assertPositive(Infinity, 'qty')).toThrow(ValidationError)
  })
})

describe('assertNonEmpty', () => {
  it('should pass for non-empty strings', () => {
    expect(() => assertNonEmpty('hello', 'name')).not.toThrow()
  })

  it('should throw for empty string', () => {
    expect(() => assertNonEmpty('', 'name')).toThrow(ValidationError)
    expect(() => assertNonEmpty('', 'Job name')).toThrow('Job name is required')
  })

  it('should throw for whitespace-only string', () => {
    expect(() => assertNonEmpty('   ', 'name')).toThrow(ValidationError)
  })

  it('should throw for non-string values', () => {
    expect(() => assertNonEmpty(null, 'name')).toThrow(ValidationError)
    expect(() => assertNonEmpty(undefined, 'name')).toThrow(ValidationError)
    expect(() => assertNonEmpty(123, 'name')).toThrow(ValidationError)
  })
})

describe('assertNonEmptyArray', () => {
  it('should pass for non-empty arrays', () => {
    expect(() => assertNonEmptyArray([1], 'steps')).not.toThrow()
  })

  it('should throw for empty arrays', () => {
    expect(() => assertNonEmptyArray([], 'steps')).toThrow(ValidationError)
    expect(() => assertNonEmptyArray([], 'Path steps')).toThrow('Path steps must have at least one item')
  })

  it('should throw for non-array values', () => {
    expect(() => assertNonEmptyArray('not array', 'steps')).toThrow(ValidationError)
  })
})

describe('assertOneOf', () => {
  it('should pass for allowed values', () => {
    expect(() => assertOneOf('material', ['material', 'process'] as const, 'type')).not.toThrow()
  })

  it('should throw for disallowed values', () => {
    expect(() => assertOneOf('invalid', ['material', 'process'] as const, 'type')).toThrow(ValidationError)
    expect(() => assertOneOf('invalid', ['material', 'process'] as const, 'type')).toThrow('type must be one of: material, process')
  })
})

describe('assertNonNegativeInteger', () => {
  it('should pass for 0 and positive integers', () => {
    expect(() => assertNonNegativeInteger(0, 'index')).not.toThrow()
    expect(() => assertNonNegativeInteger(5, 'index')).not.toThrow()
  })

  it('should throw for negative numbers', () => {
    expect(() => assertNonNegativeInteger(-1, 'index')).toThrow(ValidationError)
  })

  it('should throw for non-integers', () => {
    expect(() => assertNonNegativeInteger(1.5, 'index')).toThrow(ValidationError)
  })
})

describe('assertDefined', () => {
  it('should pass for defined values', () => {
    expect(() => assertDefined('value', 'field')).not.toThrow()
    expect(() => assertDefined(0, 'field')).not.toThrow()
    expect(() => assertDefined(false, 'field')).not.toThrow()
  })

  it('should throw for null and undefined', () => {
    expect(() => assertDefined(null, 'field')).toThrow(ValidationError)
    expect(() => assertDefined(undefined, 'field')).toThrow(ValidationError)
  })
})
