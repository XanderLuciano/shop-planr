export default defineApiHandler(async (event) => {
  const { username, pin } = await readBody(event)
  const { authService } = getServices()
  const token = await authService.login(username, pin)
  return { token }
})
