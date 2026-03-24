import { describe, it, expect } from 'vitest'
import { ValidationError, NotFoundError } from '../../../server/utils/errors'

describe('ValidationError', () => {
  it('should have name "ValidationError" and correct message', () => {
    const err = new ValidationError('Goal quantity must be greater than zero')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ValidationError)
    expect(err.name).toBe('ValidationError')
    expect(err.message).toBe('Goal quantity must be greater than zero')
  })
})

describe('NotFoundError', () => {
  it('should have name "NotFoundError" and formatted message', () => {
    const err = new NotFoundError('Job', 'job_abc123')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(NotFoundError)
    expect(err.name).toBe('NotFoundError')
    expect(err.message).toBe('Job not found: job_abc123')
  })
})
