import type { $Fetch } from 'ofetch'

/**
 * Provides `$authFetch` — a per-app `$fetch` instance that injects
 * the Authorization header on `/api/` requests when a JWT is present.
 *
 * Consumed via `useAuthFetch()` composable (auto-imported).
 * Does NOT mutate `globalThis.$fetch`.
 */
export default defineNuxtPlugin(() => {
  const { token } = useAuth()

  const authFetch = $fetch.create({
    onRequest({ options, request }) {
      const url = typeof request === 'string' ? request : ''
      if (url.startsWith('/api/') && token.value) {
        const headers = new Headers(options.headers as HeadersInit | undefined)
        headers.set('Authorization', `Bearer ${token.value}`)
        options.headers = headers
      }
    },
  })

  return {
    provide: {
      authFetch: authFetch as $Fetch,
    },
  }
})
