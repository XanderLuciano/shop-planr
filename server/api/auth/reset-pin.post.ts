import { resetPinSchema } from '../../schemas/authSchemas'

export default defineApiHandler(async (event) => {
  const adminUserId = event.context.auth.user.sub
  const { targetUserId } = await parseBody(event, resetPinSchema)
  const { authService } = getServices()
  authService.resetPin(adminUserId, targetUserId)
  return { success: true }
})
