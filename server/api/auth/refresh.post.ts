import { refreshTokenSchema } from '../../schemas/authSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Auth'],
    description: 'Refresh an existing JWT token.',
    responses: {
      200: { description: 'New JWT token returned' },
      401: { description: 'Missing or invalid Authorization header' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Missing or invalid Authorization header' })
  }

  const { token } = refreshTokenSchema.parse({ token: authHeader.slice(7) })
  const { authService } = getServices()
  const newToken = await authService.refreshToken(token)
  return { token: newToken }
})
