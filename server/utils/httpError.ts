/**
 * Centralized HTTP error handler for API routes.
 *
 * Replaces the duplicated try/catch blocks across all route files with a
 * single `defineApiHandler()` wrapper that classifies service-layer errors
 * into properly-formed H3 errors with correct statusCode, statusMessage,
 * and message fields.
 */

/**
 * HTTP status code → RFC 9110 reason phrase lookup.
 */
export const STATUS_MESSAGES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
}

/**
 * Entry in the data-driven error class → status code mapping.
 */
export interface ErrorStatusEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorClass: new (...args: any[]) => Error
  statusCode: number
}

/**
 * Data-driven mapping from error constructors to HTTP status codes.
 * Add new entries here to extend error classification without touching routes.
 */
export const ERROR_STATUS_MAP: ErrorStatusEntry[] = [
  { errorClass: ValidationError, statusCode: 400 },
  { errorClass: AuthenticationError, statusCode: 401 },
  { errorClass: ForbiddenError, statusCode: 403 },
  { errorClass: NotFoundError, statusCode: 404 },
]

/**
 * Classifies an error and throws a properly-formed H3Error.
 *
 * 1. H3Error → normalize statusMessage if absent, then re-throw
 * 2. Mapped error class → statusCode from map, statusMessage from STATUS_MESSAGES, original message
 * 3. Unknown → 500 with generic message (prevents leaking internal details)
 */
export function httpError(error: unknown): never {
  if (isError(error)) {
    if (!error.statusMessage && error.statusCode && STATUS_MESSAGES[error.statusCode]) {
      error.statusMessage = STATUS_MESSAGES[error.statusCode]
    }
    throw error
  }

  for (const entry of ERROR_STATUS_MAP) {
    if (error instanceof entry.errorClass) {
      const data = error instanceof ValidationError && error.code
        ? { code: error.code, ...(error.meta ?? {}) }
        : undefined
      throw createError({
        statusCode: entry.statusCode,
        statusMessage: STATUS_MESSAGES[entry.statusCode] ?? 'Unknown Error',
        message: (error as Error).message,
        ...(data && { data }),
      })
    }
  }

  console.error('[API 500]', error)
  throw createError({
    statusCode: 500,
    statusMessage: STATUS_MESSAGES[500] ?? 'Unknown Error',
    message: 'Internal server error',
  })
}

/**
 * Drop-in replacement for `defineEventHandler` that adds centralized error handling.
 *
 * Usage:
 * ```ts
 * export default defineApiHandler(async (event) => {
 *   const body = await readBody(event)
 *   return getServices().jobService.createJob(body)
 * })
 * ```
 */
export function defineApiHandler<T>(
  handler: (event: Parameters<Parameters<typeof defineEventHandler>[0]>[0]) => T | Promise<T>,
) {
  return defineEventHandler(async (event) => {
    try {
      return await handler(event)
    } catch (error) {
      httpError(error)
    }
  })
}
