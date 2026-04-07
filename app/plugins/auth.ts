export default defineNuxtPlugin(() => {
  const { token } = useAuth()

  // Override globalThis.$fetch to inject auth headers only for /api/ routes.
  // Nuxt internal routes (/_nuxt_icon/, /_payload/, etc.) are left untouched.
  const original$fetch = globalThis.$fetch
  globalThis.$fetch = Object.assign(
    (url: string | Request, opts?: Record<string, unknown>) => {
      const urlStr = typeof url === 'string' ? url : ''
      if (urlStr.startsWith('/api/') && token.value) {
        opts = opts || {}
        const headers = new Headers(opts.headers as HeadersInit | undefined)
        headers.set('Authorization', `Bearer ${token.value}`)
        opts.headers = headers
      }
      return original$fetch(url, opts)
    },
    original$fetch,
  ) as typeof globalThis.$fetch
})
