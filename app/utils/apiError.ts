/**
 * Extracts a human-readable error message from a failed `$fetch` / `useAuthFetch`
 * rejection. Nitro wraps server-side errors under `err.data`, while network or
 * client-side errors surface `err.message` directly — this helper unwraps both
 * and falls back to the provided default.
 */
export function extractApiError(err: unknown, fallback: string): string {
  const e = err as { data?: { message?: string }, message?: string } | null | undefined
  return e?.data?.message ?? e?.message ?? fallback
}
