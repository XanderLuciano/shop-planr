import { setupPinSchema } from '../../schemas/authSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Auth'],
    description: 'Set up a PIN for a user (first-time login).',
    requestBody: zodRequestBody(setupPinSchema),
    responses: {
      200: { description: 'PIN set and JWT token returned' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const { userId, pin } = await parseBody(event, setupPinSchema)
  const { authService } = getServices()
  const token = await authService.setupPin(userId, pin)
  return { token }
})
