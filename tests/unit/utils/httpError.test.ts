/**
 * Unit tests for the httpError utility module.
 *
 * Covers static map completeness, unmapped status code fallback,
 * data-driven mapping structure, and specific error class examples.
 */
import { describe, it, expect, vi } from 'vitest'
import { createError, isError, defineEventHandler } from 'h3'
import { ValidationError, NotFoundError, ForbiddenError } from '~/server/utils/errors'

// Provide Nitro auto-imports as globals so httpError.ts can resolve them
vi.stubGlobal('ValidationError', ValidationError)
vi.stubGlobal('NotFoundError', NotFoundError)
vi.stubGlobal('ForbiddenError', ForbiddenError)
vi.stubGlobal('createError', createError)
vi.stubGlobal('isError', isError)
vi.stubGlobal('defineEventHandler', defineEventHandler)

// Import AFTER globals are stubbed
const { httpError, ERROR_STATUS_MAP, STATUS_MESSAGES } = await import('~/server/utils/httpError')

/**
 * Validates: Requirement 1.4
 * STATUS_MESSAGES contains all 7 required codes with correct RFC 9110 phrases.
 */
describe('STATUS_MESSAGES completeness', () => {
  const expectedEntries: [number, string][] = [
    [400, 'Bad Request'],
    [401, 'Unauthorized'],
    [403, 'Forbidden'],
    [404, 'Not Found'],
    [409, 'Conflict'],
    [422, 'Unprocessable Entity'],
    [500, 'Internal Server Error'],
  ]

  it.each(expectedEntries)(
    'maps %i to "%s"',
    (code, phrase) => {
      expect(STATUS_MESSAGES[code]).toBe(phrase)
    },
  )
})

/**
 * Validates: Requirement 1.3
 * When a status code is not in STATUS_MESSAGES, statusMessage falls back to "Unknown Error".
 */
describe('unmapped status code fallback', () => {
  it('produces statusMessage "Unknown Error" for a code not in STATUS_MESSAGES', () => {
    // Temporarily add an entry with a status code not in STATUS_MESSAGES
    const tempEntry = { errorClass: RangeError, statusCode: 418 }
    ERROR_STATUS_MAP.push(tempEntry)

    try {
      const error = new RangeError('teapot')
      let caught: unknown
      try {
        httpError(error)
      } catch (e) {
        caught = e
      }

      expect(isError(caught)).toBe(true)
      const h3Err = caught as ReturnType<typeof createError>
      expect(h3Err.statusCode).toBe(418)
      expect(h3Err.statusMessage).toBe('Unknown Error')
      expect(h3Err.message).toBe('teapot')
    } finally {
      // Clean up — remove the temporary entry
      const idx = ERROR_STATUS_MAP.indexOf(tempEntry)
      if (idx !== -1) ERROR_STATUS_MAP.splice(idx, 1)
    }
  })
})

/**
 * Validates: Requirement 6.2
 * ERROR_STATUS_MAP is an array (structural check for data-driven mapping).
 */
describe('ERROR_STATUS_MAP structure', () => {
  it('is an array', () => {
    expect(Array.isArray(ERROR_STATUS_MAP)).toBe(true)
  })
})

/**
 * Validates: Requirements 2.1
 * ValidationError("Name is required") → 400, "Bad Request", "Name is required"
 */
describe('ValidationError mapping', () => {
  it('maps ValidationError to 400 with correct statusMessage and message', () => {
    const error = new ValidationError('Name is required')

    let caught: unknown
    try {
      httpError(error)
    } catch (e) {
      caught = e
    }

    expect(isError(caught)).toBe(true)
    const h3Err = caught as ReturnType<typeof createError>
    expect(h3Err.statusCode).toBe(400)
    expect(h3Err.statusMessage).toBe('Bad Request')
    expect(h3Err.message).toBe('Name is required')
  })
})

/**
 * Validates: Requirements 1.2
 * ForbiddenError("msg") → 403, "Forbidden", "msg"
 */
describe('ForbiddenError mapping', () => {
  it('maps ForbiddenError to 403 with correct statusMessage and message', () => {
    const error = new ForbiddenError('Admin access required to delete paths')

    let caught: unknown
    try {
      httpError(error)
    } catch (e) {
      caught = e
    }

    expect(isError(caught)).toBe(true)
    const h3Err = caught as ReturnType<typeof createError>
    expect(h3Err.statusCode).toBe(403)
    expect(h3Err.statusMessage).toBe('Forbidden')
    expect(h3Err.message).toBe('Admin access required to delete paths')
  })
})

/**
 * Validates: Requirements 2.2
 * NotFoundError("Job", "J-123") → 404, "Not Found", "Job not found: J-123"
 */
describe('NotFoundError mapping', () => {
  it('maps NotFoundError to 404 with correct statusMessage and message', () => {
    const error = new NotFoundError('Job', 'J-123')

    let caught: unknown
    try {
      httpError(error)
    } catch (e) {
      caught = e
    }

    expect(isError(caught)).toBe(true)
    const h3Err = caught as ReturnType<typeof createError>
    expect(h3Err.statusCode).toBe(404)
    expect(h3Err.statusMessage).toBe('Not Found')
    expect(h3Err.message).toBe('Job not found: J-123')
  })
})
