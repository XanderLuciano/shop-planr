const EXEMPT_ROUTES: Array<{ method: string, path: string }> = [
  { method: 'POST', path: '/api/auth/login' },
  { method: 'POST', path: '/api/auth/setup-pin' },
  { method: 'GET', path: '/api/users' },
  { method: 'POST', path: '/api/auth/refresh' },
]

function isExempt(method: string, path: string): boolean {
  return EXEMPT_ROUTES.some(
    route => route.method === method.toUpperCase() && path.startsWith(route.path),
  )
}

export default defineEventHandler(async (event) => {
  const path = event.path ?? ''

  // Skip non-API routes and Nuxt internal API routes
  if (!path.startsWith('/api/') || path.startsWith('/api/_')) {
    return
  }

  const method = getMethod(event)

  // Skip exempt routes
  if (isExempt(method, path)) {
    return
  }

  const authHeader = getHeader(event, 'authorization')
  let tokenStr: string | undefined

  if (authHeader?.startsWith('Bearer ')) {
    tokenStr = authHeader.slice(7)
  }
  else {
    // Fall back to cookie for SSR requests
    tokenStr = getCookie(event, 'shop-planr-auth-token') || undefined
  }

  if (!tokenStr) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  try {
    const { authService } = getServices()
    const payload = await authService.verifyToken(tokenStr)
    event.context.auth = { user: payload }
  }
  catch {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
})
