import { RateLimiterMemory } from 'rate-limiter-flexible'

// Login tier (tightest — brute-force protection)
const loginLimiter15s = new RateLimiterMemory({ points: 3, duration: 15, keyPrefix: 'login_15s' })
const loginLimiter1m = new RateLimiterMemory({ points: 10, duration: 60, keyPrefix: 'login_1m' })
const loginLimiter1h = new RateLimiterMemory({ points: 30, duration: 3600, keyPrefix: 'login_1h' })

// Unauthenticated tier
const unauthLimiter15s = new RateLimiterMemory({ points: 10, duration: 15, keyPrefix: 'unauth_15s' })
const unauthLimiter1m = new RateLimiterMemory({ points: 30, duration: 60, keyPrefix: 'unauth_1m' })
const unauthLimiter1h = new RateLimiterMemory({ points: 300, duration: 3600, keyPrefix: 'unauth_1h' })

// Authenticated tier (highest — supports bulk part advancement)
const authLimiter15s = new RateLimiterMemory({ points: 60, duration: 15, keyPrefix: 'auth_15s' })
const authLimiter1m = new RateLimiterMemory({ points: 300, duration: 60, keyPrefix: 'auth_1m' })
const authLimiter1h = new RateLimiterMemory({ points: 10000, duration: 3600, keyPrefix: 'auth_1h' })

function getLimiters(path: string, isAuthenticated: boolean): RateLimiterMemory[] {
  if (path.startsWith('/api/auth/login') || path.startsWith('/api/auth/setup-pin')) {
    return [loginLimiter15s, loginLimiter1m, loginLimiter1h]
  }
  if (isAuthenticated) {
    return [authLimiter15s, authLimiter1m, authLimiter1h]
  }
  return [unauthLimiter15s, unauthLimiter1m, unauthLimiter1h]
}

export default defineEventHandler(async (event) => {
  const path = event.path ?? ''

  // Only apply rate limiting to API routes (skip Nuxt internal routes)
  if (!path.startsWith('/api/') || path.startsWith('/api/_')) {
    return
  }

  // Determine auth status from Authorization header (runs before auth middleware)
  const authHeader = getHeader(event, 'authorization')
  const isAuthenticated = !!authHeader?.startsWith('Bearer ')

  // Use socket remoteAddress as the base — this is always trustworthy.
  // Only fall back to x-forwarded-for when TRUST_PROXY is enabled (app sits behind a known reverse proxy).
  const socketIP = getRequestIP(event)
  let clientIP = socketIP ?? '127.0.0.1'

  const trustProxy = process.env.TRUST_PROXY === 'true'
  if (trustProxy && !socketIP) {
    const forwarded = getHeader(event, 'x-forwarded-for')
    if (forwarded) {
      // Take only the first (leftmost) IP — the client-originating address
      clientIP = forwarded.split(',')[0]!.trim()
    }
  }
  const limiters = getLimiters(path, isAuthenticated)

  try {
    await Promise.all(limiters.map(limiter => limiter.consume(clientIP)))
  }
  catch (rateLimiterRes: any) {
    const retryAfter = Math.ceil(rateLimiterRes.msBeforeNext / 1000)
    setHeader(event, 'Retry-After', String(retryAfter))
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
    })
  }
})
