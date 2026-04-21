/**
 * Auth helpers for e2e tests.
 *
 * Strategy: authenticate via the HTTP API (fast, deterministic), then plant the
 * JWT into the `shop-planr-auth-token` cookie. This skips the UI login path in
 * tests that aren't specifically testing login — keeping them focused on one
 * behavior each.
 *
 * The login UI itself is exercised by tests/e2e/auth.spec.ts.
 */
import type { APIRequestContext, BrowserContext } from '@playwright/test'

export const AUTH_COOKIE = 'shop-planr-auth-token'
export const DEFAULT_PIN = '0000'

export const TEST_USERS = {
  admin: { username: 'SAMPLE-Sarah', pin: DEFAULT_PIN },
  operator: { username: 'SAMPLE-Mike', pin: DEFAULT_PIN },
} as const

/**
 * SAMPLE-Tony and SAMPLE-Lisa are seeded but intentionally unused by the
 * fixtures — this lets auth tests exercise the PIN-setup flow against
 * a known-PIN-less user without racing other tests.
 */
export const UNREGISTERED_USERNAME = 'SAMPLE-Tony'

export type TestUser = keyof typeof TEST_USERS

interface PublicUser {
  id: string
  username: string
  displayName: string
  isAdmin: boolean
  hasPin: boolean
}

/**
 * Token cache — avoids hitting the login rate-limiter (6 / 15s) across a
 * worker process. Tokens are valid for 24h so reuse is fine for a test run.
 * Cleared at the start of each playwright invocation because the process is
 * fresh; cleared within a process via the exported resetAuthCache().
 */
const tokenCache = new Map<string, string>()

export function resetAuthCache(): void {
  tokenCache.clear()
}

/**
 * Issue a JWT for the given seeded user. First call sets up the PIN via
 * /api/auth/setup-pin; subsequent calls hit /api/auth/login (cached after
 * the first successful login).
 */
export async function acquireToken(
  request: APIRequestContext,
  username: string,
  pin: string = DEFAULT_PIN,
): Promise<string> {
  const cached = tokenCache.get(username)
  if (cached) return cached

  const usersRes = await request.get('/api/users')
  if (!usersRes.ok()) throw new Error(`GET /api/users failed: ${usersRes.status()}`)
  const users: PublicUser[] = await usersRes.json()
  const user = users.find(u => u.username === username)
  if (!user) {
    throw new Error(`User "${username}" not found. Available: ${users.map(u => u.username).join(', ')}`)
  }

  const endpoint = user.hasPin ? '/api/auth/login' : '/api/auth/setup-pin'
  const body = user.hasPin ? { username, pin } : { userId: user.id, pin }
  const res = await request.post(endpoint, { data: body })
  if (!res.ok()) {
    throw new Error(`${endpoint} failed: ${res.status()} ${await res.text()}`)
  }
  const { token } = (await res.json()) as { token: string }
  tokenCache.set(username, token)
  return token
}

/**
 * Plant the JWT cookie onto the browser context so subsequent page loads are
 * authenticated without going through the UI.
 */
export async function setAuthCookie(
  context: BrowserContext,
  token: string,
  baseURL: string,
): Promise<void> {
  const url = new URL(baseURL)
  await context.addCookies([
    {
      name: AUTH_COOKIE,
      value: token,
      domain: url.hostname,
      path: '/',
      httpOnly: false,
      secure: url.protocol === 'https:',
      sameSite: 'Lax',
    },
  ])
}
