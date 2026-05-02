/**
 * Extract a human-readable error message from a failed `$fetch` call to n8n.
 *
 * ofetch throws a `FetchError` whose `.data` property contains the parsed
 * JSON response body from n8n (when available). n8n typically returns
 * `{ message: "..." }` or `{ message: "...", description: "..." }` on
 * validation errors. We surface that detail so admins don't have to guess
 * what the remote rejected.
 */
export function extractN8nError(e: unknown): string {
  if (!(e instanceof Error)) return 'Unknown error communicating with n8n'

  // ofetch FetchError carries the parsed response body in `.data`
  const data = (e as Error & { data?: unknown }).data
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>
    const parts: string[] = []
    if (typeof body.message === 'string') parts.push(body.message)
    if (typeof body.description === 'string') parts.push(body.description)
    if (parts.length > 0) return parts.join(' — ')
  }

  // ofetch also puts the status in `.statusCode`
  const status = (e as Error & { statusCode?: number }).statusCode
  const statusHint = status ? ` (HTTP ${status})` : ''

  return `${e.message}${statusHint}`
}
