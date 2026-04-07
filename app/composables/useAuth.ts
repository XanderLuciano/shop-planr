import { computed } from 'vue'
import type { ShopUser, PublicUser } from '~/types/domain'

const COOKIE_NAME = 'shop-planr-auth-token'

interface JwtPayload {
  sub: string
  username: string
  displayName: string
  isAdmin: boolean
  department?: string
  active: boolean
  createdAt: string
  iat: number
  exp: number
}

function decodeToken(jwt: string): JwtPayload {
  const parts = jwt.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT format')
  const base64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const json = typeof atob !== 'undefined'
    ? atob(padded)
    : Buffer.from(padded, 'base64').toString('utf-8')
  return JSON.parse(json) as JwtPayload
}

function payloadToUser(payload: JwtPayload): ShopUser {
  return {
    id: payload.sub,
    username: payload.username,
    displayName: payload.displayName,
    isAdmin: payload.isAdmin,
    department: payload.department,
    active: payload.active,
    createdAt: payload.createdAt,
  }
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null

export function useAuth() {
  // NOTE: useAuth cannot use useAuthFetch() because the auth plugin depends
  // on useAuth() — circular dependency. Auth endpoints (login, setup-pin,
  // refresh) either don't need auth or pass the header explicitly.

  // useCookie — SSR-safe, same ref per cookie name within a request/app
  const tokenCookie = useCookie(COOKIE_NAME, {
    maxAge: 60 * 60 * 24,
    sameSite: 'lax',
    path: '/',
  })

  // useState — SSR-safe singleton refs shared across all useAuth() callers
  const authenticatedUser = useState<ShopUser | null>('auth:user', () => null)
  const users = useState<PublicUser[]>('auth:users', () => [])
  const showOverlay = useState<boolean>('auth:overlay', () => true)
  const initialized = useState<boolean>('auth:init', () => false)

  // Restore session from cookie once per SSR request / client app load
  if (!initialized.value) {
    initialized.value = true
    const jwt = tokenCookie.value
    if (jwt) {
      try {
        const payload = decodeToken(jwt)
        const nowSec = Math.floor(Date.now() / 1000)
        if (payload.exp > nowSec) {
          authenticatedUser.value = payloadToUser(payload)
          showOverlay.value = false
          // Schedule refresh on client only
          if (import.meta.client) {
            scheduleRefresh(payload)
          }
        } else {
          tokenCookie.value = null
        }
      } catch {
        tokenCookie.value = null
      }
    }
  }

  const isAuthenticated = computed(() => authenticatedUser.value !== null)
  const isAdmin = computed(() => authenticatedUser.value?.isAdmin === true)

  function clearRefreshTimer(): void {
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
  }

  function scheduleRefresh(payload: JwtPayload): void {
    if (import.meta.server) return
    clearRefreshTimer()
    const lifetimeMs = (payload.exp - payload.iat) * 1000
    const delayMs = lifetimeMs * 0.8
    refreshTimer = setTimeout(async () => {
      try {
        const data = await $fetch<{ token: string }>('/api/auth/refresh', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenCookie.value}` },
        })
        setSession(data.token)
      } catch {
        clearSession()
      }
    }, delayMs)
  }

  function setSession(jwt: string): void {
    const payload = decodeToken(jwt)
    tokenCookie.value = jwt
    authenticatedUser.value = payloadToUser(payload)
    showOverlay.value = false
    scheduleRefresh(payload)
  }

  function clearSession(): void {
    clearRefreshTimer()
    tokenCookie.value = null
    authenticatedUser.value = null
    showOverlay.value = true
  }

  async function login(username: string, pin: string): Promise<void> {
    const data = await $fetch<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: { username, pin },
    })
    setSession(data.token)
    // Full reload to re-run all page data fetches with the new token
    if (import.meta.client) {
      window.location.reload()
    }
  }

  async function setupPin(userId: string, pin: string): Promise<void> {
    const data = await $fetch<{ token: string }>('/api/auth/setup-pin', {
      method: 'POST',
      body: { userId, pin },
    })
    setSession(data.token)
    if (import.meta.client) {
      window.location.reload()
    }
  }

  function logout(): void {
    clearSession()
  }

  function switchUser(): void {
    clearSession()
  }

  async function fetchUsers(): Promise<void> {
    try {
      users.value = await $fetch<PublicUser[]>('/api/users')
    } catch {
      users.value = []
    }
  }

  return {
    authenticatedUser: computed(() => authenticatedUser.value),
    isAuthenticated,
    isAdmin,
    token: computed(() => tokenCookie.value ?? null),
    users: computed(() => users.value),
    showOverlay: computed({
      get: () => showOverlay.value,
      set: (v: boolean) => { showOverlay.value = v },
    }),
    login,
    setupPin,
    logout,
    switchUser,
    fetchUsers,
  }
}
