import { loginSchema } from '../../schemas/authSchemas'

export default defineApiHandler(async (event) => {
  const { username, pin } = await parseBody(event, loginSchema)
  const { authService } = getServices()
  const token = await authService.login(username, pin)
  return { token }
})
