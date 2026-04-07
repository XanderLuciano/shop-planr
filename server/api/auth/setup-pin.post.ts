export default defineApiHandler(async (event) => {
  const { userId, pin } = await readBody(event)
  const { authService } = getServices()
  const token = await authService.setupPin(userId, pin)
  return { token }
})
