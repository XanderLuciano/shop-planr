/**
 * Property-based tests for the HTTP Error Handler utility.
 *
 * httpError.ts relies on Nitro auto-imports (ValidationError, NotFoundError,
 * createError, isError, defineEventHandler). We stub these as globals before
 * importing the module under test.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { createError, isError, defineEventHandler } from 'h3'
import type { H3Event } from 'h3'
import { ValidationError, NotFoundError, ForbiddenError, AuthenticationError } from '~/server/utils/errors'

// Provide Nitro auto-imports as globals so httpError.ts can resolve them
vi.stubGlobal('ValidationError', ValidationError)
vi.stubGlobal('NotFoundError', NotFoundError)
vi.stubGlobal('ForbiddenError', ForbiddenError)
vi.stubGlobal('AuthenticationError', AuthenticationError)
vi.stubGlobal('createError', createError)
vi.stubGlobal('isError', isError)
vi.stubGlobal('defineEventHandler', defineEventHandler)

// Import AFTER globals are stubbed
const { httpError, ERROR_STATUS_MAP, STATUS_MESSAGES, defineApiHandler } = await import('~/server/utils/httpError')

// Silence the noisy `[API 500]` console.error calls that httpError() emits for unknown errors
let consoleErrorSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  consoleErrorSpy.mockRestore()
})

// Feature: http-error-handler, Property 1: Mapped error classification preserves status and message
describe('Property 1: Mapped error classification preserves status and message', () => {
  /**
   * For any error class registered in ERROR_STATUS_MAP and for any non-empty
   * message string, calling httpError() with an instance of that error class
   * should produce an H3Error with:
   * - statusCode equal to the mapped status code
   * - statusMessage equal to STATUS_MESSAGES[statusCode]
   * - message equal to the original error's message
   *
   * **Validates: Requirements 1.2, 2.1, 2.2, 5.1, 5.2, 5.4, 7.1, 7.2, 7.3**
   */
  it('produces correct statusCode, statusMessage, and message for all mapped error classes', () => {
    const arbMappedError = fc.oneof(
      ...ERROR_STATUS_MAP.map(entry =>
        fc.record({
          errorClass: fc.constant(entry.errorClass),
          statusCode: fc.constant(entry.statusCode),
          message: fc.string({ minLength: 1 }),
        }),
      ),
    )

    fc.assert(
      fc.property(arbMappedError, ({ errorClass, statusCode, message }) => {
        // Construct an instance of the mapped error class with the random message
        const error = errorClass === NotFoundError
          ? new NotFoundError(message, 'id')
          : new errorClass(message)

        let caught: unknown
        try {
          httpError(error)
        } catch (e) {
          caught = e
        }

        // The caught error must be an H3Error
        expect(isError(caught)).toBe(true)

        const h3Err = caught as ReturnType<typeof createError>
        expect(h3Err.statusCode).toBe(statusCode)
        expect(h3Err.statusMessage).toBe(STATUS_MESSAGES[statusCode])
        expect(h3Err.message).toBe(error.message)
      }),
      { numRuns: 100 },
    )
  })
})

// Feature: http-error-handler, Property 2: Unknown errors produce 500 with generic message
describe('Property 2: Unknown errors produce 500 with generic message', () => {
  /**
   * For any Error instance whose constructor is not registered in ERROR_STATUS_MAP
   * and is not an H3Error, calling httpError() should produce an H3Error with:
   * - statusCode equal to 500
   * - statusMessage equal to "Internal Server Error"
   * - message equal to "Internal server error"
   *
   * The original error's message must NOT leak through to the response.
   *
   * **Validates: Requirements 2.3, 4.4, 5.3, 7.4**
   */
  it('produces 500 with generic message and does not leak original error message', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (msg) => {
        const error = new Error(msg)

        let caught: unknown
        try {
          httpError(error)
        } catch (e) {
          caught = e
        }

        // The caught error must be an H3Error
        expect(isError(caught)).toBe(true)

        const h3Err = caught as ReturnType<typeof createError>
        expect(h3Err.statusCode).toBe(500)
        expect(h3Err.statusMessage).toBe('Internal Server Error')
        expect(h3Err.message).toBe('Internal server error')

        // Original error message must NOT leak
        expect(h3Err.message).not.toBe(msg)
      }),
      { numRuns: 100 },
    )
  })
})

// Feature: http-error-handler, Property 3: H3Error passthrough
describe('Property 3: H3Error passthrough', () => {
  /**
   * For any H3Error with an arbitrary statusCode (400–599) and message,
   * calling httpError() should re-throw the exact same error object
   * (reference equality). If statusMessage was absent and the statusCode is
   * in STATUS_MESSAGES, it will be normalized in-place before re-throwing.
   *
   * **Validates: Requirements 2.4**
   */
  it('re-throws H3Errors with reference equality and normalizes missing statusMessage', () => {
    const arbH3Error = fc.record({
      statusCode: fc.integer({ min: 400, max: 599 }),
      message: fc.string({ minLength: 1 }),
    })

    fc.assert(
      fc.property(arbH3Error, ({ statusCode, message }) => {
        const original = createError({ statusCode, message })

        let caught: unknown
        try {
          httpError(original)
        } catch (e) {
          caught = e
        }

        // Must be the exact same object — reference equality
        expect(caught).toBe(original)

        // statusMessage must be normalized when STATUS_MESSAGES has an entry for the code;
        // when the code is absent from STATUS_MESSAGES, statusMessage must remain unchanged
        const h3Err = caught as ReturnType<typeof createError>
        if (STATUS_MESSAGES[statusCode]) {
          expect(h3Err.statusMessage).toBe(STATUS_MESSAGES[statusCode])
        } else {
          expect(h3Err.statusMessage).toBe(original.statusMessage)
        }
      }),
      { numRuns: 100 },
    )
  })
})

// Feature: http-error-handler, Property 4: Happy-path passthrough
describe('Property 4: Happy-path passthrough', () => {
  /**
   * For any handler function that returns a value without throwing,
   * defineApiHandler(handler) should return that exact value unchanged
   * when invoked.
   *
   * **Validates: Requirements 3.3**
   */
  it('returns the handler result unchanged when no error is thrown', async () => {
    // Minimal mock H3Event — defineApiHandler only forwards it to the inner handler
    const mockEvent = {} as H3Event

    fc.assert(
      fc.asyncProperty(fc.anything(), async (value) => {
        const handler = defineApiHandler(async () => value)
        const result = await handler(mockEvent)
        expect(result).toEqual(value)
      }),
      { numRuns: 100 },
    )
  })
})
