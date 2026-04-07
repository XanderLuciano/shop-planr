export default defineApiHandler(async (event) => {
  const adminUserId = event.context.auth.user.sub
  const { targetUserId } = await readBody(event)
  const { authService } = getServices()
  authService.resetPin(adminUserId, targetUserId)
  return { success: true }
})
