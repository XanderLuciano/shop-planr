/**
 * Property tests for useAuth composable (client-side).
 *
 * Feature: pin-auth-jwt, Property 8: Logout and switch clear token and state
 * **Validates: Requirements 8.3, 8.4, 11.3, 11.4**
 *
 * For any authenticated session (with a token in a cookie and a non-null
 * authenticatedUser), calling either logout() or switchUser() should result in:
 * (a) the cookie being cleared (null),
 * (b) authenticatedUser being null, and
 * (c) isAuthenticated being false.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fc from 'fast-check'
import { ref } from 'vue'

// Mock $fetch so network calls don't fire
vi.stubGlobal('$fetch', vi.fn())

// Mock useState — returns a shared ref by key, like Nuxt does
const stateStore: Record<string, any> = {}
vi.stubGlobal('useState', (key: string, init?: () => any) => {
  if (!(key in stateStore)) {
    stateStore[key] = ref(init ? init() : undefined)
  }
  return stateStore[key]
})

// Mock useCookie as a Nuxt auto-import — returns a ref backed by cookieStore
let cookieStore: Record<string, string | null> = {}

vi.stubGlobal('useCookie', (name: string, _opts?: any) => {
  // Create a simple ref that syncs to cookieStore
  const r = ref(cookieStore[name] ?? null)

  // Use a watch-like approach: wrap in a proxy to intercept .value sets
  return new Proxy(r, {
    get(target, prop) {
      if (prop === 'value') {
        return target.value
      }
      return (target as any)[prop]
    },
    set(target, prop, value) {
      if (prop === 'value') {
        target.value = value
        if (value === null || value === undefined) {
          delete cookieStore[name]
        }
        else {
          cookieStore[name] = value
        }
        return true
      }
      ;(target as any)[prop] = value
      return true
    },
  })
})

/**
 * Build a fake JWT whose payload decodes to the given fields.
 */
function buildFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'ES256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${header}.${body}.fakesig`
}

const COOKIE_NAME = 'shop-planr-auth-token'

const arbJwtPayload = fc.record({
  sub: fc.uuid(),
  username: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
  displayName: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
  isAdmin: fc.boolean(),
  active: fc.constant(true),
  createdAt: fc.constant(new Date().toISOString()),
  iat: fc.constant(Math.floor(Date.now() / 1000)),
  exp: fc.constant(Math.floor(Date.now() / 1000) + 86400),
})

describe('Property 8: Logout and switch clear token and state', () => {
  beforeEach(() => {
    vi.resetModules()
    cookieStore = {}
    for (const key of Object.keys(stateStore)) delete stateStore[key]
  })

  it('logout clears token, authenticatedUser, and cookie for any authenticated session', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbJwtPayload,
        async (payload) => {
          vi.resetModules()
          cookieStore = {}
          for (const key of Object.keys(stateStore)) delete stateStore[key]

          const jwt = buildFakeJwt(payload)
          cookieStore[COOKIE_NAME] = jwt

          const mod = await import('../../app/composables/useAuth')
          const auth = mod.useAuth()

          expect(auth.authenticatedUser.value).not.toBeNull()
          expect(auth.isAuthenticated.value).toBe(true)
          expect(auth.token.value).toBe(jwt)

          auth.logout()

          expect(cookieStore[COOKIE_NAME]).toBeUndefined()
          expect(auth.authenticatedUser.value).toBeNull()
          expect(auth.isAuthenticated.value).toBe(false)
          expect(auth.token.value).toBeNull()
        },
      ),
      { numRuns: 100 },
    )
  })

  it('switchUser clears token, authenticatedUser, and cookie for any authenticated session', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbJwtPayload,
        async (payload) => {
          vi.resetModules()
          cookieStore = {}
          for (const key of Object.keys(stateStore)) delete stateStore[key]

          const jwt = buildFakeJwt(payload)
          cookieStore[COOKIE_NAME] = jwt

          const mod = await import('../../app/composables/useAuth')
          const auth = mod.useAuth()

          expect(auth.authenticatedUser.value).not.toBeNull()
          expect(auth.isAuthenticated.value).toBe(true)

          auth.switchUser()

          expect(cookieStore[COOKIE_NAME]).toBeUndefined()
          expect(auth.authenticatedUser.value).toBeNull()
          expect(auth.isAuthenticated.value).toBe(false)
          expect(auth.token.value).toBeNull()
        },
      ),
      { numRuns: 100 },
    )
  })

  it('showOverlay is true after logout or switchUser for any session', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbJwtPayload,
        fc.constantFrom('logout', 'switchUser') as fc.Arbitrary<'logout' | 'switchUser'>,
        async (payload, action) => {
          vi.resetModules()
          cookieStore = {}
          for (const key of Object.keys(stateStore)) delete stateStore[key]

          const jwt = buildFakeJwt(payload)
          cookieStore[COOKIE_NAME] = jwt

          const mod = await import('../../app/composables/useAuth')
          const auth = mod.useAuth()

          expect(auth.showOverlay.value).toBe(false)

          auth[action]()

          expect(auth.showOverlay.value).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})
