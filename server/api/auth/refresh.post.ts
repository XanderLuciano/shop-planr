import { refreshTokenSchema } from '../../schemas/authSchemas'

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
