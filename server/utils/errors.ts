/**
 * Custom error classes for SHOP_ERP.
 * Used by services and caught by API route error handlers.
 */

/**
 * Optional structured payload attached to service-layer errors. When set,
 * `httpError()` forwards it to the client under the HTTP error's `data` field
 * so that UI code can branch on a stable `code` instead of regex-matching the
 * free-form message.
 */
export interface ErrorDetails {
  code?: string
  meta?: Record<string, unknown>
}

export class ValidationError extends Error {
  public readonly code?: string
  public readonly meta?: Record<string, unknown>
  constructor(message: string, details?: ErrorDetails) {
    super(message)
    this.name = 'ValidationError'
    this.code = details?.code
    this.meta = details?.meta
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`)
    this.name = 'NotFoundError'
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}
