import { resetPinSchema } from '../../schemas/authSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Auth'],
    description: 'Reset a user PIN (admin only).',
    requestBody: zodRequestBody(resetPinSchema),
    responses: {
      200: { description: 'PIN reset successfully' },
      400: { description: 'Validation error' },
      403: { description: 'Forbidden — admin required' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const adminUserId = event.context.auth.user.sub
  const { targetUserId } = await parseBody(event, resetPinSchema)
  const { authService } = getServices()
  authService.resetPin(adminUserId, targetUserId)
  return { success: true }
})
