interface ApiErrorShape {
  data?: { message?: string, data?: { code?: string } }
  message?: string
}

/**
 * Extracts a human-readable error message from a failed `$fetch` / `useAuthFetch`
 * rejection. Nitro wraps server-side errors under `err.data`, while network or
 * client-side errors surface `err.message` directly — this helper unwraps both
 * and falls back to the provided default.
 */
export function extractApiError(err: unknown, fallback: string): string {
  const e = err as ApiErrorShape | null | undefined
  return e?.data?.message ?? e?.message ?? fallback
}

/**
 * Extracts the structured error `code` from a failed API response.
 * Returns `undefined` when the error doesn't carry a code.
 *
 * Nitro nests the service-layer `data` payload under `err.data.data`
 * (the outer `data` is the H3 error envelope, the inner `data` is the
 * structured payload forwarded by `httpError()`).
 */
export function extractApiErrorCode(err: unknown): string | undefined {
  const e = err as ApiErrorShape | null | undefined
  return e?.data?.data?.code
}
