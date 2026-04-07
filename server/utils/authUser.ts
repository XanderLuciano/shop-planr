import type { H3Event } from 'h3'

/**
 * Extract the authenticated user's ID from the event context.
 * The auth middleware (02.auth.ts) sets `event.context.auth.user`
 * with the decoded JWT payload. The `sub` claim is the user ID.
 *
 * Throws 401 if no auth context is present (should never happen
 * for non-exempt routes since the middleware runs first).
 */
export function getAuthUserId(event: H3Event): string {
  const auth = event.context?.auth
  if (!auth?.user?.sub) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return auth.user.sub as string
}
