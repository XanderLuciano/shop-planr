/**
 * Unit tests for server/utils/n8nErrors.ts
 *
 * Covers: extractN8nError behavior with various error shapes
 * (FetchError with data, plain Error, non-Error values).
 */
import { describe, it, expect } from 'vitest'
import { extractN8nError } from '~/server/utils/n8nErrors'

describe('extractN8nError', () => {
  it('returns message from n8n JSON response body', () => {
    const err = Object.assign(new Error('fetch failed'), {
      data: { message: 'Workflow not found' },
    })
    expect(extractN8nError(err)).toBe('Workflow not found')
  })

  it('combines message and description from n8n response', () => {
    const err = Object.assign(new Error('fetch failed'), {
      data: { message: 'Validation failed', description: 'Name is required' },
    })
    expect(extractN8nError(err)).toBe('Validation failed — Name is required')
  })

  it('falls back to Error.message with status code', () => {
    const err = Object.assign(new Error('Request failed'), {
      statusCode: 404,
      data: null,
    })
    expect(extractN8nError(err)).toBe('Request failed (HTTP 404)')
  })

  it('falls back to Error.message without status code', () => {
    const err = new Error('Network timeout')
    expect(extractN8nError(err)).toBe('Network timeout')
  })

  it('returns generic message for non-Error values', () => {
    expect(extractN8nError('string error')).toBe('Unknown error communicating with n8n')
    expect(extractN8nError(42)).toBe('Unknown error communicating with n8n')
    expect(extractN8nError(null)).toBe('Unknown error communicating with n8n')
    expect(extractN8nError(undefined)).toBe('Unknown error communicating with n8n')
  })

  it('handles data object with only description (no message)', () => {
    const err = Object.assign(new Error('fetch failed'), {
      data: { description: 'Something went wrong' },
    })
    expect(extractN8nError(err)).toBe('Something went wrong')
  })

  it('ignores non-string message/description in data', () => {
    const err = Object.assign(new Error('fetch failed'), {
      statusCode: 500,
      data: { message: 123, description: true },
    })
    // Falls through to Error.message + statusCode
    expect(extractN8nError(err)).toBe('fetch failed (HTTP 500)')
  })

  it('handles empty data object', () => {
    const err = Object.assign(new Error('fetch failed'), {
      statusCode: 502,
      data: {},
    })
    expect(extractN8nError(err)).toBe('fetch failed (HTTP 502)')
  })
})
