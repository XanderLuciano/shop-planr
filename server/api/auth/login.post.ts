import { loginSchema } from '../../schemas/authSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Auth'],
    description: 'Authenticate a user with username and PIN.',
    requestBody: zodRequestBody(loginSchema),
    responses: {
      200: { description: 'JWT token returned' },
      400: { description: 'Validation error' },
      401: { description: 'Invalid credentials' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const { username, pin } = await parseBody(event, loginSchema)
  const { authService } = getServices()
  const token = await authService.login(username, pin)
  return { token }
})
